// 阿里云 DataV 행정구역 경계 데이터를 내려받아 TopoJSON으로 압축해 public/geo 에 저장합니다.
//   전국(100000) → 성(省) → 지급시(地级市) → 현/구(县/区)
// 사용법: node scripts/fetch-geo.mjs [--refresh]
import fs from "node:fs/promises";
import path from "node:path";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { geoArea } from "d3-geo";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW_DIR = path.join(ROOT, ".cache/geo-raw");
const OUT_DIR = path.join(ROOT, "public/geo");
const BASE = "https://geo.datav.aliyun.com/areas_v3/bound";
const REFRESH = process.argv.includes("--refresh");

await fs.mkdir(RAW_DIR, { recursive: true });
await fs.mkdir(OUT_DIR, { recursive: true });

async function fetchRaw(adcode) {
  const file = path.join(RAW_DIR, `${adcode}_full.json`);
  if (!REFRESH) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {}
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}/${adcode}_full.json`);
    if (res.status === 404 || res.status === 403) return null; // 하위 구역이 없는 지역 (예: 东莞市)
    if (res.ok) {
      const text = await res.text();
      await fs.writeFile(file, text);
      return JSON.parse(text);
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(`failed: ${adcode}`);
}

// DataV 는 대부분 RFC7946(반시계) 방향이라 d3-geo(시계 방향 외곽선)에서 뒤집혀 그려집니다.
// 다각형마다 면적을 재서 뒤집힌 것만 고리 방향을 바꿉니다.
function fixPolygon(poly) {
  return geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? poly.map((ring) => [...ring].reverse()) : poly;
}
function fixWinding(f) {
  const g = f.geometry;
  if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: fixPolygon(g.coordinates) } };
  if (g.type === "MultiPolygon") return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixPolygon) } };
  return f;
}

// 단계별 단순화 강도 (전국 지도는 크게, 현 단위는 세밀하게)
function compress(geojson, keep) {
  const features = geojson.features
    .filter((f) => f.geometry && f.properties?.adcode)
    .map(fixWinding)
    .map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        adcode: String(f.properties.adcode),
        name: f.properties.name,
        level: f.properties.level,
        center: f.properties.center,
        centroid: f.properties.centroid,
        childrenNum: f.properties.childrenNum ?? 0,
      },
    }));
  let topo = topology({ regions: { type: "FeatureCollection", features } }, 1e5);
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, keep));
  return topo;
}

async function save(adcode, geojson, keep) {
  const topo = compress(geojson, keep);
  await fs.writeFile(path.join(OUT_DIR, `${adcode}.json`), JSON.stringify(topo));
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

const index = {}; // adcode -> { n: 이름, l: 단계, p: 상위 adcode, c: 중심 좌표, k: 하위 구역 수 }
const register = (geo, parent) => {
  for (const f of geo.features) {
    const p = f.properties;
    if (!p?.adcode || String(p.adcode).includes("_")) continue;
    index[p.adcode] = { n: p.name, l: p.level, p: parent == null ? null : String(parent), c: p.center, k: p.childrenNum ?? 0 };
  }
};

const china = await fetchRaw(100000);
register(china, null);
await save(100000, china, 0.15);

const provinces = china.features.map((f) => f.properties).filter((p) => p.adcode && p.childrenNum > 0);
const cities = [];

await pool(provinces, 6, async (prov) => {
  const geo = await fetchRaw(prov.adcode);
  if (!geo) return;
  register(geo, prov.adcode);
  await save(prov.adcode, geo, 0.3);
  for (const f of geo.features) {
    const p = f.properties;
    if (p.level === "city" && p.childrenNum > 0) cities.push(p);
  }
  process.stdout.write(`省 ${prov.name} ✓\n`);
});

let done = 0;
await pool(cities, 8, async (city) => {
  const geo = await fetchRaw(city.adcode);
  done++;
  if (!geo) return;
  register(geo, city.adcode);
  await save(city.adcode, geo, 0.5);
  if (done % 40 === 0) process.stdout.write(`市 ${done}/${cities.length}\n`);
});

// 경계 파일이 없는 지역(하위 구역 데이터 없음)은 더 이상 들어갈 수 없는 말단으로 표시
const files = new Set(await fs.readdir(OUT_DIR));
for (const [code, r] of Object.entries(index)) if (!files.has(`${code}.json`)) r.k = 0;
await fs.writeFile(path.join(ROOT, "src/data/regions.json"), JSON.stringify(index));
console.log(`완료: 성 ${provinces.length}, 시 ${cities.length}, 전체 구역 ${Object.keys(index).length}`);
