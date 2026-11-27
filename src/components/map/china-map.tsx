"use client";

import { geoBounds, geoCentroid, geoConicEqualArea, geoContains, geoPath, type GeoPath, type GeoPermissibleObjects } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Loader2, Maximize, Minimize, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/categories";
import { loadLand, loadRegionShapes, type RegionFeature } from "@/lib/geo";
import type { Feature, MultiPolygon } from "geojson";
import { loadTowns, townPos, type TownFocus } from "@/lib/towns";
import type { HanjaConverter } from "@/lib/hanja";
import { CHINA } from "@/lib/regions";
import { LANDMARKS } from "@/data/landmarks";
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
  /** 차 목록을 아직 불러오는 중 */
  loading?: boolean;
  /** TV·프로젝터용 전체 화면 (멀리서 읽히게 글자를 키움) */
  presenting?: boolean;
  onTogglePresent?: () => void;
  /** 차 개수 표식을 눌렀을 때 (없으면 표식은 누를 수 없고 아래 구역이 눌림) */
  onCountClick?: (adcode: string) => void;
  /** 하위 구역 없이 지금 보는 구역 자체로 등록된 차의 표식·배지를 눌렀을 때 */
  onSelfTeasClick?: (adcode: string) => void;
  /** 세미나용 오늘의 차 (고른 순서). 그 산지 구역을 강조하고 번호 표식을 붙임 */
  todayTeas?: Tea[];
  /** 확대·축소 버튼 묶음 위에 덧붙일 버튼 (전체 화면에서도 보임) */
  extraControls?: React.ReactNode;
  /** 지역 이름 (옮겨 간 지역을 화면 가운데에 크게 띄웠다가 지움) */
  nameOf?: (code: string) => { zh: string; ko: string } | null;
}

/** 지도에 맞출 범위에서 뺄 구역 (남해 제도, 대만의 连江·金门 까지 맞추면 본섬이 너무 작아집니다) */
const FIT_EXCLUDE = new Set(["460300", "100000_JD", "710100", "710200"]);

/** 전국 지도에 맞출 모양: 실제 육지와 일본 (북위 17.5° 아래로만 있는 남해 섬들은 뺌) */
function mainland(features: RegionFeature[]): GeoPermissibleObjects {
  const polys = features
    .filter((f) => !f.properties.adcode.includes("_"))
    .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
    .filter((coordinates) => geoBounds({ type: "Polygon", coordinates })[1][1] >= 17.5);
  return { type: "MultiPolygon", coordinates: polys };
}

const NO_FEATURES: RegionFeature[] = [];
const NO_TEAS: Tea[] = [];

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

/** 확대 배율 k 에서 글자·표식에 줄 배율: 지도만큼은 아니어도 확대할수록 커짐 (k=2 → 1.2배, k=8 → 1.9배). 축소할 때는 크기 그대로 */
const csScale = (k: number) => (k < 1 ? 1 / k : k ** -0.7);

/** 선택한 구역 밖의 글자·표식을 흐리게 할 때 쓰는 클래스 */
const fade = (dim: boolean) => cn("transition-opacity duration-200", dim && "opacity-20");

type Box = [[number, number], [number, number]];
interface Geo {
  view: string;
  path: GeoPath;
  features: RegionFeature[];
  width: number;
  height: number;
}
/** 지도 svg 전체에 줄 이동·배율 (원점은 왼쪽 위) */
type Pose = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};
interface Flight {
  enter: Pose;
  exit: Pose;
  /** 들어가기(in)·나오기(out)·옆으로(across) */
  dir: "in" | "out" | "across";
}

/** code 가 a 의 하위 구역(또는 a 자체)인지: 행정구역 번호 앞자리로 판단 (성 xx0000 ⊃ 시 xxyy00 ⊃ 현 xxyyzz) */
function within(code: string, a: string) {
  if (a.includes("_") || code.includes("_")) return false;
  if (a === code || a === CHINA) return true;
  if (a.endsWith("0000")) return code.slice(0, 2) === a.slice(0, 2);
  if (a.endsWith("00")) return code.slice(0, 4) === a.slice(0, 4);
  return false;
}

/** 화면의 box 가 화면을 가득 채우도록 하는 자세 */
function fill([[x0, y0], [x1, y1]]: Box, w: number, h: number, opacity: number): Pose {
  const scale = Math.min(12, 0.9 * Math.min(w / Math.max(1, x1 - x0), h / Math.max(1, y1 - y0)));
  return { x: w / 2 - scale * ((x0 + x1) / 2), y: h / 2 - scale * ((y0 + y1) / 2), scale, opacity };
}
/** 화면 전체가 box 안으로 줄어드는 자세 (fill 의 반대) */
function shrinkInto(box: Box, w: number, h: number, opacity: number): Pose {
  const f = fill(box, w, h, opacity);
  return { x: -f.x / f.scale, y: -f.y / f.scale, scale: 1 / f.scale, opacity };
}
/** 가운데를 기준으로 배율만 바꾼 자세 */
const centered = (scale: number, w: number, h: number, opacity: number): Pose => ({
  x: (w / 2) * (1 - scale),
  y: (h / 2) * (1 - scale),
  scale,
  opacity,
});

function planFlight(prev: Geo, zt: ZoomTransform, next: Geo): Flight {
  const { width: w, height: h } = next;
  // 들어가기: 앞 지도에서 새 지역(또는 그 지역을 품은 구역)으로 확대해 들어감
  const into = within(next.view, prev.view) && prev.features.find((f) => within(next.view, f.properties.adcode));
  if (into) {
    const [[x0, y0], [x1, y1]] = prev.path.bounds(into);
    const box: Box = [zt.apply([x0, y0]), zt.apply([x1, y1])];
    return { dir: "in", exit: fill(box, w, h, 0), enter: centered(0.82, w, h, 0) };
  }
  // 나오기: 새 지도에서 앞 지역 자리를 가득 채운 채 시작해 물러남
  const from = within(prev.view, next.view) && next.features.find((f) => within(prev.view, f.properties.adcode));
  if (from) {
    const box = next.path.bounds(from) as Box;
    return { dir: "out", enter: fill(box, w, h, 0), exit: shrinkInto(box, w, h, 0) };
  }
  // 옆 지역으로: 물러났다가 다시 다가감
  return { dir: "across", exit: centered(0.6, w, h, 0), enter: centered(1.5, w, h, 0) };
}

