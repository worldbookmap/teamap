// 현·구 아래 향·진·가도(乡镇街道) 이름 목록을 현별 파일로 나눕니다. (경계 데이터는 없어 이름과 코드만)
// 출처: github.com/modood/Administrative-divisions-of-China (국가통계국 통계용 구역 코드, WTFPL)
// 사용법: node scripts/build-towns.mjs   →   public/towns/{현 adcode}.json  = [[코드, 이름], …]
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, ".cache/divisions/streets.json");
const OUT = path.join(ROOT, "public/towns");
const URL_ = "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/streets.json";

let text;
try {
  text = await fs.readFile(SRC, "utf8");
} catch {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  text = await res.text();
  await fs.mkdir(path.dirname(SRC), { recursive: true });
  await fs.writeFile(SRC, text);
}

const byCounty = new Map();
for (const { code, name, areaCode } of JSON.parse(text)) {
  if (!byCounty.has(areaCode)) byCounty.set(areaCode, []);
  byCounty.get(areaCode).push([code, name]);
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
for (const [county, towns] of byCounty) {
  await fs.writeFile(path.join(OUT, `${county}.json`), JSON.stringify(towns));
}
console.log(`현 ${byCounty.size}개, 향·진 ${[...byCounty.values()].reduce((s, t) => s + t.length, 0)}개`);
