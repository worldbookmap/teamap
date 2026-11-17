import type { HanjaConverter } from "./hanja";
import type { TeaOrigin } from "./types";

/**
 * [향·진 코드, 이름, 경도?, 위도?] — scripts/build-towns.mjs, build-town-points.mjs 가 만든
 * public/towns/{현 adcode}.json. 위치는 OpenStreetMap 지점과 이름·경계로 맞춘 것 (없을 수 있음)
 */
export type Town = [string, string, number?, number?];

const cache = new Map<string, Promise<Town[]>>();

/** 현·구의 향·진 목록 (목록이 없는 현은 빈 배열) */
export function loadTowns(adcode: string): Promise<Town[]> {
  let p = cache.get(adcode);
  if (!p) {
    p = fetch(`/towns/${adcode}.json`).then((r) => (r.ok ? (r.json() as Promise<Town[]>) : []));
    p.catch(() => cache.delete(adcode));
    cache.set(adcode, p);
  }
  return p;
}

export const townCounty = (code: string) => code.slice(0, 6);
export const townPos = (t: Town) => (t[2] != null && t[3] != null ? { lng: t[2], lat: t[3] } : null);

/** 지도에서 고른(누르거나 검색한) 향·진 */
export interface TownFocus {
  code: string;
  county: string;
  zh: string;
  ko: string;
  lng?: number;
  lat?: number;
}

export interface TownSearchItem {
  code: string;
  county: string;
  zh: string;
  ko: string;
  lng?: number;
  lat?: number;
}

let indexPromise: Promise<TownSearchItem[]> | null = null;

/** 전국 향·진 검색 목록 (약 4만 곳, 처음 검색할 때 한 번 불러옴) */
export function loadTownIndex(conv: HanjaConverter): Promise<TownSearchItem[]> {
  indexPromise ??= fetch("/towns/_index.json")
    .then((r) => (r.ok ? (r.json() as Promise<Town[]>) : []))
    .then((towns) =>
      towns.map(([code, zh, lng, lat]) => ({ code, county: townCounty(code), zh, ko: conv.toHangul(zh), lng, lat })),
    );
  indexPromise.catch(() => (indexPromise = null));
  return indexPromise;
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function searchTowns(items: TownSearchItem[], query: string, simplify: (s: string) => string, limit = 8) {
  const q = norm(query);
  if (q.length < 2) return [];
  const qs = norm(simplify(query));
  const starts: TownSearchItem[] = [];
  const contains: TownSearchItem[] = [];
  for (const t of items) {
    const zh = t.zh;
    const ko = t.ko;
    if (zh.startsWith(qs) || ko.startsWith(q)) starts.push(t);
    else if (zh.includes(qs) || ko.includes(q)) contains.push(t);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** 같은 현에 세부 산지가 여러 개일 수 있어 산지 + 세부 산지로 구분합니다 */
export const originKey = (o: TeaOrigin) => {
  const d = o.detail;
  return d ? `${o.adcode}:${d.code || d.name_zh || d.name_ko}:${d.lng ?? ""},${d.lat ?? ""}` : o.adcode;
};

/** 이름 없이 위치만 찍은 세부 산지의 표시 이름 */
export const UNNAMED_SPOT = "이름 없는 위치";

/** 「맹해현 › 포랑산향」 같은 표시용 이름 */
export function originNameKo(o: TeaOrigin) {
  return o.detail ? `${o.name_ko} › ${o.detail.name_ko || o.detail.name_zh || UNNAMED_SPOT}` : o.name_ko;
}

/** 같은 구역(현·구 등) 안의 여러 세부 산지를 한 묶음으로. 처음 나온 순서를 지킵니다 */
export function groupOrigins(origins: TeaOrigin[]): TeaOrigin[][] {
  const groups = new Map<string, TeaOrigin[]>();
  for (const o of origins) {
    const g = groups.get(o.adcode);
    if (g) g.push(o);
    else groups.set(o.adcode, [o]);
  }
  return [...groups.values()];
}

/** 세부 산지 이름 (한글, 없으면 한자) */
export const detailNameKo = (o: TeaOrigin) => (o.detail ? o.detail.name_ko || o.detail.name_zh || UNNAMED_SPOT : "");

/** 「녹곡향 › 동정 · 영륭 (2곳)」 처럼 같은 구역의 산지를 묶은 이름 */
export function originGroupNameKo(group: TeaOrigin[]) {
  if (group.length === 1) return originNameKo(group[0]);
  // 구역 전체로도 등록돼 있으면 「전역」 으로
  return `${group[0].name_ko} › ${group.map((o) => (o.detail ? detailNameKo(o) : "전역")).join(" · ")} (${group.length}곳)`;
}
