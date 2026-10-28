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
  onRegionClick: (adcode: string, hasChildren: boolean) => void;
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

export function ChinaMap({ viewCode, focusCode, teas, conv, highlightTeaId, onRegionClick }: Props) {
  const [containerRef, { width, height }] = useSize<HTMLDivElement>();
  const [shapes, setShapes] = useState<{ code: string; features: RegionFeature[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
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

  const shapesData = useMemo(() => {
    if (!path || !projection) return [];
    return features.map((f) => {
      const p = f.properties;
      const c = p.centroid ?? p.center ?? geoCentroid(f);
      const pt = projection(c) ?? path.centroid(f);
      return { f, d: path(f) ?? "", area: path.area(f), x: pt[0], y: pt[1] };
    });
  }, [features, path, projection]);

  // 확대/이동
  useEffect(() => {
    if (!svgEl) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .on("zoom", (e) => setTransform(e.transform));
    zoomRef.current = z;
    const sel = select(svgEl);
    sel.call(z).on("dblclick.zoom", null);
    sel.call(z.transform, zoomIdentity);
    return () => {
      sel.on(".zoom", null);
    };
  }, [svgEl, viewCode]);

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

  const k = transform.k;
  const hovered = hover ? shapesData.find((s) => s.f.properties.adcode === hover.code) : null;
  const hoveredTeas = hover ? (regionTeas.get(hover.code) ?? []) : [];

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
            initial={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.06, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <filter id="land-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="oklch(0.4 0.03 60)" floodOpacity="0.18" />
              </filter>
            </defs>
            <g transform={transform.toString()}>
              <g filter="url(#land-shadow)">
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
                        const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                        setHover({ code, x: e.clientX - rect.left, y: e.clientY - rect.top });
                      }}
                      onClick={() => !decorative && onRegionClick(code, f.properties.childrenNum > 0)}
                    />
                  );
                })}
              </g>

              {/* 지명 */}
              {shapesData.map(({ f, area, x, y }) => {
                const code = f.properties.adcode;
                if (code.includes("_")) return null;
                const has = (regionTeas.get(code)?.length ?? 0) > 0;
                if (area * k * k < (has ? 900 : 2600)) return null;
                return (
                  <g key={`l-${code}`} transform={`translate(${x},${y + (has ? 24 / k : 0)}) scale(${1 / k})`} pointerEvents="none">
                    <text
                      textAnchor="middle"
                      className="font-zh"
                      style={{ fill: "var(--map-label)", fontSize: 11.5, fontWeight: 600, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3, strokeOpacity: 0.85 }}
                    >
                      {f.properties.name.replace(/(维吾尔|壮族|回族)?自治区$|省$|市$|特别行政区$/, "")}
                    </text>
                    {conv && (
                      <text
                        textAnchor="middle"
                        y={12}
                        style={{ fill: "var(--map-label)", fontSize: 9.5, opacity: 0.8, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3, strokeOpacity: 0.85 }}
                      >
                        {conv.toHangul(f.properties.name.replace(/(维吾尔|壮族|回族)?自治区$|省$|市$|特别行政区$/, ""))}
                      </text>
                    )}
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
                    <g transform={`scale(${1 / k})`}>
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
            </g>
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
            className="pointer-events-none absolute z-10 max-w-64 rounded-lg border bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, left: Math.min(hover.x + 14, width - 260), top: Math.max(hover.y - 12, 8) }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-zh text-base font-semibold">{hovered.f.properties.name}</span>
              {conv && <span className="text-xs text-muted-foreground">{conv.toHangul(hovered.f.properties.name)}</span>}
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
