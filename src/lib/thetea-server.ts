import "server-only";
import { cacheLife } from "next/cache";
import { THETEA_ORIGIN, theteaUrl, type TheteaArticle, type TheteaEntry, type TheteaSection } from "./thetea";

/** thetea.app 에서 글 목록과 한국어 글을 받아 정리합니다 (하루 동안 캐시) */

const HEADERS = { "User-Agent": "teamap (Chinese tea map)", Accept: "text/html,application/json" };

async function get(path: string) {
  const res = await fetch(`${THETEA_ORIGIN}${path}`, { headers: HEADERS });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`thetea.app 응답 오류 (${res.status})`);
  return res;
}

export async function fetchTheteaIndex(): Promise<TheteaEntry[]> {
  "use cache";
  cacheLife("days");
  const [list, names] = await Promise.all([
    get("/search.json").then((r) => r?.json() as Promise<{ s: string; t: string; c?: string; p: string }[]>),
    get("/names-ko.json")
      .then((r): Promise<Record<string, string>> | Record<string, string> => (r ? r.json() : {}))
      .catch((): Record<string, string> => ({})),
  ]);
  if (!list) throw new Error("thetea.app 글 목록이 없습니다.");
  return list.map((x) => ({ s: x.s, k: names[x.s] || x.t, t: x.t, c: x.c ?? "", p: x.p }));
}

export async function fetchTheteaArticle(slug: string): Promise<TheteaArticle | null> {
  "use cache";
  cacheLife("days");
  const res = await get(`/ko/article/${encodeURIComponent(slug)}`);
  if (!res) return null;
  return parseArticle(slug, await res.text());
}

export function parseArticle(slug: string, html: string): TheteaArticle | null {
  const pick = (re: RegExp) => decode(stripTags(re.exec(html)?.[1] ?? "")).trim();
  const title = pick(/<h1 class="art__title"[^>]*>([\s\S]*?)<\/h1>/);
  const start = /<div class="art__prose"[^>]*>/.exec(html);
  if (!title || !start) return null;

  let body = html.slice(start.index + start[0].length);
  const end = body.search(/<section class="art__sources"|<p class="art__shop-note"|<\/article>/);
  if (end >= 0) body = body.slice(0, end);

  // 장(h2)마다 나눔
  const parts = body.split(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  const head = parts[0];
  const sections: TheteaSection[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const html = sanitize(parts[i + 1] ?? "");
    if (!stripTags(html).trim()) continue;
    sections.push({ id: `s${sections.length + 1}`, title: decode(stripTags(parts[i])).trim(), html });
  }

  const firstP = /<p>([\s\S]*?)<\/p>/.exec(head);
  const lede = firstP ? decode(stripTags(firstP[1])).trim() : "";
  const intro = sanitize(firstP ? head.replace(firstP[0], "") : head);

  return {
    slug,
    url: theteaUrl(slug),
    title,
    pinyin: pick(/<p class="art__zh"[^>]*>\s*<em[^>]*>([\s\S]*?)<\/em>/),
    zh: pick(/<span class="art__cn"[^>]*>([\s\S]*?)<\/span>/).replace(/^·\s*/, ""),
    category: /<p class="crumbs"[\s\S]*?<a href="\/ko\/([a-z-]+)\/"/.exec(html)?.[1] ?? "",
    image: /<meta property="og:image" content="(https:\/\/media\.thetea\.app\/[^"]+)"/.exec(html)?.[1] ?? null,
    lede,
    intro: stripTags(intro).trim() ? intro : "",
    sections,
    modified: /"dateModified":"([\d-]+)"/.exec(html)?.[1] ?? null,
  };
}

const ALLOWED = new Set([
  "p", "ul", "ol", "li", "strong", "b", "em", "i", "br", "a", "h3", "h4",
  "blockquote", "table", "thead", "tbody", "tr", "th", "td", "sup", "sub", "code",
]);

/** 남의 사이트 HTML 이므로 허용한 태그만 속성 없이 남깁니다 (링크는 http(s) 주소만) */
export function sanitize(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|svg|template)[\s\S]*?<\/\1>/gi, "")
    // 원문의 마크다운 변환에서 「100~800m」 의 ~ 가 취소선이 된 것을 되돌림
    .replace(/<\/?del>/g, "~")
    .replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_, close: string, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return "";
      if (close) return t === "br" ? "" : `</${t}>`;
      if (t === "a") {
        let href = /\bhref="([^"]*)"/.exec(attrs)?.[1] ?? "";
        if (href.startsWith("/")) href = THETEA_ORIGIN + href;
        if (!/^https?:\/\/[^\s<>]+$/.test(href)) return "<a>";
        return `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">`;
      }
      return t === "br" ? "<br>" : `<${t}>`;
    })
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
