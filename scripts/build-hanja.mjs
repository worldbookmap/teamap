// Unicode Unihan DB에서 한자→한글 음(kHangul), 간체↔번체 변환표, 한글→한자 후보표를 만듭니다.
// 결과: src/data/hanja.json
// 사용법: (Unihan.zip을 .cache/unihan 에 풀어둔 뒤) node scripts/build-hanja.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, ".cache/unihan");
const OUT = path.join(ROOT, "src/data/hanja.json");

const cpToChar = (u) => String.fromCodePoint(parseInt(u.slice(2), 16));

async function readField(file, fields) {
  const text = await fs.readFile(path.join(SRC, file), "utf8");
  const out = Object.fromEntries(fields.map((f) => [f, new Map()]));
  for (const line of text.split("\n")) {
    if (!line.startsWith("U+")) continue;
    const [cp, field, value] = line.split("\t");
    if (out[field]) out[field].set(cpToChar(cp), value);
  }
  return out;
}

const readings = await readField("Unihan_Readings.txt", ["kHangul", "kKorean", "kHanyuPinlu", "kMandarin"]);

// kHangul 이 없는 글자는 kKorean(예일 로마자 표기)을 한글로 바꿔 씁니다. 예: HYANG → 향
const YALE_INI = [
  ["kk", 1], ["tt", 4], ["pp", 8], ["ss", 10], ["cc", 13], ["ch", 14], ["kh", 15], ["th", 16], ["ph", 17],
  ["k", 0], ["n", 2], ["t", 3], ["l", 5], ["r", 5], ["m", 6], ["p", 7], ["s", 9], ["c", 12], ["h", 18],
];
const YALE_MED = [
  ["yey", 7], ["way", 10], ["wey", 15], ["yay", 3], ["ay", 1], ["ya", 2], ["ey", 5], ["ye", 6], ["oy", 11],
  ["wa", 9], ["yo", 12], ["wu", 13], ["we", 14], ["wi", 16], ["yu", 17], ["uy", 19],
  ["a", 0], ["e", 4], ["o", 8], ["u", 18], ["i", 20],
];
const YALE_FIN = { "": 0, k: 1, n: 4, t: 7, l: 8, m: 16, p: 17, ng: 21 };
function yaleToHangul(rom) {
  let s = rom.toLowerCase();
  let ini = 11;
  const i = YALE_INI.find(([k]) => s.startsWith(k));
  if (i) {
    ini = i[1];
    s = s.slice(i[0].length);
  }
  const m = YALE_MED.find(([k]) => s.startsWith(k));
  if (!m) return null;
  let med = m[1];
  if (med === 18 && [6, 7, 8, 17].includes(ini)) med = 13; // 순음 뒤 u 는 ㅜ
  const fin = YALE_FIN[s.slice(m[0].length)];
  if (fin === undefined) return null;
  return String.fromCharCode(0xac00 + ini * 588 + med * 28 + fin);
}
for (const [ch, rom] of readings.kKorean) {
  if (readings.kHangul.has(ch)) continue;
  const syls = rom.split(" ").map(yaleToHangul).filter(Boolean);
  if (syls.length) readings.kHangul.set(ch, syls.join(" "));
}
const variants = await readField("Unihan_Variants.txt", ["kTraditionalVariant", "kSimplifiedVariant"]);
const core = await readField("Unihan_DictionaryLikeData.txt", ["kUnihanCore2020", "kGradeLevel"]);
const iicore = await readField("Unihan_IRGSources.txt", ["kIICore"]);

// 기본 음 선택: 교육용(E) 표시가 있으면 우선, 없으면 첫 번째
function primaryReading(raw) {
  const items = raw.split(" ").map((s) => {
    const [syl, flags = ""] = s.split(":");
    return { syl, edu: flags.includes("E") };
  });
  const edu = items.find((i) => i.edu);
  return { primary: (edu ?? items[0]).syl, all: [...new Set(items.map((i) => i.syl))] };
}

