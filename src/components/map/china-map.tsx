"use client";

import { geoCentroid, geoConicEqualArea, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/categories";
import { loadRegionShapes, type RegionFeature } from "@/lib/geo";
import { loadTowns, townPos, type TownFocus } from "@/lib/towns";
import type { HanjaConverter } from "@/lib/hanja";
import { CHINA } from "@/lib/regions";
import { dominantCategory, teasInRegion } from "@/lib/tea-utils";
import type { Tea } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  viewCode: string;
  focusCode: string | null;
  teas: Tea[];
  conv: HanjaConverter | null;
  highlightTeaId?: string | null;
  /** 바뀌면 확대·이동을 처음 상태로 */
  resetKey?: number;
  onRegionClick: (adcode: string, hasChildren: boolean) => void;
  /** 지역 검색에서 고른 향·진 (위치가 있으면 표시) */
  focusTown?: TownFocus | null;
  /** 향·진 점을 눌렀을 때 */
  onTownClick?: (town: TownFocus) => void;
  /** 더 나눌 수 없는 구역(현·구)을 길게 눌렀을 때 그 위치 (없으면 길게 누르기 꺼짐) */
  onLongPress?: (adcode: string, lngLat: [number, number]) => void;
  /** 세부 산지 핀의 차 이름을 눌렀을 때 */
  onTeaClick?: (teaId: string) => void;
}

/** 지도에 맞출 범위에서 뺄 구역 (남해 제도까지 맞추면 본토가 너무 작아집니다) */
const FIT_EXCLUDE = new Set(["460300", "100000_JD"]);
const MAINLAND: GeoPermissibleObjects = {
  type: "Polygon",
  coordinates: [
    [
      [73, 17.5],
      [73, 53.8],
      [135.2, 53.8],
      [135.2, 17.5],
      [73, 17.5],
    ],
  ],
};

const NO_FEATURES: RegionFeature[] = [];

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const LONG_PRESS_MS = 650;

