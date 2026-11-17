// 중국 밖 산지를 지도에 더합니다. scripts/fetch-geo.mjs 다음에 실행하세요 (몇 번 실행해도 결과는 같음).
//   · 대만: 台湾 → 縣·市 22곳 → 鄉·鎮·市·區 368곳 (taiwan-atlas, 대만 내정부 국토측회중심 공개 자료, MIT)
//   · 일본: 나라 하나로만 (행정구역 구분 없음, world-atlas)
// 대만 구역 코드는 중국 행정구역 코드처럼 6자리로 만듭니다: 縣·市 71XX00, 鄉·鎮·區 71XXYY (공식 코드 순서대로 번호)
// 사용법: npm run geo:extra
import fs from "node:fs/promises";
import path from "node:path";
import { geoArea, geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { Topology } from "topojson-specification";
import { HanjaConverter, type HanjaData } from "@/lib/hanja";
import { JAPAN, TAIWAN, type RawRegion, type RegionIndex } from "@/lib/regions";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW_DIR = path.join(ROOT, ".cache/geo-raw");
const OUT_DIR = path.join(ROOT, "public/geo");
const INDEX_FILE = path.join(ROOT, "src/data/regions.json");
const TW_SRC = "https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/towns-10t.json";
const WORLD_SRC = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const JAPAN_ID = "392"; // ISO 3166-1 숫자 코드

type Geo = Polygon | MultiPolygon;
interface Props {
  adcode: string;
  name: string;
  level: string;
  center?: [number, number];
  centroid?: [number, number];
  childrenNum: number;
}

async function cached<T>(url: string, name: string): Promise<T> {
  const file = path.join(RAW_DIR, name);
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const text = await res.text();
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.writeFile(file, text);
  return JSON.parse(text);
}

// d3-geo 는 시계 방향 외곽선을 씁니다. 뒤집힌 다각형만 바로잡습니다 (fetch-geo.mjs 와 같음)
const fixPolygon = (poly: Position[][]) =>
  geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly;
function fixWinding<P>(f: Feature<Geo, P>): Feature<Geo, P> {
  const g = f.geometry;
  if (g.type === "Polygon") return { ...f, geometry: { ...g, coordinates: fixPolygon(g.coordinates) } };
  return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixPolygon) } };
}

const round = ([x, y]: number[]): [number, number] => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];

async function save(code: string, features: Feature<Geo, Props>[], keep: number) {
  let topo = topology({ regions: { type: "FeatureCollection", features } as FeatureCollection<Geo, Props> }, 1e5);
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, keep));
  await fs.writeFile(path.join(OUT_DIR, `${code}.json`), JSON.stringify(topo));
}

const hanja = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/hanja.json"), "utf8")) as HanjaData;
const conv = new HanjaConverter(hanja, []);
// 대만 자료는 번체: 색인은 다른 지역처럼 간체로 (臺 → 台 는 대만에서도 흔히 씀)
const simp = (s: string) => conv.simplify(s.replace(/臺/g, "台"));

const index = JSON.parse(await fs.readFile(INDEX_FILE, "utf8")) as RegionIndex;
// 예전에 넣은 대만 하위 구역·일본은 지우고 새로
for (const code of Object.keys(index)) if ((code.startsWith("71") && code !== TAIWAN) || code === JAPAN) delete index[code];

// ── 대만 ──────────────────────────────────────────────
interface TwProps {
  TOWNCODE: string;
  TOWNNAME: string;
  COUNTYCODE: string;
  COUNTYNAME: string;
}
const tw = await cached<Topology>(TW_SRC, "taiwan-towns-10t.json");
const twTowns = (feature(tw, tw.objects.towns) as unknown as FeatureCollection<Geo, TwProps>).features.map(fixWinding);
const twCounties = (feature(tw, tw.objects.counties) as unknown as FeatureCollection<Geo, TwProps>).features
  .map(fixWinding)
  .sort((a, b) => a.properties.COUNTYCODE.localeCompare(b.properties.COUNTYCODE));

