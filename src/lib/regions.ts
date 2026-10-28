import type { HanjaConverter, Word } from "./hanja";
import { shortRegionName } from "./hanja";
import type { RegionLevel, TeaOrigin } from "./types";

/** scripts/fetch-geo.mjs 가 만든 행정구역 색인 */
export interface RawRegion {
  n: string; // 이름(간체)
  l: RegionLevel;
  p: string | null; // 상위 adcode
  c?: [number, number]; // 중심 경위도
  k: number; // 하위 구역 수 (0이면 말단)
}
export type RegionIndex = Record<string, RawRegion>;

export const CHINA = "100000";

export function regionPath(index: RegionIndex, adcode: string): string[] {
  const path: string[] = [];
  let cur: string | null = adcode;
  while (cur && index[cur]) {
    path.unshift(cur);
    cur = index[cur].p;
  }
  return path;
}

export function childrenOf(index: RegionIndex, parent: string | null): string[] {
  return Object.keys(index).filter((code) => index[code].p === parent);
}

export function makeOrigin(index: RegionIndex, conv: HanjaConverter, adcode: string): TeaOrigin | null {
  const r = index[adcode];
  if (!r) return null;
  return {
    adcode,
    path: regionPath(index, adcode),
    name_zh: r.n,
    name_ko: conv.toHangul(r.n),
    level: r.l,
  };
}

/** 전체 경로 이름 (浙江省 杭州市 西湖区) */
export function fullName(index: RegionIndex, adcode: string, conv?: HanjaConverter) {
  return regionPath(index, adcode)
    .map((c) => (conv ? conv.toHangul(index[c].n) : index[c].n))
    .join(" ");
}

/** 지명을 한글↔한자 변환 사전에 넣을 단어 목록 (짧은 이름 포함) */
export function regionWords(index: RegionIndex, conv: HanjaConverter): Word[] {
  const words: Word[] = [];
  for (const r of Object.values(index)) {
    for (const name of new Set([r.n, shortRegionName(r.n)])) {
      if (name.length < 2) continue;
      words.push([name, conv.traditionalize(name), conv.toHangul(name)]);
    }
  }
  return words;
}

export interface RegionSearchItem {
  adcode: string;
  zh: string;
  trad: string;
  ko: string;
  full_ko: string;
  full_zh: string;
  level: RegionLevel;
}

export function buildRegionSearch(index: RegionIndex, conv: HanjaConverter): RegionSearchItem[] {
  return Object.entries(index).map(([adcode, r]) => ({
    adcode,
    zh: r.n,
    trad: conv.traditionalize(r.n),
    ko: conv.toHangul(r.n),
    full_ko: fullName(index, adcode, conv),
    full_zh: fullName(index, adcode),
    level: r.l,
  }));
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 지역 검색: 한글·간체·번체, 짧은 이름(항주)·전체 이름(절강성 항주시) 모두.
 * 이름이 정확히 같은 것 → 앞부분이 같은 것 → 포함하는 것 → 상위 지역 이름에 포함, 같은 순위면 성 → 시 → 현 순.
 */
export function searchRegions(
  search: RegionSearchItem[],
  query: string,
  simplify: (s: string) => string,
  limit = 30,
): RegionSearchItem[] {
  const q = norm(query);
  if (!q) return [];
  const qs = norm(simplify(query));
  const scored: { item: RegionSearchItem; score: number }[] = [];
  for (const item of search) {
    const names = [item.ko, item.zh, item.trad].map(norm);
    const full = norm(item.full_ko) + norm(item.full_zh);
    let score = -1;
    if (names.some((n) => n === q || n === qs)) score = 0;
    else if (names.some((n) => n.startsWith(q) || n.startsWith(qs))) score = 1;
    else if (names.some((n) => n.includes(q) || n.includes(qs))) score = 2;
    else if (full.includes(q) || full.includes(qs)) score = 3;
    if (score >= 0) scored.push({ item, score: score * 10 + ({ province: 0, city: 1, district: 2 }[item.level] ?? 3) });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.item);
}

export const LEVEL_KO: Record<RegionLevel, string> = {
  province: "성",
  city: "시",
  district: "현·구",
};