// 차·지명 문맥에서 자주 쓰는 음으로 덮어쓰기 (Unihan 기본음과 다르거나 누락된 글자)
const OVERRIDES = {
  茶: "차", 洱: "이", 叶: "엽", 葉: "엽", 参: "삼", 參: "삼", 行: "행", 宿: "숙",
  便: "편", 復: "복", 车: "차", 車: "차", 茗: "명", 坑: "갱", 寮: "료", 坪: "평",
  埔: "포", 枞: "종", 樅: "종", 丛: "총", 叢: "총", 傣: "태", 勐: "맹", 圳: "천", 佤: "와",
  傈: "율", 僳: "속", 畲: "사", 仫: "무", 佬: "로", 婺: "무", 莆: "보", 荔: "려", 查: "사",
  // Unihan 에 한국 음이 없는 지명용 글자
  滦: "란", 岢: "가", 鲅: "발", 箐: "청", 棱: "릉", 眙: "이", 沭: "술", 嵊: "승", 琊: "야",
  崂: "로", 潍: "유", 朐: "구", 茌: "치", 菏: "하", 郓: "운", 鄄: "견", 瀍: "전", 郾: "언",
  渑: "면", 卧: "와", 浉: "사", 硚: "교", 猇: "효", 秭: "자", 浠: "희", 溆: "서", 碚: "배",
  蒗: "랑", 鄠: "호", 峪: "욕", 碱: "감", 鄯: "선", 埗: "보", 凼: "담",
};

const reading = {}; // char -> "주음" 또는 "주음|다른음,다른음"
const toTrad = {}; // 간체 -> 번체
const toSimp = {}; // 번체 -> 간체

for (const [ch, raw] of readings.kHangul) {
  const { primary, all } = primaryReading(raw);
  const p = OVERRIDES[ch] ?? primary;
  const alts = all.filter((a) => a !== p);
  reading[ch] = alts.length ? `${p}|${alts.join(",")}` : p;
}

for (const [ch, v] of variants.kTraditionalVariant) {
  const all = v.split(" ").map(cpToChar);
  // 蒙(蒙·濛·懞·矇)·干·面 처럼 자기 자신도 번체이고 한국 음이 있는 글자는 바꾸지 않습니다
  if (all.includes(ch) && readings.kHangul.has(ch)) continue;
  const trads = all.filter((t) => t !== ch);
  if (!trads.length) continue;
  const best = trads.find((t) => readings.kHangul.has(t)) ?? trads[0];
  toTrad[ch] = best;
  if (!reading[ch] && reading[best]) reading[ch] = reading[best];
}
// 흔히 쓰는 글자만 (蒙 → 𰰡 같은 확장 G 영역의 드문 간체 변형은 제외)
const isCommon = (c) => c.length === 1 && (core.kUnihanCore2020.has(c) || iicore.kIICore.has(c));
for (const [ch, v] of variants.kSimplifiedVariant) {
  const simp = v.split(" ").map(cpToChar).find((s) => s !== ch && isCommon(s));
  if (simp) toSimp[ch] = simp;
}
for (const [ch, syl] of Object.entries(OVERRIDES)) {
  const old = reading[ch];
  const alts = old ? old.split("|").join(",").split(",").filter((a) => a && a !== syl) : [];
  reading[ch] = alts.length ? `${syl}|${[...new Set(alts)].join(",")}` : syl;
}

// 한글 음절 -> 한자 후보 (번체 기준, 중국어 사용 빈도·핵심 한자 우선)
const score = (ch) => {
  const pinlu = readings.kHanyuPinlu.get(ch);
  const freq = pinlu ? Math.max(...[...pinlu.matchAll(/\((\d+)\)/g)].map((m) => +m[1])) : 0;
  const simp = toSimp[ch];
  const simpPinlu = simp && readings.kHanyuPinlu.get(simp);
  const sFreq = simpPinlu ? Math.max(...[...simpPinlu.matchAll(/\((\d+)\)/g)].map((m) => +m[1])) : 0;
  return (
    Math.max(freq, sFreq) +
    (core.kUnihanCore2020.has(ch) ? 50 : 0) +
    (iicore.kIICore.has(ch) ? 20 : 0) +
    (core.kGradeLevel.has(ch) ? 10 : 0)
  );
};

const candidates = {};
for (const [ch, raw] of readings.kHangul) {
  if (!core.kUnihanCore2020.has(ch) && !iicore.kIICore.has(ch)) continue;
  for (const syl of primaryReading(raw).all.concat(OVERRIDES[ch] ? [OVERRIDES[ch]] : [])) {
    (candidates[syl] ??= new Set()).add(ch);
  }
}
// 차 문맥에서 먼저 보여줄 글자
const PREFER = { 차: "茶", 다: "茶", 명: "茗" };
const cand = {};
for (const [syl, set] of Object.entries(candidates)) {
  const sorted = [...set].sort((a, b) => score(b) - score(a));
  const first = PREFER[syl];
  cand[syl] = (first ? [first, ...sorted.filter((c) => c !== first)] : sorted).slice(0, 40).join("");
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ reading, toTrad, toSimp, cand }));
console.log(
  `읽기 ${Object.keys(reading).length}자, 간→번 ${Object.keys(toTrad).length}, 번→간 ${Object.keys(toSimp).length}, 후보 음절 ${Object.keys(cand).length}`,
);
