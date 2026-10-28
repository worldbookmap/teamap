"use client";

import { geoCentroid, geoConicEqualArea, geoPath } from "d3-geo";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadRegionShapes, type RegionFeature } from "@/lib/geo";

const W = 480;
const H = 260;

/** 현·구 하나를 그려 놓고 눌러서 위치(경위도)를 찍는 작은 지도 */
export function CountyPinMap({
  adcode,
  parentCode,
  value,
  onChange,
  towns = [],
}: {
  adcode: string;
  /** 이 현의 경계가 들어 있는 상위 구역 지도 (시 또는 직할시) */
  parentCode: string;
  value: { lng: number; lat: number } | null;
  onChange: (v: { lng: number; lat: number }) => void;
  /** 참고용 향·진 위치 */
  towns?: { zh: string; lng: number; lat: number }[];
}) {
  const [feature, setFeature] = useState<RegionFeature | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadRegionShapes(parentCode)
      .then((fs) => alive && setFeature(fs.find((f) => f.properties.adcode === adcode) ?? null))
      .catch(() => alive && setFeature(null));
    return () => {
      alive = false;
    };
  }, [adcode, parentCode]);

  const projection = useMemo(() => {
    if (!feature) return null;
    const [lon] = geoCentroid(feature);
    return geoConicEqualArea()
      .rotate([-lon, 0])
      .parallels([20, 40])
      .fitExtent(
        [
          [16, 16],
          [W - 16, H - 16],
        ],
        feature,
      );
  }, [feature]);

  if (feature === undefined) {
    return (
      <div className="grid h-40 place-items-center rounded-lg border bg-map-sea text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!feature || !projection) {
    return <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">이 지역의 지도 경계가 없어 위치를 찍을 수 없습니다.</p>;
  }

  const d = geoPath(projection)(feature) ?? "";
  const pin = value ? projection([value.lng, value.lat]) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full cursor-crosshair rounded-lg border bg-map-sea"
      onClick={(e) => {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const local = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        const ll = projection.invert?.([local.x, local.y]);
        if (ll) onChange({ lng: ll[0], lat: ll[1] });
      }}
    >
      <path d={d} style={{ fill: "var(--map-land)", stroke: "var(--map-stroke)", strokeWidth: 1.2 }} />
      {towns.map((t) => {
        const p = projection([t.lng, t.lat]);
        if (!p) return null;
        return (
          <g key={`${t.zh}${t.lng}`} transform={`translate(${p[0]},${p[1]})`} pointerEvents="none">
            <circle r={2} style={{ fill: "var(--map-label)", opacity: 0.6 }} />
            <text x={3.5} y={3} className="font-zh" style={{ fill: "var(--map-label)", fontSize: 8.5, opacity: 0.75 }}>
              {t.zh}
            </text>
          </g>
        );
      })}
      {pin && (
        <g transform={`translate(${pin[0]},${pin[1]})`} pointerEvents="none">
          <path d="M0 0 C -7 -10 -9 -14 -9 -18 A 9 9 0 1 1 9 -18 C 9 -14 7 -10 0 0 Z" style={{ fill: "var(--seal)", stroke: "white", strokeWidth: 1.5 }} />
          <circle cy={-18} r={3.2} fill="white" />
        </g>
      )}
    </svg>
  );
}
