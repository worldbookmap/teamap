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

export const LEVEL_KO: Record<RegionLevel, string> = {
  province: "성",
  city: "시",
  district: "현·구",
};