export function ChinaMap({
  viewCode,
  focusCode,
  teas,
  conv,
  highlightTeaId,
  resetKey,
  focusTown,
  onTownClick,
  onRegionClick,
  onLongPress,
  onTeaClick,
}: Props) {
  const [containerRef, { width, height }] = useSize<HTMLDivElement>();
  const [shapes, setShapes] = useState<{ code: string; features: RegionFeature[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // 마우스를 올린 구역 (구역이 바뀔 때만 다시 그림. 같은 구역 안에서는 툴팁을 tipRef 로 직접 옮김)
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // 확대·이동 중에는 React 로 다시 그리지 않고 <g> 의 transform 과 --k 만 바꿉니다. k 상태는 끝났을 때만 갱신
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomGRef = useRef<SVGGElement>(null);
  const [k, setK] = useState(1);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    let alive = true;
    loadRegionShapes(viewCode)
      .then((features) => alive && setShapes({ code: viewCode, features }))
      .catch(() => alive && setFailed(viewCode));
    return () => {
      alive = false;
    };
  }, [viewCode]);

  const features = useMemo(() => shapes?.features ?? NO_FEATURES, [shapes]);
  const error = failed === viewCode ? "지도 데이터를 불러오지 못했습니다." : null;
  const ready = shapes?.code === viewCode && width > 0;

  const projection = useMemo(() => {
    if (!features.length || !width) return null;
    const fitTarget: GeoPermissibleObjects =
      viewCode === CHINA
        ? MAINLAND
        : { type: "FeatureCollection", features: features.filter((f) => !FIT_EXCLUDE.has(f.properties.adcode)) };
    const [lon, lat] = geoCentroid(fitTarget);
    const pad = Math.min(width, height) * 0.06 + 12;
    return geoConicEqualArea()
      .rotate([-lon, 0])
      .parallels([lat - 6, lat + 6])
      .fitExtent(
        [
          [pad, pad],
          [width - pad, height - pad],
        ],
        fitTarget,
      );
  }, [features, width, height, viewCode]);

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  // 구역별 차 통계
  const regionTeas = useMemo(() => {
    const m = new Map<string, Tea[]>();
    for (const f of features) m.set(f.properties.adcode, teasInRegion(teas, f.properties.adcode));
    return m;
  }, [features, teas]);

  const highlighted = useMemo(() => {
    const t = highlightTeaId ? teas.find((x) => x.id === highlightTeaId) : null;
    return new Set(t ? t.origins.flatMap((o) => o.path) : []);
  }, [highlightTeaId, teas]);

  /** 현재 보고 있는 구역 자체(하위 구역 미지정)로 등록된 차 */
  const selfTeas = useMemo(
    () => (viewCode === CHINA ? [] : teas.filter((t) => t.origins.some((o) => o.adcode === viewCode))),
    [teas, viewCode],
  );

  /** 세부 산지 위치 핀 (전국 지도에서는 너무 빽빽해 생략, 성을 눌러 들어가면 표시) */
  const pins = useMemo(() => {
    if (!projection || viewCode === CHINA) return [];
    const m = new Map<string, { x: number; y: number; zh: string; ko: string; teas: Tea[] }>();
    for (const t of teas) {
      for (const o of t.origins) {
        const d = o.detail;
        if (!d || d.lng == null || d.lat == null || !o.path.includes(viewCode)) continue;
        const key = `${d.lng},${d.lat}`;
        const pt = projection([d.lng, d.lat]);
        if (!pt) continue;
        const cur = m.get(key) ?? { x: pt[0], y: pt[1], zh: d.name_zh, ko: d.name_ko, teas: [] };
        if (!cur.teas.includes(t)) cur.teas.push(t);
        m.set(key, cur);
      }
    }
    return [...m.values()];
  }, [teas, projection, viewCode]);

  // 현·구가 보이는 지도에서는 향·진 위치를 점으로 (OpenStreetMap 기준, 일부만 위치가 있음)
  const [towns, setTowns] = useState<{ view: string; list: (TownFocus & { x: number; y: number })[] }>({
    view: "",
    list: [],
  });
  useEffect(() => {
    const leaves = features.filter((f) => f.properties.childrenNum === 0 && /^\d{6}$/.test(f.properties.adcode));
    if (!projection || !leaves.length || leaves.length > 40) return;
    let alive = true;
    Promise.all(leaves.map((f) => loadTowns(f.properties.adcode).then((ts) => ts.map((t) => ({ t, county: f.properties.adcode })))))
      .then((all) => {
        if (!alive) return;
        const list = all.flat().flatMap(({ t, county }) => {
          const pos = townPos(t);
          const pt = pos && projection([pos.lng, pos.lat]);
          return pt ? [{ code: t[0], county, zh: t[1], ko: conv?.toHangul(t[1]) ?? "", ...pos, x: pt[0], y: pt[1] }] : [];
        });
        setTowns({ view: viewCode, list });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [features, projection, viewCode, conv]);
  const townDots = towns.view === viewCode ? towns.list : [];
  const focusTownPt =
    focusTown && focusTown.lng != null && focusTown.lat != null && projection ? projection([focusTown.lng, focusTown.lat]) : null;

  const shapesData = useMemo(() => {
    if (!path || !projection) return [];
    return features.map((f) => {
      const p = f.properties;
      const c = p.centroid ?? p.center ?? geoCentroid(f);
      const pt = projection(c) ?? path.centroid(f);
      const label = p.name.replace(/(维吾尔|壮族|回族)?自治区$|省$|市$|特别行政区$/, "");
      return { f, d: path(f) ?? "", area: path.area(f), x: pt[0], y: pt[1], label, labelKo: conv?.toHangul(label) ?? "" };
    });
  }, [features, path, projection, conv]);

  // 확대/이동
  useEffect(() => {
    if (!svgEl) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .on("start", () => {
        svgEl.dataset.zooming = "1";
      })
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        const g = zoomGRef.current;
        if (g) {
          g.setAttribute("transform", e.transform.toString());
          // 글자·표식은 반대로 축소해 크기 유지 (CSS 변수는 하위 전체 스타일을 다시 계산하게 해서 느림)
          const inv = `scale(${1 / e.transform.k})`;
          for (const el of g.querySelectorAll(".map-cs")) el.setAttribute("transform", inv);
        }
      })
      .on("end", (e) => {
        delete svgEl.dataset.zooming;
        setK(e.transform.k);
      });
    zoomRef.current = z;
    const sel = select(svgEl);
    sel.call(z).on("dblclick.zoom", null);
    sel.call(z.transform, zoomIdentity);
    return () => {
      sel.on(".zoom", null);
    };
  }, [svgEl, viewCode]);

  useEffect(() => {
    if (resetKey && svgEl && zoomRef.current) {
      select(svgEl).transition().duration(400).call(zoomRef.current.transform, zoomIdentity);
    }
  }, [resetKey, svgEl]);

  const zoomBy = useCallback(
    (k: number) => {
      if (svgEl && zoomRef.current) select(svgEl).transition().duration(300).call(zoomRef.current.scaleBy, k);
    },
    [svgEl],
  );
  const resetZoom = useCallback(() => {
    if (svgEl && zoomRef.current) select(svgEl).transition().duration(400).call(zoomRef.current.transform, zoomIdentity);
  }, [svgEl]);

  // 작은 현·구를 선택하면 그 구역으로 확대
  useEffect(() => {
    if (!svgEl || !zoomRef.current || !path || !focusCode || focusCode === viewCode) return;
    const f = features.find((x) => x.properties.adcode === focusCode);
    if (!f) return;
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const k = Math.min(8, 0.45 / Math.max((x1 - x0) / width, (y1 - y0) / height));
    if (k < 1.6) return;
    const t = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    select(svgEl).transition().duration(600).call(zoomRef.current.transform, t);
  }, [focusCode, svgEl, path, features, width, height, viewCode]);

  // 길게 누르기: 누른 채 거의 움직이지 않으면 LONG_PRESS_MS 뒤에 실행 (끌면 지도 이동으로 취소)
  const [pressing, setPressing] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = press.current?.fired ? press.current : null;
    setPressing(null);
  };
  const startPress = (e: React.PointerEvent<SVGPathElement>, code: string) => {
    if (!onLongPress || !projection || e.button !== 0) return;
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const timer = window.setTimeout(() => {
      const ll = projection.invert?.(transformRef.current.invert([x, y]));
      setPressing(null);
      if (!ll || !press.current) return;
      press.current.fired = true;
      navigator.vibrate?.(15);
      onLongPress(code, [ll[0], ll[1]]);
    }, LONG_PRESS_MS);
    press.current = { timer, x: e.clientX, y: e.clientY, fired: false };
    setPressing({ x, y });
  };

  const hovered = hover ? shapesData.find((s) => s.f.properties.adcode === hover.code) : null;
  const hoveredTeas = hover ? (regionTeas.get(hover.code) ?? []) : [];
  const tipLeft = (x: number) => Math.min(x + 14, width - 260);
  const tipTop = (y: number) => Math.max(y - 12, 8);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-map-sea">
      <AnimatePresence mode="wait">
        {ready && path && (
          <motion.svg
            key={viewCode}
            ref={setSvgEl}
            width={width}
            height={height}
            className="absolute inset-0 touch-none select-none"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onPointerLeave={() => {
              setHover(null);
              cancelPress();
            }}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => onLongPress && e.preventDefault()}
          >
            <defs>
              <filter id="land-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="oklch(0.4 0.03 60)" floodOpacity="0.18" />
              </filter>
            </defs>
            {/* transform 은 확대 핸들러가 직접 씁니다 (React 가 덮어쓰지 않도록 prop 으로 주지 않음) */}
            <g ref={zoomGRef}>
              <g className="map-land-shadow">
                {shapesData.map(({ f, d }) => {
                  const code = f.properties.adcode;
                  const decorative = code.includes("_");
                  const list = regionTeas.get(code) ?? [];
                  const cat = dominantCategory(list);
                  const isFocus = focusCode === code;
                  const isHover = hover?.code === code;
                  const isHi = highlighted.has(code);
                  return (
                    <path
                      key={code}
                      d={d}
                      vectorEffect="non-scaling-stroke"
                      className={cn("transition-[fill,stroke-width] duration-200", !decorative && "cursor-pointer")}
                      style={{
                        fill: decorative
                          ? "var(--map-stroke)"
                          : isHover
                            ? cat
                              ? CATEGORY_META[cat].color
                              : "var(--map-land-hover)"
                            : cat
                              ? `var(--tint-${cat})`
                              : "var(--map-land)",
                        fillOpacity: isHover && cat ? 0.55 : 1,
                        stroke: isFocus || isHi ? "var(--seal)" : cat ? CATEGORY_META[cat].color : "var(--map-stroke)",
                        strokeWidth: isFocus || isHi ? 2.2 : cat ? 1 : 0.7,
                        strokeOpacity: cat || isFocus || isHi ? 0.9 : 1,
                      }}
                      onPointerMove={(e) => {
                        if (decorative) return;
                        const p = press.current;
                        if (e.pointerType === "mouse") {
                          const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          if (hover?.code !== code) setHover({ code, x, y });
                          else if (tipRef.current) {
                            tipRef.current.style.left = `${tipLeft(x)}px`;
                            tipRef.current.style.top = `${tipTop(y)}px`;
                          }
                        }
                        if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) cancelPress();
                      }}
                      onPointerLeave={() => setHover((h) => (h?.code === code ? null : h))}
                      onPointerDown={(e) => !decorative && f.properties.childrenNum === 0 && startPress(e, code)}
                      onClick={() => {
                        // 길게 누른 뒤 손을 뗄 때 생기는 클릭은 무시
                        if (press.current?.fired) {
                          press.current = null;
                          return;
                        }
                        if (!decorative) onRegionClick(code, f.properties.childrenNum > 0);
                      }}
                    />
                  );
                })}
              </g>

              {/* 지명 */}
              {shapesData.map(({ f, area, x, y, label, labelKo }) => {
                const code = f.properties.adcode;
                if (code.includes("_")) return null;
                const has = (regionTeas.get(code)?.length ?? 0) > 0;
                if (area * k * k < (has ? 900 : 2600)) return null;
                return (
                  <g key={`l-${code}`} transform={`translate(${x},${y})`} pointerEvents="none">
                    <g className="map-cs" transform={`scale(${1 / k})`}>
                    <g transform={`translate(0,${has ? 24 : 0})`}>
                    <text
                      textAnchor="middle"
                      className="font-zh"
                      style={{ fill: "var(--map-label)", fontSize: 11.5, fontWeight: 600, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3, strokeOpacity: 0.85 }}
                    >
                      {label}
                    </text>
                    {labelKo && (
                      <text
                        textAnchor="middle"
                        y={12}
                        style={{ fill: "var(--map-label)", fontSize: 9.5, opacity: 0.8, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3, strokeOpacity: 0.85 }}
                      >
                        {labelKo}
                      </text>
                    )}
                    </g>
                    </g>
                  </g>
                );
              })}

              {/* 차 표식 */}
              {shapesData.map(({ f, x, y }) => {
                const code = f.properties.adcode;
                const list = regionTeas.get(code) ?? [];
                if (!list.length) return null;
                const cat = dominantCategory(list)!;
                const r = 8 + Math.min(list.length, 12) * 0.7;
                return (
                  <motion.g
                    key={`m-${code}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
                    style={{ x, y }}
                    pointerEvents="none"
                  >
                    <g className="map-cs" transform={`scale(${1 / k})`}>
                      {highlighted.has(code) && (
                        <motion.circle
                          r={r + 6}
                          fill="none"
                          stroke="var(--seal)"
                          strokeWidth={2}
                          initial={{ scale: 0.8, opacity: 0.9 }}
                          animate={{ scale: 1.5, opacity: 0 }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                      )}
                      <circle r={r} fill={CATEGORY_META[cat].color} stroke="var(--map-land)" strokeWidth={2} />
                      <text textAnchor="middle" dy="0.36em" fill="white" style={{ fontSize: 11, fontWeight: 700 }}>
                        {list.length}
                      </text>
                    </g>
                  </motion.g>
                );
              })}

              {/* 향·진 위치 */}
              {townDots.map((t) => {
                const show = k >= 2.2 || focusCode === t.county;
                if (focusTown?.code === t.code) return null;
                return (
                  <g
                    key={t.code}
                    transform={`translate(${t.x},${t.y})`}
                    className={onTownClick ? "group cursor-pointer" : undefined}
                    pointerEvents={onTownClick ? "auto" : "none"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTownClick?.({ code: t.code, county: t.county, zh: t.zh, ko: t.ko, lng: t.lng, lat: t.lat });
                    }}
                  >
                    <title>{`${t.zh} ${t.ko}`}</title>
                    <g className="map-cs" transform={`scale(${1 / k})`}>
                    {/* 누르기 쉽게 넓은 투명 영역 */}
                    <circle r={show ? 9 : 6} fill="transparent" />
                    <circle
                      r={show ? 2.6 : 1.8}
                      className="transition-all group-hover:fill-[var(--seal)]"
                      style={{ fill: "var(--map-label)", opacity: show ? 0.8 : 0.4 }}
                    />
                    {show && (
                      <text
                        x={4.5}
                        y={3.5}
                        className="font-zh group-hover:font-bold"
                        style={{ fill: "var(--map-label)", fontSize: 9.5, opacity: 0.9, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 2.5 }}
                      >
                        {t.zh}
                        {t.ko && <tspan style={{ fontSize: 8.5, opacity: 0.8 }}> {t.ko}</tspan>}
                      </text>
                    )}
                    </g>
                  </g>
                );
              })}

              {/* 검색으로 고른 향·진 */}
              {focusTown && focusTownPt && (
                <g transform={`translate(${focusTownPt[0]},${focusTownPt[1]})`} pointerEvents="none">
                  <g className="map-cs" transform={`scale(${1 / k})`}>
                  <motion.circle
                    r={10}
                    fill="none"
                    stroke="var(--seal)"
                    strokeWidth={2}
                    initial={{ scale: 0.6, opacity: 1 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                  <circle r={5} style={{ fill: "var(--seal)", stroke: "white", strokeWidth: 1.5 }} />
                  <text
                    x={9}
                    y={-6}
                    className="font-zh"
                    style={{ fill: "var(--foreground)", fontSize: 12.5, fontWeight: 700, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3.5 }}
                  >
                    {focusTown.zh} <tspan style={{ fontWeight: 400, fontSize: 10.5 }}>{focusTown.ko}</tspan>
                  </text>
                  </g>
                </g>
              )}

              {/* 세부 산지 핀 */}
              {pins.map((p) => (
                <g key={`p-${p.x},${p.y}`} transform={`translate(${p.x},${p.y})`}>
                  <g className="map-cs" transform={`scale(${1 / k})`}>
                  <title>{`${p.zh || p.ko || "이름 없는 위치"}\n${p.teas.map((t) => t.name_zh || t.name_ko).join(", ")}`}</title>
                  <motion.path
                    d="M0 0 C -5 -7 -6.5 -10 -6.5 -13 A 6.5 6.5 0 1 1 6.5 -13 C 6.5 -10 5 -7 0 0 Z"
                    initial={{ scale: 0, y: -6 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.25 }}
                    style={{ fill: CATEGORY_META[p.teas[0].category].color, stroke: "white", strokeWidth: 1.2 }}
                    className={onTeaClick ? "cursor-pointer" : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTeaClick?.(p.teas[0].id);
                    }}
                  />
                  {p.teas.length > 1 ? (
                    <text y={-13} textAnchor="middle" dy="0.36em" fill="white" pointerEvents="none" style={{ fontSize: 8.5, fontWeight: 700 }}>
                      {p.teas.length}
                    </text>
                  ) : (
                    <circle cy={-13} r={2.3} fill="white" pointerEvents="none" />
                  )}
                  {/* 그 자리의 차 이름 (누르면 차 정보) */}
                  {[...p.teas.slice(0, 3).map((t) => ({ id: t.id, label: t.name_zh || t.name_ko })), ...(p.teas.length > 3 ? [{ id: "", label: `외 ${p.teas.length - 3}종` }] : [])].map(
                      ({ id, label }, i) => (
                        <text
                          key={id || "more"}
                          x={9}
                          y={-9 + i * 13}
                          className={cn("font-zh", id && onTeaClick && "cursor-pointer hover:underline")}
                          pointerEvents={id && onTeaClick ? "auto" : "none"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (id) onTeaClick?.(id);
                          }}
                          style={{ fill: "var(--map-label)", fontSize: 10.5, fontWeight: id ? 600 : 400, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3 }}
                        >
                          {label}
                        </text>
                      ),
                    )}
                  </g>
                </g>
              ))}
            </g>

            {/* 길게 누르는 중: 링이 차오름 */}
            {pressing && (
              <g transform={`translate(${pressing.x},${pressing.y})`} pointerEvents="none">
                <circle r={20} fill="none" stroke="var(--seal)" strokeOpacity={0.25} strokeWidth={4} />
                <motion.circle
                  r={20}
                  fill="none"
                  stroke="var(--seal)"
                  strokeWidth={4}
                  strokeLinecap="round"
                  transform="rotate(-90)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: LONG_PRESS_MS / 1000, ease: "linear" }}
                />
                <circle r={3} fill="var(--seal)" />
              </g>
            )}
          </motion.svg>
        )}
      </AnimatePresence>

      {(!ready || !path) && !error && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
      {error && <div className="absolute inset-0 grid place-items-center text-sm text-destructive">{error}</div>}

      {/* 툴팁 */}
      <AnimatePresence>
        {hover && hovered && (
          <motion.div
            key="tip"
            ref={tipRef}
            className="pointer-events-none absolute z-10 max-w-64 rounded-lg border bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur"
            style={{ left: tipLeft(hover.x), top: tipTop(hover.y) }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-zh text-base font-semibold">{hovered.f.properties.name}</span>
              {hovered.labelKo && <span className="text-xs text-muted-foreground">{hovered.labelKo}</span>}
            </div>
            {hoveredTeas.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs">
                {hoveredTeas.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: CATEGORY_META[t.category].color }} />
                    <span className="font-zh">{t.name_zh}</span>
                    <span className="text-muted-foreground">{t.name_ko}</span>
                  </li>
                ))}
                {hoveredTeas.length > 6 && <li className="text-muted-foreground">외 {hoveredTeas.length - 6}종</li>}
              </ul>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">등록된 차 없음</p>
            )}
            {hovered.f.properties.childrenNum > 0 && <p className="mt-1 text-[11px] text-primary">클릭해서 자세히 보기 →</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {townDots.length > 0 && (
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-14 bottom-3 rounded bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur hover:underline"
        >
          향·진 위치 © OpenStreetMap
        </a>
      )}

      {onLongPress && features.some((f) => f.properties.childrenNum === 0 && !f.properties.adcode.includes("_")) && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur sm:block">
          현·구를 <b className="text-foreground">길게 누르면</b> 그 위치에 새 차를 등록해요
        </div>
      )}

      {selfTeas.length > 0 && (
        <div className="absolute left-3 top-3 rounded-full border bg-card/90 px-3 py-1 text-xs shadow-sm backdrop-blur">
          이 지역 전역: <b>{selfTeas.length}종</b>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border bg-card/90 p-1 shadow-sm backdrop-blur">
        <Button size="icon-sm" variant="ghost" onClick={() => zoomBy(1.6)} aria-label="확대">
          <Plus />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => zoomBy(1 / 1.6)} aria-label="축소">
          <Minus />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={resetZoom} aria-label="원래 크기">
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
}
