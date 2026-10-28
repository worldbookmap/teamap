import { geoArea } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

export interface RegionProps {
  adcode: string;
  name: string;
  level: string;
  center?: [number, number];
  centroid?: [number, number];
  childrenNum: number;
}
export type RegionFeature = Feature<Polygon | MultiPolygon, RegionProps>;

const cache = new Map<string, Promise<RegionFeature[]>>();

function fixPolygon(poly: Position[][]) {
  return geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly;
}

/** 단순화 과정에서 방향이 뒤집힌 작은 다각형을 바로잡습니다 */
function fixWinding(f: RegionFeature): RegionFeature {
  const g = f.geometry;
  if (geoArea(f) <= 2 * Math.PI) return f;
  if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: fixPolygon(g.coordinates) } };
  return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixPolygon) } };
}

/** public/geo/{adcode}.json (scripts/fetch-geo.mjs 로 생성) 의 하위 구역 경계 */
export function loadRegionShapes(adcode: string): Promise<RegionFeature[]> {
  let p = cache.get(adcode);
  if (!p) {
    p = fetch(`/geo/${adcode}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`geo ${adcode}: ${r.status}`);
        return r.json() as Promise<Topology>;
      })
      .then((topo) => {
        const fc = feature(topo, topo.objects.regions) as unknown as FeatureCollection<Polygon | MultiPolygon, RegionProps>;
        return fc.features.map(fixWinding);
      });
    p.catch(() => cache.delete(adcode));
    cache.set(adcode, p);
  }
  return p;
}
