import type { Tea, TeaCategory } from "./types";

/** thetea.app (중국차 백과사전) 연동 — 브라우저·서버 공용 타입과 도우미 */

export const THETEA_ORIGIN = "https://thetea.app";
export const theteaUrl = (slug: string) => `${THETEA_ORIGIN}/ko/article/${encodeURIComponent(slug)}`;
export const isTheteaSlug = (s: string) => /^[a-z0-9][a-z0-9-]{0,120}$/.test(s);

/** 백과사전 글 목록의 한 줄 (검색·연결용) */
export interface TheteaEntry {
  /** 글 주소 이름 (예: xihu-longjing) */
  s: string;
  /** 한국어 이름 (예: 서호 용정) */
  k: string;
  /** 병음 (예: Xīhú lóngjǐng) */
  t: string;
  /** 한자 (간체 또는 번체) */
  c: string;
  /** 분류 (green-tea, oolong-tea, puerh, categories …) */
  p: string;
}

export interface TheteaSection {
  id: string;
  title: string;
  /** 허용한 태그만 남긴 HTML */
  html: string;
}

export interface TheteaArticle {
  slug: string;
  url: string;
  title: string;
  pinyin: string;
  zh: string;
  category: string;
  image: string | null;
  /** 첫 문단 (요약) */
  lede: string;
  /** 첫 장 앞의 본문 (요약 문단 다음) */
  intro: string;
  sections: TheteaSection[];
  modified: string | null;
}

export const THETEA_GROUPS: Record<string, string> = {
  "green-tea": "녹차",
  "white-tea": "백차",
  "yellow-tea": "황차",
  "oolong-tea": "우롱차",
  "red-black-tea": "홍차",
  "dark-tea": "흑차",
  puerh: "보이차",
  "flowers-and-dry": "꽃차·허브차",
  categories: "용어·개념",
};

/** 백과사전 분류 → 6대 다류 (용어·꽃차는 없음) */
export const THETEA_TO_CATEGORY: Record<string, TeaCategory> = {
  "green-tea": "green",
  "white-tea": "white",
  "yellow-tea": "yellow",
  "oolong-tea": "oolong",
  "red-black-tea": "black",
  "dark-tea": "dark",
  puerh: "dark",
};

/** 성조·공백·기호를 지운 검색용 문자열 */
export function fold(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s'‘’ʻʼ´′·\-—–_.,()（）]/g, "");
}

type Simplify = (s: string) => string;

/** 차 이름으로 백과사전 글을 찾는 색인 */
export class TheteaIndex {
  readonly bySlug = new Map<string, TheteaEntry>();
  private byHan = new Map<string, TheteaEntry[]>();
  private byKo = new Map<string, TheteaEntry[]>();

  constructor(
    readonly entries: TheteaEntry[],
    private simplify: Simplify = (s) => s,
  ) {
    for (const e of entries) {
      this.bySlug.set(e.s, e);
      if (e.c) push(this.byHan, this.han(e.c), e);
      if (e.k) push(this.byKo, fold(e.k), e);
    }
  }

  private han(s: string) {
    return this.simplify(s.replace(/[^\p{Script=Han}0-9A-Za-z]/gu, ""));
  }

  /** 이름이 정확히 같은 글 (茶 유무·간체/번체·한글 띄어쓰기 차이는 무시) */
  exact(tea: Pick<Tea, "name_zh" | "name_zh_trad" | "name_ko">): TheteaEntry | null {
    for (const n of [tea.name_zh, tea.name_zh_trad]) {
      if (!n) continue;
      const h = this.han(n);
      const hit = this.byHan.get(h) ?? this.byHan.get(h.replace(/茶$/, "")) ?? this.byHan.get(`${h}茶`);
      if (hit) return pickPrimary(hit);
    }
    if (tea.name_ko) {
      const hit = this.byKo.get(fold(tea.name_ko));
      if (hit) return pickPrimary(hit);
    }
    return null;
  }

