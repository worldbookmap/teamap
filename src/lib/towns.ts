import type { TeaOrigin } from "./types";

/** [향·진 코드, 이름] — scripts/build-towns.mjs 가 만든 public/towns/{현 adcode}.json */
export type Town = [string, string];

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

/** 같은 현에 세부 산지가 여러 개일 수 있어 산지 + 세부 산지로 구분합니다 */
export const originKey = (o: TeaOrigin) => `${o.adcode}:${o.detail?.code ?? o.detail?.name_zh ?? o.detail?.name_ko ?? ""}`;

/** 「맹해현 › 포랑산향」 같은 표시용 이름 */
export function originNameKo(o: TeaOrigin) {
  return o.detail ? `${o.name_ko} › ${o.detail.name_ko || o.detail.name_zh}` : o.name_ko;
}
