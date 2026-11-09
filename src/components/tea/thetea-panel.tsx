"use client";

import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, ExternalLink, Link2, Link2Off, Loader2, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheteaArticle } from "@/hooks/use-thetea";
import { THETEA_GROUPS, type TheteaArticle, type TheteaIndex, type TheteaSection } from "@/lib/thetea";
import type { Tea } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TheteaPicker } from "./thetea-picker";

const ARTICLE_LINK = /^https:\/\/thetea\.app\/ko\/article\/([a-z0-9-]+)\/?$/;

/** 차 상세의 「백과」 탭: thetea.app 백과사전 글을 장별로 접어 보여 주고, 글 안에서 찾기 */
export function TheteaPanel({
  tea,
  index,
  indexError,
  admin,
  onLink,
}: {
  tea: Tea;
  index: TheteaIndex | null;
  indexError: string | null;
  admin: boolean;
  /** 글 연결: slug, null(이름으로 자동), ""(연결 안 함) */
  onLink: (slug: string | null) => Promise<void>;
}) {
  /** 본문 링크로 옮겨 다닌 글 (맨 뒤가 지금 보는 글) */
  const [trail, setTrail] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const linked = index?.linked(tea) ?? null;
  const baseSlug = linked?.entry?.s ?? null;
  const viewSlug = trail.at(-1) ?? baseSlug;

  const link = async (slug: string | null) => {
    setSaving(true);
    try {
      await onLink(slug);
      setTrail([]);
      setPicking(false);
      toast.success(slug === "" ? "백과사전 연결을 끊었습니다." : "백과사전 글을 연결했습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!index) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        {indexError ? `백과사전을 불러오지 못했어요: ${indexError}` : (
          <>
            <Loader2 className="size-4 animate-spin" /> 백과사전 불러오는 중…
          </>
        )}
      </div>
    );
  }

  const picker = (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between text-sm font-medium">
        이 차에 연결할 글 고르기
        <Button size="icon-sm" variant="ghost" onClick={() => setPicking(false)} aria-label="닫기">
          <X />
        </Button>
      </div>
      <TheteaPicker
        index={index}
        autoFocus
        suggestions={index.similar(tea, 8)}
        onPick={(e) => link(e.s)}
      />
      {saving && <Loader2 className="size-4 animate-spin" />}
    </div>
  );

  if (!viewSlug) {
    const similar = index.similar(tea);
    return (
      <div className="space-y-4 py-2">
        <div className="space-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <BookOpen className="size-4" />
            {tea.thetea_slug === "" ? "백과사전 연결을 꺼 두었어요." : "thetea.app 백과사전에서 이 차의 글을 찾지 못했어요."}
          </p>
          <p className="text-xs text-muted-foreground">
            {admin ? "아래에서 글을 찾아 연결하면 이 탭에 내용이 보여요." : "비슷한 이름의 글을 열어 볼 수 있어요."}
          </p>
        </div>
        {!admin && similar.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {similar.map((e) => (
              <li key={e.s}>
                <button
                  onClick={() => setTrail([e.s])}
                  className="rounded-full border px-2.5 py-1 text-sm transition hover:border-primary hover:bg-secondary"
                >
                  {e.k} <span className="font-zh text-muted-foreground">{e.c}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {admin && (
          <>
            {picker}
            {tea.thetea_slug === "" && (
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => link(null)}>
                이름으로 자동 찾기 켜기
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  const away = viewSlug !== baseSlug;
  const backLabel = trail.length > 1 ? "이전 글로 돌아가기" : baseSlug ? `${index.bySlug.get(baseSlug)?.k ?? "처음 글"}(으)로 돌아가기` : "돌아가기";

  return (
    <div className="space-y-4">
      {away && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <button onClick={() => setTrail((t) => t.slice(0, -1))} className="flex items-center gap-1 hover:text-primary">
            <ArrowLeft className="size-4" />
            {backLabel}
          </button>
          {admin && (
            <Button size="sm" variant="outline" className="ml-auto" disabled={saving} onClick={() => link(viewSlug)}>
              <Link2 /> 이 글을 이 차에 연결
            </Button>
          )}
        </div>
      )}

      <ArticleView key={viewSlug} slug={viewSlug} onNavigate={(s) => setTrail((t) => [...t, s])} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        <span>
          출처{" "}
          <a href={`https://thetea.app/ko/article/${viewSlug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:text-primary hover:underline">
            thetea.app 중국차 백과사전 <ExternalLink className="size-3" />
          </a>
        </span>
        {!away && linked?.auto && <span>· 이름이 같은 글을 자동으로 연결했어요</span>}
        {admin && !away && (
          <span className="ml-auto flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => setPicking((v) => !v)}>
              <Link2 /> 다른 글로 바꾸기
            </Button>
            <Button size="xs" variant="ghost" className="text-destructive" disabled={saving} onClick={() => link("")}>
              <Link2Off /> 연결 끊기
            </Button>
          </span>
        )}
      </div>
      {admin && picking && picker}
    </div>
  );
}

interface Part extends TheteaSection {
  num: string;
  label: string;
  text: string;
}

function ArticleView({ slug, onNavigate }: { slug: string; onNavigate: (slug: string) => void }) {
  const { loading, article, error } = useTheteaArticle(slug);

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        <div className="flex gap-3">
          <div className="size-20 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-16 animate-pulse rounded bg-muted" />
        <p className="text-center text-xs text-muted-foreground">thetea.app 에서 글을 가져오는 중…</p>
      </div>
    );
  }
  if (error || !article) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{error ?? "백과사전에 이 글이 없어요."}</p>;
  }
  return <Article article={article} onNavigate={onNavigate} />;
}

function Article({ article, onNavigate }: { article: TheteaArticle; onNavigate: (slug: string) => void }) {
  const parts = useMemo<Part[]>(() => {
    const list = article.intro ? [{ id: "s0", title: "개요", html: article.intro }, ...article.sections] : article.sections;
    return list.map((s) => {
      const m = /^(\d+)\.\s*(.*)$/.exec(s.title);
      return { ...s, num: m?.[1] ?? "", label: m?.[2] ?? s.title, text: htmlText(s.html) };
    });
  }, [article]);
  const facts = useMemo(() => keyFacts(parts), [parts]);

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    const m = new Map<string, number>();
    if (!q) return m;
    for (const p of parts) {
      const n = count(p.text.toLowerCase(), q) + count(p.label.toLowerCase(), q);
      if (n) m.set(p.id, n);
    }
    return m;
  }, [parts, q]);
  const total = [...hits.values()].reduce((a, b) => a + b, 0);

  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const isOpen = (id: string) => (q ? hits.has(id) : open.has(id));
  const allOpen = parts.every((p) => open.has(p.id));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bodyRef = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(-1);
  const jump = (d: number) => {
    const marks = bodyRef.current?.querySelectorAll<HTMLElement>("mark.thetea-hit");
    if (!marks?.length) return;
    const next = (cur + d + marks.length) % marks.length;
    marks.forEach((el, i) => (i === next ? el.setAttribute("data-current", "") : el.removeAttribute("data-current")));
    marks[next].scrollIntoView({ block: "center", behavior: "smooth" });
    setCur(next);
  };

  const goSection = (id: string) => {
    setQuery("");
    setCur(-1);
    setOpen((s) => new Set(s).add(id));
    requestAnimationFrame(() => document.getElementById(`thetea-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  const onBodyClick = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest("a");
    const m = a && ARTICLE_LINK.exec(a.href);
    if (m) {
      e.preventDefault();
      onNavigate(m[1]);
    }
  };

  const thumb = article.image?.replace(/\/1200\.jpg$/, "/400.webp") ?? null;

  return (
    <div className="space-y-4">
      <header className="flex gap-3.5">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={article.title} className="size-20 shrink-0 rounded-lg bg-muted object-cover sm:size-24" loading="lazy" />
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-heading text-lg font-semibold">{article.title}</h3>
            {THETEA_GROUPS[article.category] && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{THETEA_GROUPS[article.category]}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {article.pinyin}
            {article.zh && <span className="font-zh"> · {article.zh}</span>}
          </p>
          {article.lede && <p className="text-sm leading-6 text-foreground/90">{article.lede}</p>}
        </div>
      </header>

      {facts.length > 0 && (
        <dl className="grid gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm sm:grid-cols-[auto_1fr]">
          {facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{f.label}</dt>
              <dd className="leading-6">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-1.5 bg-background/95 px-1 py-1.5 backdrop-blur">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pr-24 pl-8"
            placeholder="글 안에서 찾기 (온도, 보관, 향…)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCur(-1); // 검색어가 바뀌면 현재 위치를 처음으로
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                jump(e.shiftKey ? -1 : 1);
              } else if (e.key === "Escape" && query) {
                e.stopPropagation();
                setQuery("");
                setCur(-1);
              }
            }}
          />
          {q && (
            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
              <span className="px-1 text-xs text-muted-foreground tabular-nums">
                {total ? `${cur >= 0 ? cur + 1 : "–"}/${total}` : "없음"}
              </span>
              <Button size="icon-xs" variant="ghost" onClick={() => jump(-1)} disabled={!total} aria-label="이전 찾은 곳">
                <ChevronUp />
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => jump(1)} disabled={!total} aria-label="다음 찾은 곳">
                <ChevronDown />
              </Button>
            </div>
          )}
        </div>
        {!q && (
          <Button size="sm" variant="outline" onClick={() => setOpen(allOpen ? new Set() : new Set(parts.map((p) => p.id)))}>
            {allOpen ? "모두 접기" : "모두 펼치기"}
          </Button>
        )}
      </div>

      {!q && (
        <nav className="flex flex-wrap gap-1" aria-label="목차">
          {parts.map((p) => (
            <button
              key={p.id}
              onClick={() => goSection(p.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs transition hover:border-primary hover:text-primary",
                open.has(p.id) && "border-primary/40 bg-primary/5",
              )}
            >
              {p.num && <span className="mr-0.5 text-muted-foreground">{p.num}</span>}
              {p.label}
            </button>
          ))}
        </nav>
      )}

      {q && total === 0 && <p className="py-6 text-center text-sm text-muted-foreground">「{query.trim()}」이(가) 들어간 곳이 없어요.</p>}

      <div ref={bodyRef} onClick={onBodyClick} className="divide-y rounded-lg border">
        {parts.map((p) => {
          if (q && !hits.has(p.id)) return null;
          const opened = isOpen(p.id);
          return (
            <section key={p.id} id={`thetea-${p.id}`} className="scroll-mt-14">
              <button
                onClick={() => (q ? null : toggle(p.id))}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-muted/50"
                aria-expanded={opened}
              >
                {p.num && (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground tabular-nums">
                    {p.num}
                  </span>
                )}
                <span className="flex-1 text-sm font-medium" dangerouslySetInnerHTML={{ __html: highlight(escapeHtml(p.label), q) }} />
                {q && hits.get(p.id) ? (
                  <span className="rounded-full bg-chart-2/25 px-1.5 text-[11px] tabular-nums">{hits.get(p.id)}</span>
                ) : null}
                {!q && <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", opened && "rotate-180")} />}
              </button>
              {opened && (
                <div
                  className="thetea-prose px-3.5 pt-0.5 pb-4"
                  dangerouslySetInnerHTML={{ __html: highlight(p.html, q) }}
                />
              )}
            </section>
          );
        })}
      </div>
      {article.modified && <p className="text-right text-[11px] text-muted-foreground">원문 수정일 {article.modified}</p>}
    </div>
  );
}

/** 첫 장(분류·원산지)의 「항목: 내용」 을 한눈에 보기로 */
function keyFacts(parts: Part[]): { label: string; value: string }[] {
  const first = parts.find((p) => /분류|원산지|유형/.test(p.label)) ?? parts[0];
  if (!first || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(first.html, "text/html");
  const out: { label: string; value: string }[] = [];
  for (const li of doc.querySelectorAll("body > ul > li")) {
    const strong = li.querySelector("strong");
    if (!strong) continue;
    const label = (strong.textContent ?? "").replace(/[:：]\s*$/, "").trim();
    // 하위 목록은 빼고 그 항목의 글만
    const own = li.cloneNode(true) as HTMLElement;
    own.querySelectorAll("ul, ol").forEach((el) => el.remove());
    const value = firstSentence((own.textContent ?? "").replace(strong.textContent ?? "", "").trim());
    if (label && value && label.length <= 20) out.push({ label, value });
    if (out.length >= 6) break;
  }
  return out;
}

function firstSentence(s: string) {
  const text = s.replace(/\s+/g, " ");
  const m = /^(.{12,}?[.。](?=\s|$))/.exec(text);
  const one = m ? m[1] : text;
  return one.length > 140 ? `${one.slice(0, 138)}…` : one;
}

function htmlText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function count(hay: string, needle: string) {
  let n = 0;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 태그 밖의 글자에서만 검색어를 <mark> 로 감쌉니다 */
function highlight(html: string, q: string) {
  if (!q) return html;
  const re = new RegExp(escapeRe(escapeHtml(q)), "gi");
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith("<") ? part : part.replace(re, (m) => `<mark class="thetea-hit">${m}</mark>`)))
    .join("");
}