  /** 정확히 같지는 않지만 비슷한 글 (예: 武夷肉桂 → 肉桂) */
  similar(tea: Pick<Tea, "name_zh" | "name_zh_trad" | "name_ko">, limit = 5): TheteaEntry[] {
    const h = this.han(tea.name_zh || tea.name_zh_trad || "");
    const ko = fold(tea.name_ko);
    const scored: [number, TheteaEntry][] = [];
    for (const e of this.entries) {
      if (e.p === "categories") continue;
      const eh = this.han(e.c);
      const ek = fold(e.k);
      let score = 0;
      if (h.length >= 2 && eh.length >= 2) {
        if (h.endsWith(eh) || h.startsWith(eh)) score = 3 + eh.length / 10;
        else if (eh.includes(h)) score = 2 + h.length / 10;
        else if (h.includes(eh)) score = 1.5;
      }
      if (!score && ko.length >= 2 && ek.length >= 2 && (ek.includes(ko) || ko.includes(ek))) score = 1;
      if (score) scored.push([score, e]);
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
  }

  /** 이 차에 연결된 글: 직접 고른 글 → 없으면 이름으로 자동 */
  linked(tea: Pick<Tea, "name_zh" | "name_zh_trad" | "name_ko" | "thetea_slug">): { entry: TheteaEntry | null; auto: boolean } {
    if (tea.thetea_slug === "") return { entry: null, auto: false };
    if (tea.thetea_slug) return { entry: this.bySlug.get(tea.thetea_slug) ?? stub(tea.thetea_slug), auto: false };
    return { entry: this.exact(tea), auto: true };
  }

  /** 한글·한자·병음 아무거나로 검색 */
  search(query: string, limit = 30): TheteaEntry[] {
    const q = fold(query);
    if (!q) return [];
    const qh = /\p{Script=Han}/u.test(query) ? this.han(query) : "";
    /** 0: 이름 전체가 같음, 1: 앞부분이 같음, 2: 중간에 있음 */
    const rank = (field: string, needle: string) => {
      const i = field.indexOf(needle);
      return i < 0 ? 9 : i > 0 ? 2 : field.length === needle.length ? 0 : 1;
    };
    const out: [number, TheteaEntry][] = [];
    for (const e of this.entries) {
      const best = qh
        ? rank(this.han(e.c), qh)
        : Math.min(rank(fold(e.k), q), rank(fold(e.t), q), rank(e.s.replace(/-/g, ""), q));
      if (best < 9) out.push([best, e]);
    }
    return out.sort((a, b) => a[0] - b[0] || a[1].k.length - b[1].k.length).slice(0, limit).map((x) => x[1]);
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

/** 같은 이름이 여러 글이면 용어 설명보다 차 글을 */
const pickPrimary = (list: TheteaEntry[]) => list.find((e) => e.p !== "categories") ?? list[0];

const stub = (slug: string): TheteaEntry => ({ s: slug, k: slug, t: "", c: "", p: "" });

let indexPromise: Promise<TheteaEntry[]> | null = null;

/** 백과사전 글 목록 (브라우저에서 한 번만 받음) */
export function loadTheteaEntries(): Promise<TheteaEntry[]> {
  indexPromise ??= fetch("/api/thetea")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`목록을 불러오지 못했습니다 (${r.status})`))))
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

const articleCache = new Map<string, Promise<TheteaArticle | null>>();

export function loadTheteaArticle(slug: string): Promise<TheteaArticle | null> {
  let p = articleCache.get(slug);
  if (!p) {
    p = fetch(`/api/thetea/${encodeURIComponent(slug)}`).then(async (r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `글을 불러오지 못했습니다 (${r.status})`);
      return r.json();
    });
    p.catch(() => articleCache.delete(slug));
    articleCache.set(slug, p);
  }
  return p;
}
