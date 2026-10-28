import { CATEGORY_META } from "./categories";
import { CHINA } from "./regions";
import { TEA_CATEGORIES, type Tea, type TeaCategory } from "./types";

/** 해당 구역(하위 구역 포함)에서 나는 차 */
export function teasInRegion(teas: Tea[], code: string | null): Tea[] {
  if (!code || code === CHINA) return teas;
  return teas.filter((t) => t.origins.some((o) => o.path.includes(code)));
}

export function categoryCounts(teas: Tea[]): Record<TeaCategory, number> {
  const out = Object.fromEntries(TEA_CATEGORIES.map((c) => [c, 0])) as Record<TeaCategory, number>;
  for (const t of teas) out[t.category]++;
  return out;
}

export function dominantCategory(teas: Tea[]): TeaCategory | null {
  if (!teas.length) return null;
  const counts = categoryCounts(teas);
  return TEA_CATEGORIES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
}

export function teaColor(t: Pick<Tea, "category">) {
  return CATEGORY_META[t.category].color;
}

/** 검색: 한글·간체·번체 어느 쪽으로 입력해도 찾을 수 있게 (간체로 정규화한 질의도 비교) */
export function matchesQuery(t: Tea, q: string, simplify?: (s: string) => string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const simp = simplify ? simplify(query) : query;
  const hay = [
    t.name_ko,
    t.name_zh,
    t.name_zh_trad,
    ...t.origins.flatMap((o) => [o.name_ko, o.name_zh, o.detail?.name_ko ?? "", o.detail?.name_zh ?? ""]),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(query) || hay.includes(simp) || (simplify ? simplify(hay).includes(simp) : false);
}

export function displayName(t: Pick<Tea, "name_ko" | "name_zh">) {
  return t.name_ko || t.name_zh;
}