const REST: Pose = { x: 0, y: 0, scale: 1, opacity: 1 };
const FLY_EASE = [0.65, 0, 0.35, 1] as const;
const mapVariants: Variants = {
  enter: (f: Flight | null) => f?.enter ?? { ...REST, opacity: 0, scale: 0.96 },
  rest: (f: Flight | null) => ({
    ...REST,
    transition: f
      ? { duration: 0.75, ease: FLY_EASE, opacity: { duration: 0.45, delay: f.dir === "in" ? 0.25 : 0.05 } }
      : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  }),
  exit: (f: Flight | null) => ({
    ...(f?.exit ?? { ...REST, opacity: 0, scale: 1.04 }),
    transition: f
      ? { duration: 0.75, ease: FLY_EASE, opacity: { duration: 0.4, delay: f.dir === "in" ? 0.3 : 0.2 } }
      : { duration: 0.35 },
  }),
};

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
  loading,
  presenting,
  onTogglePresent,
  onCountClick,
  onSelfTeasClick,
  todayTeas = NO_TEAS,
  extraControls,
  nameOf,
}: Props) {
  const [containerRef, { width, height }] = useSize<HTMLDivElement>();
  const [shapes, setShapes] = useState<{ code: string; features: RegionFeature[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // 마우스를 올린 구역 (구역이 바뀔 때만 다시 그림. 같은 구역 안에서는 툴팁을 tipRef 로 직접 옮김)
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // 확대·이동 중에는 React 로 다시 그리지 않고 <g> 의 transform 과 --k 만 바꿉니다. k 상태는 끝났을 때만 갱신
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  // 확대 상태는 끝났을 때만 갱신 (지역을 옮길 때 앞 지도가 어디를 보고 있었는지도 여기서 앎)
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity);
  const k = zt.k;
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // 지역을 옮기는 동안 앞·뒤 지도가 함께 있으므로, 사라지는 앞 지도가 null 로 지우지 않게 새 svg 만 받음
  const bindSvg = useCallback((el: SVGSVGElement | null) => {
    if (el) setSvgEl(el);
  }, []);
  // 전체 화면에서는 화면 높이에 맞춰 글자·표식을 키움 (1080p → 약 1.7배, 4K → 약 3.5배)
  const labelScale = presenting ? Math.min(3.6, Math.max(1.4, height / 620)) : 1;
  const labelScaleRef = useRef(labelScale);
  useEffect(() => {
    labelScaleRef.current = labelScale;
  }, [labelScale]);
  const cs = (k: number) => csScale(k) * labelScale;

  useEffect(() => {
    let alive = true;
    loadRegionShapes(viewCode)
      .then((features) => alive && setShapes({ code: viewCode, features }))
      .catch(() => alive && setFailed(viewCode));
    return () => {
      alive = false;
    };
  }, [viewCode]);

  // 세부 지역에 들어가면 주변 지역(전국의 성 + 같은 성의 다른 시)을 연하게 깔아 위치를 알 수 있게
  const [around, setAround] = useState<{ view: string; features: RegionFeature[] }>({ view: "", features: [] });
  useEffect(() => {
    if (viewCode === CHINA) return;
    const province = `${viewCode.slice(0, 2)}0000`;
    const layers = province === viewCode ? [CHINA] : [CHINA, province];
    let alive = true;
    Promise.all(layers.map((c) => loadRegionShapes(c)))
      .then((all) => {
        if (!alive) return;
        const list = all
          .flat()
          .filter((f) => {
            const c = f.properties.adcode;
            // 지금 보는 지역과 그 지역을 품은 성은 빼고 (그 자리는 위에 따로 그림)
            return !c.includes("_") && c !== viewCode && c !== province;
          });
        setAround({ view: viewCode, features: list });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [viewCode]);

  const features = useMemo(() => shapes?.features ?? NO_FEATURES, [shapes]);
  /** 지금 그려진 지도의 구역. 새 지역을 불러오는 동안에는 앞 지도를 그대로 두었다가, 다 불러오면 날아가듯 넘어감 */
  const view = shapes?.code ?? viewCode;
  const error = failed === viewCode ? "지도 데이터를 불러오지 못했습니다." : null;
  const ready = !!shapes && width > 0;

  const projection = useMemo(() => {
    if (!features.length || !width) return null;
    const fitTarget: GeoPermissibleObjects =
      view === CHINA
        ? mainland(features)
        : { type: "FeatureCollection", features: features.filter((f) => !FIT_EXCLUDE.has(f.properties.adcode)) };
    const [lon, lat] = geoCentroid(fitTarget);
    // 전국 지도는 여백을 줄여 꽉 차게
    const pad = view === CHINA ? Math.min(width, height) * 0.02 + 6 : Math.min(width, height) * 0.06 + 12;
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
  }, [features, width, height, view]);

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  // 바탕에 까는 중국 밖 육지
  const [land, setLand] = useState<Feature<MultiPolygon> | null>(null);
  useEffect(() => {
    loadLand()
      .then(setLand)
      .catch(() => {});
  }, []);
  const landPath = useMemo(() => (path && land ? (path(land) ?? "") : ""), [path, land]);
  const aroundPaths = useMemo(
    () => (path && around.view === view ? around.features.map((f) => ({ code: f.properties.adcode, d: path(f) ?? "" })) : []),
    [path, around, view],
  );

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

  /** 이름난 차산 (지금 보는 지역 안에 있는 것만) */
  const mountains = useMemo(() => {
    if (!projection || view === CHINA) return [];
    return LANDMARKS.filter((m) => m.path.includes(view)).flatMap((m) => {
      const pt = projection([m.lng, m.lat]);
      if (!pt) return [];
      // 대만은 번체, 나머지는 간체 (다른 지명과 맞춤)
      const name = m.path[0] === "710000" ? (m.trad ?? m.zh) : m.zh;
      // 산과 이름이 차지하는 대략의 영역 (산 밑변 가운데 기준, 화면 px) — 지명이 비켜 가도록
      const half = Math.max(16, (name.length * 11 + 4 + m.ko.length * 9.5) / 2);
      return [{ ...m, name, half, x: pt[0], y: pt[1], box: { left: -half, right: Math.max(20, half), top: -38, bottom: 16 } }];
    });
  }, [projection, view]);

  /** 현재 보고 있는 구역 자체(하위 구역 미지정)로 등록된 차 */
  const selfTeas = useMemo(
    () => (view === CHINA ? [] : teas.filter((t) => t.origins.some((o) => o.adcode === view))),
    [teas, view],
  );

  /** 세부 산지 위치 핀 (전국 지도에서는 너무 빽빽해 생략, 성을 눌러 들어가면 표시) */
  const pins = useMemo(() => {
    if (!projection || view === CHINA) return [];
    const m = new Map<string, { x: number; y: number; zh: string; ko: string; teas: Tea[]; codes: Set<string>; towns: Set<string> }>();
    for (const t of teas) {
      for (const o of t.origins) {
        const d = o.detail;
        if (!d || d.lng == null || d.lat == null || !o.path.includes(view)) continue;
        const key = `${d.lng},${d.lat}`;
        const pt = projection([d.lng, d.lat]);
        if (!pt) continue;
        const cur = m.get(key) ?? { x: pt[0], y: pt[1], zh: d.name_zh, ko: d.name_ko, teas: [], codes: new Set<string>(), towns: new Set<string>() };
        if (!cur.teas.includes(t)) cur.teas.push(t);
        for (const c of o.path) cur.codes.add(c);
        if (d.code) cur.towns.add(d.code);
        m.set(key, cur);
      }
    }
    // 이름은 시(지구)를 눌러 한 단계 더 들어갔을 때부터 (성 지도에서는 핀만).
    // 직할시처럼 성에서 바로 구가 나오는 곳은 처음부터
    const named = !/0000$/.test(view) || features[0]?.properties.level === "district";
    return [...m.values()].map((p) => {
      if (!named) return { ...p, lines: [], box: { left: -8, right: 8, top: -22, bottom: 0 } };
      // 장소 이름이 있으면 맨 위 줄에
      const lines = [
        ...(p.zh || p.ko ? [{ id: "", label: p.zh || p.ko, ko: p.zh ? p.ko : "", place: true, sites: 0 }] : []),
        ...p.teas.slice(0, 3).map((t) => ({
          id: t.id,
          label: t.name_zh || t.name_ko,
          ko: t.name_zh ? t.name_ko : "",
          place: false,
          // 산지가 여러 곳인 차는 이름 옆에 「N곳」 이 붙을 수 있어 자리를 넉넉히
          sites: t.origins.length,
        })),
        ...(p.teas.length > 3 ? [{ id: "", label: `외 ${p.teas.length - 3}종`, ko: "", place: false, sites: 0 }] : []),
      ];
      // 핀과 차 이름이 차지하는 대략의 영역 (핀 끝 기준, 화면 px) — 지명과 겹치는지 볼 때 씀
      const w = Math.max(...lines.map((l) => l.label.length * 10.5 + (l.ko ? 4 + l.ko.length * 9.5 : 0) + (l.sites > 1 ? 28 : 0)));
      return { ...p, lines, box: { left: -8, right: 9 + w, top: -22, bottom: -9 + (lines.length - 1) * 14 + 4 } };
    });
  }, [teas, projection, view, features]);

  // 현·구가 보이는 지도에서는 향·진 위치를 점으로 (OpenStreetMap 기준, 일부만 위치가 있음)
  const [towns, setTowns] = useState<{ view: string; list: (TownFocus & { x: number; y: number })[] }>({
    view: "",
    list: [],
  });
  useEffect(() => {
    // 향·진 목록은 중국 본토만 있음 (대만 71····, 일본은 없음)
    const leaves = features.filter(
      (f) => f.properties.childrenNum === 0 && /^\d{6}$/.test(f.properties.adcode) && !/^(71|99)/.test(f.properties.adcode),
    );
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
        setTowns({ view: view, list });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [features, projection, view, conv]);
  const townDots = towns.view === view ? towns.list : [];
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

  /**
   * 같은 차가 이 지도 안 여러 곳에서 날 때 (예: 东方美人 — 新竹县·桃园市·苗栗县) 그곳들의 위치.
   * 세부 산지 핀이 있으면 핀, 없으면 그 산지를 품은 구역의 차 표식 자리
   */
  const siteFinder = useMemo(() => {
    if (!projection) return null;
    const shapeAt = new Map(shapesData.filter((s) => !s.f.properties.adcode.includes("_")).map((s) => [s.f.properties.adcode, s]));
    /** 차가 이 지도에서 나는 자리들 (키: p경도,위도 = 핀, r구역코드 = 구역 표식 자리) */
    return (t: Tea) => {
      const seen = new Map<string, { x: number; y: number }>();
      for (const o of t.origins) {
        const d = o.detail;
        if (view !== CHINA && d?.lng != null && d.lat != null && o.path.includes(view)) {
          const pt = projection([d.lng, d.lat]);
          if (pt) {
            seen.set(`p${d.lng},${d.lat}`, { x: pt[0], y: pt[1] });
            continue;
          }
        }
        const s = shapeAt.get(o.path.find((c) => shapeAt.has(c)) ?? "");
        if (s) seen.set(`r${s.f.properties.adcode}`, { x: s.x, y: s.y });
      }
      return seen;
    };
  }, [projection, view, shapesData]);
  const teaSites = useMemo(() => {
    const out = new Map<string, { tea: Tea; pts: { x: number; y: number }[] }>();
    if (!siteFinder) return out;
    for (const t of teas) {
      const seen = siteFinder(t);
      if (seen.size > 1) out.set(t.id, { tea: t, pts: [...seen.values()] });
    }
    return out;
  }, [teas, siteFinder]);

  /** 오늘의 차가 나는 구역 (상위 구역 포함) */
  const todayCodes = useMemo(() => new Set(todayTeas.flatMap((t) => t.origins.flatMap((o) => o.path))), [todayTeas]);
  /** 오늘의 차 번호 표식: 같은 자리에 여러 차가 있으면 한 묶음으로 */
  const todayTags = useMemo(() => {
    if (!siteFinder) return [];
    const m = new Map<string, { x: number; y: number; pin: boolean; items: { tea: Tea; n: number }[] }>();
    todayTeas.forEach((tea, i) => {
      for (const [key, pt] of siteFinder(tea)) {
        const cur = m.get(key) ?? { ...pt, pin: key.startsWith("p"), items: [] };
        cur.items.push({ tea, n: i + 1 });
        m.set(key, cur);
      }
    });
    return [...m.entries()].map(([key, v]) => ({ key, ...v }));
  }, [todayTeas, siteFinder]);

  /** 그 위치들을 잇는 선: 가까운 곳끼리 이어지도록 최소 신장 트리로 (서너 곳이어도 선이 엉키지 않게) */
  const links = useMemo(
    () =>
      [...teaSites.values()].map(({ tea, pts }) => {
        const inTree = [0];
        const segs: [number, number, number, number][] = [];
        while (inTree.length < pts.length) {
          let best: [number, number, number] | null = null;
          for (const i of inTree) {
            for (let j = 0; j < pts.length; j++) {
              if (inTree.includes(j)) continue;
              const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
              if (!best || d < best[2]) best = [i, j, d];
            }
          }
          const [i, j] = best!;
          inTree.push(j);
          segs.push([pts[i].x, pts[i].y, pts[j].x, pts[j].y]);
        }
        return { tea, d: segs.map(([x1, y1, x2, y2]) => `M${x1},${y1}L${x2},${y2}`).join("") };
      }),
    [teaSites],
  );
  /** 이 지도 안에서 그 차가 나는 곳 수 (1곳이면 1) */
  const sitesOf = (id: string) => teaSites.get(id)?.pts.length ?? 1;

  /** 지금 보는 구역 자체로 등록된 차의 표식 위치: 지명과 가장 덜 겹치는 육지 (가운데에 가까울수록 좋음) */
  const selfMarkerPos = useMemo(() => {
    if (!selfTeas.length || !path || !projection?.invert) return null;
    const land = shapesData.filter((s) => !s.f.properties.adcode.includes("_"));
    if (!land.length) return null;
    const target: GeoPermissibleObjects = { type: "FeatureCollection", features: land.map((s) => s.f) };
    const [[x0, y0], [x1, y1]] = path.bounds(target);
    const [cx, cy] = path.centroid(target);
    const STEPS = 10;
    let best: { x: number; y: number; score: number } | null = null;
    for (let i = 0; i <= STEPS; i++) {
      for (let j = 0; j <= STEPS; j++) {
        const x = x0 + ((x1 - x0) * i) / STEPS;
        const y = y0 + ((y1 - y0) * j) / STEPS;
        const ll = projection.invert([x, y]);
        if (!ll || !land.some((s) => geoContains(s.f, ll))) continue;
        const gap = Math.min(...land.map((s) => Math.hypot(s.x - x, s.y - y)));
        const score = Math.min(gap, 90) - Math.hypot(cx - x, cy - y) * 0.05;
        if (!best || score > best.score) best = { x, y, score };
      }
    }
    return best;
  }, [selfTeas, path, projection, shapesData]);

  // 지역을 옮길 때 날아가듯: 들어갈 때는 누른 구역으로 확대해 들어가고, 나올 때는 그 구역에서 물러나며 넓은 지도가 펼쳐짐
  const geo = useMemo<Geo | null>(
    () => (path && width ? { view, path, features, width, height } : null),
    [view, path, features, width, height],
  );
  const [stage, setStage] = useState<{ geo: Geo | null; zt: ZoomTransform; flight: Flight | null }>({
    geo: null,
    zt: zoomIdentity,
    flight: null,
  });
  if (geo !== stage.geo) {
    const prev = stage.geo;
    const flight = !prev || !geo || prev.view === geo.view ? stage.flight : planFlight(prev, stage.zt, geo);
    setStage({ geo, zt, flight });
  } else if (zt !== stage.zt) {
    setStage({ ...stage, zt });
  }
  const flight = stage.flight;

  // 다른 지역으로 옮기거나 구역을 고르면 그 이름을 크게 띄움 (고른 구역을 풀 때는 띄우지 않음)
  const [seen, setSeen] = useState({ view: viewCode, focus: focusCode });
  const [banner, setBanner] = useState<{ id: number; zh: string; ko: string } | null>(null);
  if (seen.view !== viewCode || seen.focus !== focusCode) {
    const code = viewCode !== seen.view ? (focusCode ?? viewCode) : focusCode;
    setSeen({ view: viewCode, focus: focusCode });
    const name = code ? nameOf?.(code) : null;
    if (name?.zh) setBanner({ id: (banner?.id ?? 0) + 1, ...name });
  }
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1900);
    return () => window.clearTimeout(t);
  }, [banner]);

  // 확대/이동
  // 지역을 옮길 때는 앞 지도가 사라지는 동안 새 지도가 함께 그려지므로, svg 가 바뀔 때만 다시 붙임 (앞 지도는 그대로 둠)
  useEffect(() => {
    if (!svgEl) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      // 세부 지도에서는 주변 지역이 보이도록 처음보다 더 축소할 수 있게
      .scaleExtent([svgEl.dataset.view === CHINA ? 1 : 0.2, 14])
      .on("start", () => {
        svgEl.dataset.zooming = "1";
      })
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        const g = svgEl.querySelector<SVGGElement>(":scope > .map-zoom");
        if (g) {
          g.setAttribute("transform", e.transform.toString());
          // 글자·표식은 반대로 축소해 조금만 커지게 (CSS 변수는 하위 전체 스타일을 다시 계산하게 해서 느림)
          const inv = `scale(${csScale(e.transform.k) * labelScaleRef.current})`;
          for (const el of g.querySelectorAll(".map-cs")) el.setAttribute("transform", inv);
        }
      })
      .on("end", (e) => {
        delete svgEl.dataset.zooming;
        setZt(e.transform);
      });
    zoomRef.current = z;
    const sel = select(svgEl);
    sel.call(z).on("dblclick.zoom", null);
    sel.call(z.transform, zoomIdentity);
    return () => {
      sel.on(".zoom", null);
    };
  }, [svgEl]);

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
    if (!svgEl || svgEl.dataset.view !== view || !zoomRef.current || !path || !focusCode || focusCode === view) return;
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
  }, [focusCode, svgEl, path, features, width, height, view]);

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

  /** 선택한 구역: 이 구역 밖의 글자·표식은 흐리게 (겹쳐도 선택한 곳이 읽히도록) */
  const focusShape = focusCode ? shapesData.find((s) => s.f.properties.adcode === focusCode) : undefined;
  /** 지도에 찍힌 향·진을 골랐으면 그 향·진만 선명하게 (그 현·구의 이름과 다른 향·진도 흐리게) */
  const townSelected = focusShape && focusTownPt ? focusTown : null;

  const renderLabel = (shape: (typeof shapesData)[number]) => {
    const { f, area, x, y, label, labelKo } = shape;
    const code = f.properties.adcode;
    if (code.includes("_")) return null;
    const focused = shape === focusShape;
    const has = (regionTeas.get(code)?.length ?? 0) > 0;
    // 글자가 커지면 그만큼 넓은 구역에만 이름을 표시. 선택한 구역은 작아도 항상 표시
    if (!focused && area * k * k < (has ? 900 : 2600) * labelScale ** 2) return null;
    // 핀·차 이름과 겹치면 핀 위나 아래로 비켜 줌 (s: 지도 좌표 1px 당 글자 크기 비율)
    const s = cs(k);
    const hw = Math.max(label.length * 11.5, labelKo.length * 9.5) / 2 + 2;
    let dy = has ? 24 : 0;
    for (const p of [...pins, ...mountains]) {
      const top = y + (dy - 11) * s;
      const bottom = y + (dy + 16) * s;
      const pTop = p.y + p.box.top * s;
      const pBottom = p.y + p.box.bottom * s;
      if (x + hw * s < p.x + p.box.left * s || x - hw * s > p.x + p.box.right * s || bottom < pTop || top > pBottom) continue;
      const up = (pTop - y) / s - 18;
      const above = (top + bottom) / 2 < p.y + ((p.box.top + p.box.bottom) * s) / 2;
      // 위로 올리다 숫자 표식(가운데 원)에 걸리면 아래로
      dy = above && !(has && up + 16 > -18) ? up : (pBottom - y) / s + 13;
    }
    return (
      <g key={`l-${code}`} transform={`translate(${x},${y})`} pointerEvents="none" className={fade(!!focusShape && (!focused || !!townSelected))}>
        <g className="map-cs" transform={`scale(${s})`}>
        <g transform={`translate(0,${dy})`}>
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
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-map-sea">
      <AnimatePresence custom={flight}>
        {ready && path && (
          <motion.svg
            key={view}
            data-view={view}
            ref={bindSvg}
            width={width}
            height={height}
            className="absolute inset-0 touch-none select-none"
            style={{ originX: 0, originY: 0 }}
            custom={flight}
            variants={mapVariants}
            initial="enter"
            animate="rest"
            exit="exit"
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
            <g className="map-zoom">
              {landPath && (
                <path d={landPath} pointerEvents="none" vectorEffect="non-scaling-stroke" style={{ fill: "var(--map-world)", stroke: "var(--map-world-stroke)", strokeWidth: 0.6 }} />
              )}
              {/* 주변 지역 (연하게, 누를 수 없음) */}
              <g pointerEvents="none">
                {aroundPaths.map(({ code, d }) => (
                  <path
                    key={`a-${code}`}
                    d={d}
                    vectorEffect="non-scaling-stroke"
                    style={{ fill: "var(--map-land)", fillOpacity: 0.35, stroke: "var(--map-stroke)", strokeWidth: 0.6, strokeOpacity: 0.6 }}
                  />
                ))}
              </g>
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

              {/* 오늘의 차가 나는 구역: 금빛 테두리와 은은하게 숨쉬는 바탕 */}
              {todayCodes.size > 0 && (
                <g pointerEvents="none">
                  {shapesData.map(({ f, d }) =>
                    todayCodes.has(f.properties.adcode) ? (
                      <motion.path
                        key={`today-${f.properties.adcode}`}
                        d={d}
                        vectorEffect="non-scaling-stroke"
                        style={{ fill: "var(--today)", stroke: "var(--today)", strokeWidth: 3, strokeLinejoin: "round" }}
                        initial={{ fillOpacity: 0.12, strokeOpacity: 0.9 }}
                        animate={{ fillOpacity: [0.12, 0.3, 0.12], strokeOpacity: 0.95 }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                    ) : null,
                  )}
                </g>
              )}

              {/* 지명 (선택한 구역의 이름은 맨 위에 따로 그림) */}
              {shapesData.map((shape) => (shape === focusShape ? null : renderLabel(shape)))}

              {/* 같은 차가 나는 여러 곳을 잇는 점선 (차 표식·핀 아래에, 목록에서 그 차에 마우스를 올리면 진하게) */}
              <g pointerEvents="none" className={fade(!!focusShape)}>
                {links.map(({ tea, d }) => {
                  const on = highlightTeaId === tea.id;
                  // 전국 지도에서는 선이 너무 많아질 수 있어 고른 차만
                  if (view === CHINA && !on) return null;
                  return (
                    <path
                      key={`link-${tea.id}`}
                      d={d}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                      className="transition-[stroke-width,opacity] duration-200"
                      style={{
                        stroke: CATEGORY_META[tea.category].color,
                        strokeWidth: on ? 2.8 : 1.8,
                        strokeDasharray: on ? "none" : "6 4",
                        strokeLinecap: "round",
                        opacity: on ? 1 : highlightTeaId ? 0.15 : 0.8,
                      }}
                    />
                  );
                })}
              </g>

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
                    <g className={cn("map-cs", fade(!!focusShape && (code !== focusCode || !!townSelected)))} transform={`scale(${cs(k)})`}>
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
                      <g
                        pointerEvents={onCountClick ? "auto" : "none"}
                        className={onCountClick ? "cursor-pointer" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCountClick?.(code);
                        }}
                      >
                        <circle r={r} fill={CATEGORY_META[cat].color} stroke="var(--map-land)" strokeWidth={2} />
                        <text textAnchor="middle" dy="0.36em" fill="white" style={{ fontSize: 11, fontWeight: 700 }}>
                          {list.length}
                        </text>
                      </g>
                    </g>
                  </motion.g>
                );
              })}

              {/* 지금 보는 구역 자체로 등록된 차 (하위 구역 표식에는 잡히지 않음) */}
              {selfMarkerPos && (
                <motion.g
                  key={`self-${view}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
                  style={{ x: selfMarkerPos.x, y: selfMarkerPos.y }}
                  pointerEvents="none"
                >
                  <g className={cn("map-cs", fade(!!focusShape))} transform={`scale(${cs(k)})`}>
                    <g
                      pointerEvents={onSelfTeasClick ? "auto" : "none"}
                      className={onSelfTeasClick ? "cursor-pointer" : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelfTeasClick?.(view);
                      }}
                    >
                      <title>{`이 지역 전역으로 등록된 차 ${selfTeas.length}종`}</title>
                      <circle
                        r={13 + Math.min(selfTeas.length, 12) * 0.7}
                        fill="none"
                        stroke={CATEGORY_META[dominantCategory(selfTeas)!].color}
                        strokeWidth={1.5}
                        strokeDasharray="3 2.5"
                      />
                      <circle r={8 + Math.min(selfTeas.length, 12) * 0.7} fill={CATEGORY_META[dominantCategory(selfTeas)!].color} stroke="var(--map-land)" strokeWidth={2} />
                      <text textAnchor="middle" dy="0.36em" fill="white" style={{ fontSize: 11, fontWeight: 700 }}>
                        {selfTeas.length}
                      </text>
                      <text
                        textAnchor="middle"
                        y={30}
                        style={{ fill: "var(--map-label)", fontSize: 10.5, fontWeight: 600, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3, strokeOpacity: 0.85 }}
                      >
                        전역
                      </text>
                    </g>
                  </g>
                </motion.g>
              )}

              {/* 향·진 위치 */}
              {/* 선택한 현·구의 향·진이 위에 오도록 뒤에 그림 */}
              {[...townDots].sort((a, b) => Number(a.county === focusCode) - Number(b.county === focusCode)).map((t) => {
                const show = k >= 2.2 || focusCode === t.county;
                const dim = !!focusShape && (t.county !== focusCode || !!townSelected);
                if (focusTown?.code === t.code) return null;
                return (
                  <g
                    key={t.code}
                    transform={`translate(${t.x},${t.y})`}
                    className={cn(fade(dim), dim && "hover:opacity-100", onTownClick && "group cursor-pointer")}
                    pointerEvents={onTownClick ? "auto" : "none"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTownClick?.({ code: t.code, county: t.county, zh: t.zh, ko: t.ko, lng: t.lng, lat: t.lat });
                    }}
                  >
                    <title>{`${t.zh} ${t.ko}`}</title>
                    <g className="map-cs" transform={`scale(${cs(k)})`}>
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

              {/* 이름난 차산: 산 모양, 이름은 꼭대기 위에 (향·진 이름 위, 핀 아래에 그림) */}
              {(() => {
                // 가까운 산끼리 (예: 사자봉·오운산) 이름이 겹치면 뒤의 산 이름은 아래로
                const sc = cs(k);
                /** 이미 자리 잡은 이름 줄과 산 모양 (지도 좌표, [왼, 위, 오른, 아래]) */
                const taken: [number, number, number, number][] = mountains.map((p) => [p.x - 17 * sc, p.y - 22 * sc, p.x + 21 * sc, p.y]);
                /** 이름을 놓아 볼 자리: 꼭대기 위 → 밑변 아래 → 오른쪽 → 왼쪽 (x·y 는 글자 기준점, 화면 px) */
                const SPOTS = [
                  { x: 0, y: -26, anchor: "middle" },
                  { x: 0, y: 12, anchor: "middle" },
                  { x: 23, y: -6, anchor: "start" },
                  { x: -19, y: -6, anchor: "end" },
                ] as const;
                /** 이름 줄 영역 (지도 좌표, [왼, 위, 오른, 아래]) */
                const line = (m: (typeof mountains)[number], spot: (typeof SPOTS)[number]): [number, number, number, number] => {
                  const w = m.half * 2;
                  const left = spot.anchor === "middle" ? spot.x - m.half : spot.anchor === "start" ? spot.x : spot.x - w;
                  return [m.x + left * sc, m.y + (spot.y - 11) * sc, m.x + (left + w) * sc, m.y + (spot.y + 3) * sc];
                };
                const hits = (r: [number, number, number, number], self: number) =>
                  taken.some((t, i) => i !== self && r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);
                // 위쪽 산부터 이름을 놓고, 빈자리가 없으면 이름은 숨김 (확대하면 나타남)
                return mountains
                  .map((m, i) => ({ m, i }))
                  .sort((a, b) => a.m.y - b.m.y)
                  .map(({ m, i }) => {
                    const spot = SPOTS.find((sp) => !hits(line(m, sp), i)) ?? null;
                    if (spot) taken.push(line(m, spot));
                    return { m, spot };
                  });
              })().map(({ m, spot }) => (
                <g key={`mt-${m.id}`} transform={`translate(${m.x},${m.y})`} pointerEvents="none">
                  <g className="map-cs" transform={`scale(${cs(k)})`}>
                    <motion.g
                      initial={{ scale: 0.4, opacity: 0, y: 6 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                    >
                      <title>{`${[m.zh, m.trad].filter(Boolean).join(" · ")} ${m.ko}${m.note ? `\n${m.note}` : ""}`}</title>
                      {/* 뒤 봉우리 · 앞 봉우리 · 눈 덮인 꼭대기 (밑변이 실제 위치) */}
                      <path d="M2 0 L11 -13 L20 0 Z" style={{ fill: "var(--map-mountain-back)", stroke: "var(--map-land)", strokeWidth: 1.2, strokeLinejoin: "round" }} />
                      <path d="M-16 0 L-2 -21 L12 0 Z" style={{ fill: "var(--map-mountain)", stroke: "var(--map-land)", strokeWidth: 1.4, strokeLinejoin: "round" }} />
                      <path d="M-6.7 -14 L-2 -21 L2.7 -14 L0.5 -15.5 L-2 -13.5 L-4.3 -15.5 Z" style={{ fill: "var(--map-mountain-cap)" }} />
                      {spot && (
                        <text
                          textAnchor={spot.anchor}
                          x={spot.x}
                          y={spot.y}
                          className="font-zh"
                          style={{ fill: "var(--map-mountain)", fontSize: 11, fontWeight: 700, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3 }}
                        >
                          {m.name}
                          <tspan style={{ fontSize: 9.5, fontWeight: 500 }}> {m.ko}</tspan>
                        </text>
                      )}
                    </motion.g>
                  </g>
                </g>
              ))}

              {/* 세부 산지 핀 */}
              {pins.map((p) => (
                <g
                  key={`p-${p.x},${p.y}`}
                  transform={`translate(${p.x},${p.y})`}
                  className={fade(!!focusShape && !(townSelected ? p.towns.has(townSelected.code) : p.codes.has(focusShape.f.properties.adcode)))}
                >
                  <g className="map-cs" transform={`scale(${cs(k)})`}>
                  <title>{`${[p.zh, p.ko].filter(Boolean).join(" ") || "이름 없는 위치"}\n${p.teas.map((t) => [t.name_zh, t.name_ko].filter(Boolean).join(" ")).join(", ")}`}</title>
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
                  {p.lines.map(
                      ({ id, label, ko, place }, i) => (
                        <text
                          key={id || (place ? "place" : "more")}
                          x={9}
                          y={-9 + i * 14}
                          className={cn("font-zh", id && onTeaClick && "cursor-pointer hover:underline")}
                          pointerEvents={id && onTeaClick ? "auto" : "none"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (id) onTeaClick?.(id);
                          }}
                          style={{ fill: place ? "var(--seal)" : "var(--map-label)", fontSize: 10.5, fontWeight: place ? 700 : id ? 600 : 400, paintOrder: "stroke", stroke: "var(--map-land)", strokeWidth: 3 }}
                        >
                          {label}
                          {ko && <tspan style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.8 }}> {ko}</tspan>}
                          {id && sitesOf(id) > 1 && (
                            <tspan style={{ fill: "var(--seal)", fontSize: 9, fontWeight: 700 }}> ·{sitesOf(id)}곳</tspan>
                          )}
                        </text>
                      ),
                    )}
                  </g>
                </g>
              ))}

              {focusShape && renderLabel(focusShape)}

              {/* 오늘의 차 번호 표식 (핀이면 핀 머리 위, 구역이면 차 개수 표식 위) */}
              {todayTags.map(({ key, x, y, pin, items }) => (
                <g key={`tt-${key}`} transform={`translate(${x},${y})`}>
                  <g className="map-cs" transform={`scale(${cs(k)})`}>
                    <motion.g
                      initial={{ scale: 0, y: 8, opacity: 0 }}
                      animate={{ scale: 1, y: pin ? -30 : -24, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.3 }}
                    >
                      {items.map(({ tea, n }, i) => {
                        const label = tea.name_zh || tea.name_ko;
                        const w = 24 + label.length * 12;
                        const top = -(items.length - i) * 22;
                        return (
                          <g
                            key={tea.id}
                            transform={`translate(${-w / 2},${top})`}
                            className={onTeaClick ? "cursor-pointer" : undefined}
                            pointerEvents={onTeaClick ? "auto" : "none"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTeaClick?.(tea.id);
                            }}
                          >
                            <title>{`오늘의 차 ${n}. ${[tea.name_zh, tea.name_ko].filter(Boolean).join(" ")}`}</title>
                            <rect
                              width={w}
                              height={19}
                              rx={9.5}
                              style={{ fill: "var(--card)", stroke: "var(--today)", strokeWidth: 1.8, filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.18))" }}
                            />
                            <circle cx={9.5} cy={9.5} r={7} fill={CATEGORY_META[tea.category].color} />
                            <text x={9.5} y={9.5} dy="0.36em" textAnchor="middle" fill="white" style={{ fontSize: 9, fontWeight: 700 }}>
                              {n}
                            </text>
                            <text x={20} y={9.5} dy="0.36em" className="font-zh" style={{ fill: "var(--foreground)", fontSize: 11.5, fontWeight: 700 }}>
                              {label}
                            </text>
                          </g>
                        );
                      })}
                    </motion.g>
                  </g>
                </g>
              ))}

              {/* 고른 향·진 (다시 누르면 선택 해제) */}
              {focusTown && focusTownPt && (
                <g
                  transform={`translate(${focusTownPt[0]},${focusTownPt[1]})`}
                  className={onTownClick ? "cursor-pointer" : undefined}
                  pointerEvents={onTownClick ? "auto" : "none"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTownClick?.(focusTown);
                  }}
                >
                  <g className="map-cs" transform={`scale(${cs(k)})`}>
                  <circle r={10} fill="transparent" />
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

      <AnimatePresence>
        {banner && <RegionBanner key={banner.id} zh={banner.zh} ko={banner.ko} big={presenting} />}
      </AnimatePresence>

      {(!ready || !path) && !error && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground" role="status">
          <div className="flex flex-col items-center gap-2 text-sm">
            <Loader2 className="size-6 animate-spin" />
            지도를 불러오는 중…
          </div>
        </div>
      )}
      {/* 지도는 그려졌지만 차 정보가 아직일 때 */}
      <AnimatePresence>
        {ready && path && loading && !error && (
          <motion.div
            key="loading"
            role="status"
            className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="size-3.5 animate-spin" />
            차 정보를 불러오는 중…
          </motion.div>
        )}
      </AnimatePresence>
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
                    {sitesOf(t.id) > 1 && <span className="font-medium text-seal">· {sitesOf(t.id)}곳</span>}
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

      {selfTeas.length > 0 && (
        <button
          type="button"
          disabled={!onSelfTeasClick}
          onClick={() => onSelfTeasClick?.(view)}
          className={cn(
            "absolute top-14 left-3 cursor-pointer rounded-full border bg-card/90 px-3 py-1 shadow-sm backdrop-blur hover:bg-muted",
            presenting ? "text-base" : "text-xs",
          )}
        >
          이 지역 전역: <b>{selfTeas.length}종</b>
        </button>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border bg-card/90 p-1 shadow-sm backdrop-blur">
        {extraControls}
        <Button size="icon-sm" variant="ghost" onClick={() => zoomBy(1.6)} aria-label="확대">
          <Plus />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => zoomBy(1 / 1.6)} aria-label="축소">
          <Minus />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={resetZoom} aria-label="원래 크기">
          <RotateCcw />
        </Button>
        {onTogglePresent && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onTogglePresent}
            aria-label={presenting ? "전체 화면 끝내기" : "지도만 전체 화면으로"}
            title={presenting ? "전체 화면 끝내기 (Esc)" : "지도만 전체 화면으로 (TV·프로젝터)"}
          >
            {presenting ? <Minimize /> : <Maximize />}
          </Button>
        )}
      </div>
    </div>
  );
}

/** 옮겨 간 지역 이름: 한자가 한 글자씩 먹이 번지듯 떠오르고, 붉은 선이 그어진 뒤 한글이 따라 나옴 */
function RegionBanner({ zh, ko, big }: { zh: string; ko: string; big?: boolean }) {
  const chars = [...zh];
  const ease = [0.22, 1, 0.36, 1] as const;
  return (
    <motion.div
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -14, filter: "blur(8px)", transition: { duration: 0.5, ease: [0.4, 0, 1, 1] } }}
    >
      {/* 글자 뒤 은은한 안개 (지도 위에서도 읽히게) */}
      <motion.div
        className="absolute h-[60%] w-[min(90%,52rem)] rounded-[50%] bg-map-sea/70 blur-3xl"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease }}
      />
      <div className="relative flex flex-col items-center px-4 text-center">
        <div
          className={cn(
            "flex font-zh leading-none font-bold text-foreground",
            big ? "text-[clamp(4rem,11vh,9rem)]" : "text-[clamp(2.75rem,9vw,5.5rem)]",
          )}
          style={{ letterSpacing: "0.12em", marginRight: "-0.12em", textShadow: "0 2px 24px var(--map-sea), 0 0 2px var(--map-sea)" }}
        >
          {chars.map((c, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 18, scale: 1.25, filter: "blur(14px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.07, ease }}
            >
              {c}
            </motion.span>
          ))}
        </div>
        <motion.div
          className={cn("bg-seal", big ? "mt-6 h-1" : "mt-4 h-0.5")}
          style={{ width: "min(14rem, 60%)", originX: 0.5 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 + chars.length * 0.07, ease }}
        />
        {ko && (
          <motion.div
            className={cn("font-serif font-medium text-foreground/80", big ? "mt-5 text-4xl" : "mt-3 text-xl sm:text-2xl")}
            style={{ textShadow: "0 1px 12px var(--map-sea)" }}
            initial={{ opacity: 0, y: 8, letterSpacing: "0.6em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.32em" }}
            transition={{ duration: 0.8, delay: 0.4 + chars.length * 0.07, ease }}
          >
            {ko}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
