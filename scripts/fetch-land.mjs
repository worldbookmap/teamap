// 중국 바깥 육지(주변국)를 지도 바탕에 깔기 위해 world-atlas 의 육지 경계를 받아
// 중국 주변만 남겨 public/geo/land.json (TopoJSON) 으로 저장합니다.
// 사용법: node scripts/fetch-land.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { geoBounds } from "d3-geo";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json";
// 중국과 그 주변 (경도 40~170, 위도 -15~75)
const BOX = { w: 40, e: 170, s: -15, n: 75 };

const res = await fetch(SRC);
if (!res.ok) throw new Error(`failed: ${res.status}`);
const world = await res.json();
const land = feature(world, world.objects.land);
const polys = (land.type === "FeatureCollection" ? land.features : [land])
  .flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates))
  .filter((coordinates) => {
    const [[w, s], [e, n]] = geoBounds({ type: "Polygon", coordinates });
    // 날짜변경선을 넘는 다각형(유라시아 동쪽 끝)은 w > e 로 나옵니다
    return n >= BOX.s && s <= BOX.n && (w > e || (e >= BOX.w && w <= BOX.e));
  });

let topo = topology({ land: { type: "MultiPolygon", coordinates: polys } }, 1e5);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.15));
const out = path.join(ROOT, "public/geo/land.json");
await fs.writeFile(out, JSON.stringify(topo));
console.log(`${polys.length} polygons → ${out} (${((await fs.stat(out)).size / 1024).toFixed(0)} KB)`);
