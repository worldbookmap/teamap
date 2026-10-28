// 향·진(乡镇) 목록에 위치(경위도)를 붙입니다.
// OpenStreetMap 의 town/township/suburb 지점을 성(省)별로 받아, 같은 이름이면서 그 현·구 경계 안에 있는 지점을 찾습니다.
// 지도 데이터 © OpenStreetMap contributors (ODbL) — 앱 지도에 출처를 표시합니다.
//
// 사용법: node scripts/build-town-points.mjs [--refresh]
//   입력: public/towns/{현}.json = [[코드, 이름], …], public/geo/*.json, src/data/regions.json
//   출력: public/towns/{현}.json = [[코드, 이름, 경도?, 위도?], …], public/towns/_index.json (전체 검색용)
import fs from "node:fs/promises";
import path from "node:path";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TOWNS = path.join(ROOT, "public/towns");
const GEO = path.join(ROOT, "public/geo");
const CACHE = path.join(ROOT, ".cache/osm");
const REFRESH = process.argv.includes("--refresh");
const OVERPASS = "https://overpass-api.de/api/interpreter";

const regions = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/regions.json"), "utf8"));
await fs.mkdir(CACHE, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 성 하나의 OSM 지점 (캐시) */
async function fetchProvince(code, name) {
  const file = path.join(CACHE, `${code}.json`);
  if (!REFRESH) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {}
  }
  // 성 이름에 다른 문자가 붙어 있을 수 있어(内蒙古 등) name 과 name:zh 둘 다로 찾습니다
  const query = `[out:json][timeout:180];(area["admin_level"="4"]["name"="${name}"];area["admin_level"="4"]["name:zh"="${name}"];area["admin_level"="4"]["name:zh-Hans"="${name}"];)->.a;node(area.a)["place"~"^(town|township|suburb|quarter)$"];out;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "teamap-build/1.0 (personal tea map)" },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) {
      const json = await res.json();
      const points = json.elements
        .map((e) => ({ name: hanName(e.tags), lng: e.lon, lat: e.lat }))
        .filter((p) => p.name);
      if (points.length) await fs.writeFile(file, JSON.stringify(points)); // 빈 결과는 캐시하지 않음 (다음에 다시 시도)
      return points;
    }
    console.warn(`  ${name}: ${res.status}, ${15 * (attempt + 1)}초 뒤 다시`);
    await sleep(15000 * (attempt + 1));
  }
  throw new Error(`overpass failed: ${name}`);
}

/** 「易武镇 ᦀᦲᦰ…」처럼 다른 문자가 붙은 이름에서 한자 부분만 */
function hanName(tags) {
  for (const key of ["name:zh-Hans", "name:zh", "name"]) {
    const m = tags[key]?.match(/^[\p{Script=Han}·]+/u);
    if (m) return m[0];
  }
  return "";
}

/** 비교용 핵심 이름: 布朗山布朗族乡 → 布朗山, 勐海镇 → 勐海, 东华门街道 → 东华门 */
function core(name) {
  return name
    .replace(/(街道办事处|街道|镇|乡|苏木|民族乡|地区办事处|办事处)$/u, "")
    .replace(/([\p{Script=Han}]{2,}?)(?:[\p{Script=Han}]{1,3}族)+$/u, "$1");
}

// 현 경계 (상위 지역 지도 파일에서)
const shapeCache = new Map();
async function countyShape(code) {
  const parent = regions[code]?.p;
  if (!parent) return null;
  if (!shapeCache.has(parent)) {
    try {
      const topo = JSON.parse(await fs.readFile(path.join(GEO, `${parent}.json`), "utf8"));
      shapeCache.set(parent, feature(topo, topo.objects.regions).features);
    } catch {
      shapeCache.set(parent, []);
    }
  }
  return shapeCache.get(parent).find((f) => f.properties.adcode === code) ?? null;
}

const countyFiles = (await fs.readdir(TOWNS)).filter((f) => /^\d{6}\.json$/.test(f));
const provinces = Object.entries(regions).filter(([, r]) => r.l === "province");

let total = 0;
let located = 0;
const index = [];

for (const [pcode, prov] of provinces) {
  const counties = countyFiles.filter((f) => f.startsWith(pcode.slice(0, 2)));
  if (!counties.length) continue;
  const cached = !REFRESH && (await fs.stat(path.join(CACHE, `${pcode}.json`)).catch(() => null));
  const points = await fetchProvince(pcode, prov.n);
  if (!cached) await sleep(5000); // 공용 서버 배려

  const byName = new Map();
  const byCore = new Map();
  for (const p of points) {
    (byName.get(p.name) ?? byName.set(p.name, []).get(p.name)).push(p);
    const c = core(p.name);
    (byCore.get(c) ?? byCore.set(c, []).get(c)).push(p);
  }

  let pLocated = 0;
  let pTotal = 0;
  for (const file of counties) {
    const county = file.replace(".json", "");
    const towns = JSON.parse(await fs.readFile(path.join(TOWNS, file), "utf8"));
    const shape = await countyShape(county);
    const out = towns.map(([code, name]) => {
      total++;
      pTotal++;
      const candidates = [...(byName.get(name) ?? []), ...(byCore.get(core(name)) ?? [])];
      const hit = shape ? candidates.find((p) => geoContains(shape, [p.lng, p.lat])) : null;
      if (!hit) return [code, name];
      located++;
      pLocated++;
      return [code, name, Math.round(hit.lng * 1e4) / 1e4, Math.round(hit.lat * 1e4) / 1e4];
    });
    await fs.writeFile(path.join(TOWNS, file), JSON.stringify(out));
    index.push(...out);
  }
  console.log(`${prov.n}: OSM ${points.length}곳, 향·진 ${pTotal}곳 중 ${pLocated}곳 위치 (${Math.round((pLocated / pTotal) * 100)}%)`);
}

await fs.writeFile(path.join(TOWNS, "_index.json"), JSON.stringify(index));
console.log(`전체: 향·진 ${total}곳 중 ${located}곳 위치 확인 (${Math.round((located / total) * 100)}%)`);
