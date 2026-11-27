/**
 * 차와 이어진 강의 물길을 OpenStreetMap(Nominatim)에서 받아 간추려 src/data/rivers.json 에 저장합니다.
 * 강 이름·설명·보이는 지도는 src/data/rivers.ts 에서 정합니다.
 *
 *   npm run rivers:fetch
 */
import { writeFileSync } from "node:fs";

/** id → OSM 요소 (R: relation, W: way) 와 남길 범위 */
const RIVERS = {
  // 메콩강 전체 relation — 중국 안(라오스·미얀마 국경 위)만 남김
  lancang: { osm: ["R215354"], keep: ([, lat]) => lat >= 21.14 },
  jiuqu: { osm: ["W185568654", "W50893946", "W380734998"] },
  // OSM 에는 '九曲溪' 윗물(stream)로 올라 있음 — 동목관에서 동목촌(庙湾·一里坪)을 지나 구곡계로
  tongmu: { osm: ["W80678250"] },
  qiantang: { osm: ["R2899020"] },
  // OSM 이름은 창강(昌江), 기문현 쪽 윗물이 창강(閶江)
  changjiang: { osm: ["R10451326"] },
};

const UA = "teamap-dev (tea map rivers)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(ids) {
  const url = new URL("https://nominatim.openstreetmap.org/lookup");
  url.search = new URLSearchParams({ osm_ids: ids.join(","), format: "json", polygon_geojson: "1", polygon_threshold: "0.003" });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${ids}: HTTP ${res.status}`);
  return res.json();
}

const round = (n) => Math.round(n * 1e4) / 1e4;
const out = {};
for (const [id, { osm, keep = () => true }] of Object.entries(RIVERS)) {
  const rows = await lookup(osm);
  /** @type {[number, number][][]} */
  const lines = [];
  for (const r of rows) {
    const g = r.geojson;
    const parts = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const part of parts) {
      // 범위 밖 점에서 선을 끊음
      let cur = [];
      for (const p of part) {
        if (keep(p)) cur.push([round(p[0]), round(p[1])]);
        else {
          if (cur.length > 1) lines.push(cur);
          cur = [];
        }
      }
      if (cur.length > 1) lines.push(cur);
    }
  }
  out[id] = lines;
  console.log(id, `${lines.length}줄`, `${lines.reduce((n, l) => n + l.length, 0)}점`);
  await sleep(1100); // Nominatim 이용 규칙: 초당 1회
}
writeFileSync(new URL("../src/data/rivers.json", import.meta.url), JSON.stringify(out) + "\n");