const pad = (n: number) => String(n).padStart(2, "0");
const props = (f: Feature<Geo>, adcode: string, name: string, level: string, childrenNum: number): Props => {
  const c = round(geoCentroid(f));
  return { adcode, name, level, center: c, centroid: c, childrenNum };
};

const countyFeatures: Feature<Geo, Props>[] = [];
for (const [i, county] of twCounties.entries()) {
  const code = `71${pad(i + 1)}00`;
  const name = simp(county.properties.COUNTYNAME);
  const towns = twTowns
    .filter((t) => t.properties.COUNTYCODE === county.properties.COUNTYCODE)
    .sort((a, b) => a.properties.TOWNCODE.localeCompare(b.properties.TOWNCODE));
  if (towns.length > 99) throw new Error(`${name}: 향·진이 너무 많음`);
  const townFeatures = towns.map((t, j) => {
    const tcode = `71${pad(i + 1)}${pad(j + 1)}`;
    const tname = simp(t.properties.TOWNNAME);
    const p = props(t, tcode, tname, "district", 0);
    index[tcode] = { n: tname, l: "district", p: code, c: p.center, k: 0 } satisfies RawRegion;
    return { type: "Feature", geometry: t.geometry, properties: p } as Feature<Geo, Props>;
  });
  await save(code, townFeatures, 0.35);
  const p = props(county, code, name, "city", towns.length);
  index[code] = { n: name, l: "city", p: TAIWAN, c: p.center, k: towns.length };
  countyFeatures.push({ type: "Feature", geometry: county.geometry, properties: p });
}
await save(TAIWAN, countyFeatures, 0.12);
index[TAIWAN] = { ...index[TAIWAN], n: "台湾", k: countyFeatures.length };

// ── 일본 (전국 지도에 한 구역으로) ─────────────────────
const world = await cached<Topology>(WORLD_SRC, "world-countries-50m.json");
const jp = (feature(world, world.objects.countries) as unknown as FeatureCollection<Geo>).features.find(
  (f) => String(f.id) === JAPAN_ID,
);
if (!jp) throw new Error("일본 경계를 찾지 못했습니다.");
// 전국 지도와 비슷한 정도로 단순화
let jpTopo = topology({ jp: { type: "FeatureCollection", features: [fixWinding(jp)] } as FeatureCollection<Geo> }, 1e5);
jpTopo = presimplify(jpTopo);
jpTopo = simplify(jpTopo, quantile(jpTopo, 0.15));
const jpGeom = (feature(jpTopo, jpTopo.objects.jp) as unknown as FeatureCollection<Geo>).features[0].geometry;
const jpCenter: [number, number] = [139.691711, 35.689487]; // 東京
const jpFeature: Feature<Geo, Props> = fixWinding({
  type: "Feature",
  geometry: jpGeom,
  properties: { adcode: JAPAN, name: "日本", level: "province", center: jpCenter, centroid: [138.5, 36.2], childrenNum: 0 },
});
index[JAPAN] = { n: "日本", l: "province", p: null, c: jpCenter, k: 0 };

// 전국 지도(100000.json)는 이미 단순화된 상태라 그대로 풀어서 대만 이름·일본만 바꿔 다시 묶습니다
const nationFile = path.join(OUT_DIR, "100000.json");
const nation = JSON.parse(await fs.readFile(nationFile, "utf8")) as Topology;
const nationFeatures = (feature(nation, nation.objects.regions) as unknown as FeatureCollection<Geo, Props>).features
  .filter((f) => f.properties.adcode !== JAPAN)
  .map((f) =>
    f.properties.adcode === TAIWAN
      ? { ...f, properties: { ...f.properties, name: "台湾", childrenNum: countyFeatures.length } }
      : f,
  );
const merged = topology(
  { regions: { type: "FeatureCollection", features: [...nationFeatures, jpFeature] } as FeatureCollection<Geo, Props> },
  1e5,
);
await fs.writeFile(nationFile, JSON.stringify(merged));

await fs.writeFile(INDEX_FILE, JSON.stringify(index));
console.log(`대만 縣·市 ${countyFeatures.length}, 鄉·鎮·區 ${twTowns.length} · 일본 1 → 색인 ${Object.keys(index).length}곳`);
