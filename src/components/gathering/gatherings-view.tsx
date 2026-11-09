"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Images, Loader2, MapPin, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CLUB, ClubFollowButton } from "@/components/club";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_META } from "@/lib/categories";
import type { Gathering, GatheringKind, Tea } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CoverArt, dateParts, formatTime, ganzhi, KindBadge, kindLabel, regularOrdinals, resolveTeas, teaLabel } from "./gathering-utils";

type Filter = "all" | GatheringKind;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "regular", label: "정기모임" },
  { id: "casual", label: "벙개모임" },
];

/** 「티끌 모임」 탭: 정기모임·벙개모임 기록 */
export function GatheringsView({
  gatherings,
  teas,
  loading,
  error,
  admin,
  onOpen,
  onAdd,
}: {
  gatherings: Gathering[];
  teas: Tea[];
  loading: boolean;
  error: string | null;
  admin: boolean;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);
  const ordinals = useMemo(() => regularOrdinals(gatherings), [gatherings]);

  const stats = useMemo(() => {
    const teaKeys = new Set(gatherings.flatMap((g) => g.teas.map((t) => t.tea_id ?? `name:${t.name}`)));
    return {
      total: gatherings.length,
      regular: gatherings.filter((g) => g.kind === "regular").length,
      casual: gatherings.filter((g) => g.kind === "casual").length,
      teas: teaKeys.size,
      places: new Set(gatherings.map((g) => g.place).filter(Boolean)).size,
    };
  }, [gatherings]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gatherings.filter((g) => {
      if (filter !== "all" && g.kind !== filter) return false;
      if (!q) return true;
      const hay = [
        g.title,
        g.place,
        g.note,
        kindLabel(g, ordinals.get(g.id)),
        ...resolveTeas(g, byId).flatMap((t) => (t.tea ? [teaLabel(t.tea, byId), t.tea.name_ko, t.tea.name_zh_trad] : [t.name])),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [gatherings, filter, query, ordinals, byId]);

  // 맨 앞(가장 최근) 모임은 크게
  const featuredId = shown[0]?.id;
  const years = useMemo(() => {
    const groups = new Map<number, Gathering[]>();
    for (const g of shown) {
      const y = Number(g.held_on.slice(0, 4));
      groups.set(y, [...(groups.get(y) ?? []), g]);
    }
    return [...groups.entries()];
  }, [shown]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10">
      {/* 머리말 */}
      <header className="flex flex-col gap-6 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs tracking-[0.25em] text-muted-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CLUB.logo} alt="" width={20} height={20} className="size-5 rounded-full bg-white object-cover ring-1 ring-border" />
            TEAGGLE CLUB <span className="font-zh tracking-[0.4em]">茶會記錄</span>
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-seal">{CLUB.name}</span> 모임 기록
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            한 잔의 차를 사이에 두고 모였던 날들. 정기모임과 벙개모임에서 함께 마신 차와 그날의 자리를 남겨 둡니다.
          </p>
        </div>
        <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border bg-border text-center md:min-w-[400px]">
          {[
            ["모임", stats.total, "회"],
            ["정기", stats.regular, "회"],
            ["벙개", stats.casual, "회"],
            ["마신 차", stats.teas, "종"],
          ].map(([label, n, unit]) => (
            <div key={label} className="bg-card px-2 py-3">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="font-heading text-2xl font-semibold tabular-nums">
                {n}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* 도구 줄 */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div role="tablist" aria-label="모임 종류" className="flex rounded-full border bg-muted/60 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "relative rounded-full px-3 py-1 text-xs transition-colors",
                filter === f.id ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter === f.id && (
                <motion.span
                  layoutId="gathering-filter"
                  className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 max-sm:order-last max-sm:basis-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 rounded-full bg-card pl-8 text-sm"
            placeholder="차·장소·메모 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {admin && (
          <Button size="sm" className="ml-auto rounded-full" onClick={onAdd}>
            <Plus /> 모임 기록
          </Button>
        )}
      </div>

      {error ? (
        <p className="mt-6 rounded-xl border border-dashed border-destructive/50 p-5 text-sm text-destructive">{error}</p>
      ) : loading && !gatherings.length ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> 모임 기록을 불러오는 중…
        </div>
      ) : !shown.length ? (
        <Empty searching={!!query || filter !== "all"} admin={admin} onAdd={onAdd} />
      ) : (
        <div className="mt-6 space-y-10">
          {years.map(([year, list]) => (
            <section key={year} className="space-y-4">
              <h3 className="flex items-baseline gap-3">
                <span className="font-heading text-2xl font-bold tabular-nums">{year}</span>
                <span className="font-zh text-sm tracking-[0.3em] text-muted-foreground">{ganzhi(year)}年</span>
                <span className="h-px flex-1 self-center bg-border" />
                <span className="text-xs text-muted-foreground">{list.length}번</span>
              </h3>
              <motion.ul layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {list.map((g) => (
                    <GatheringCard
                      key={g.id}
                      g={g}
                      byId={byId}
                      ordinal={ordinals.get(g.id)}
                      onOpen={onOpen}
                      featured={g.id === featuredId}
                    />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-14 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <span className="font-zh text-xs tracking-[0.5em]">一期一會</span>
        <p>함께 마시고 싶다면 인스타그램으로 찾아와 주세요.</p>
        <ClubFollowButton size="sm" />
      </div>
    </div>
  );
}

function GatheringCard({
  g,
  byId,
  ordinal,
  onOpen,
  featured,
}: {
  g: Gathering;
  byId: Map<string, Tea>;
  ordinal?: number;
  onOpen: (id: string) => void;
  featured?: boolean;
}) {
  const teas = resolveTeas(g, byId);
  const p = dateParts(g.held_on);
  const label = kindLabel(g, ordinal);
  return (
    <motion.li
      layout
      className={cn(featured && "sm:col-span-2 lg:col-span-3")}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        onClick={() => onOpen(g.id)}
        className={cn(
          "group flex w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          featured && "md:grid md:grid-cols-[1.35fr_1fr]",
        )}
      >
        <div className={cn("relative overflow-hidden bg-muted", featured ? "aspect-[16/10] md:aspect-auto md:min-h-80" : "aspect-[4/3]")}>
          {g.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.photos[0]}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <CoverArt teas={teas.map((t) => t.tea)} className={cn("absolute inset-0", featured ? "text-2xl" : "text-base")} />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />

          {/* 달력 한 장 같은 날짜 */}
          <div className="absolute top-3 left-3 flex w-14 flex-col items-center overflow-hidden rounded-xl bg-card/95 shadow-md ring-1 ring-black/5 backdrop-blur">
            <span className="w-full bg-seal py-0.5 text-center text-[10px] font-semibold tracking-wider text-white">
              {p.m}월
            </span>
            <span className="font-heading text-2xl leading-8 font-bold tabular-nums">{p.d}</span>
            <span className="pb-1 text-[10px] text-muted-foreground">{p.wd}요일</span>
          </div>
          <KindBadge kind={g.kind} className="absolute top-3 right-3 shadow-sm" />
          {g.photos.length > 1 && (
            <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur">
              <Images className="size-3" /> {g.photos.length}
            </span>
          )}
        </div>

        <div className={cn("flex flex-1 flex-col gap-2.5 p-4", featured && "md:justify-center md:gap-3.5 md:p-7")}>
          {g.title && <p className="text-xs font-medium text-seal">{label}</p>}
          <h4
            className={cn(
              "font-heading leading-snug font-semibold",
              featured ? "line-clamp-2 text-xl md:text-2xl" : "line-clamp-1 text-lg",
            )}
          >
            {g.title || label}
          </h4>
          {(g.place || g.time) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {g.place && (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="size-3.5 shrink-0 text-seal" />
                  <span className="truncate">{g.place}</span>
                </span>
              )}
              {g.time && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 shrink-0" />
                  {formatTime(g.time)}
                </span>
              )}
            </p>
          )}
          {teas.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {teas.slice(0, featured ? 8 : 4).map((t, i) => (
                <li
                  key={`${t.tea_id ?? t.name}-${i}`}
                  className="flex max-w-full items-center gap-1 rounded-full border bg-background/60 px-2 py-0.5 text-xs"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: t.tea ? CATEGORY_META[t.tea.category].color : "var(--muted-foreground)" }}
                  />
                  <span className={cn("truncate", t.tea && "font-zh")}>{t.tea ? teaLabel(t.tea, byId) : t.name}</span>
                </li>
              ))}
              {teas.length > (featured ? 8 : 4) && (
                <li className="rounded-full px-1.5 py-0.5 text-xs text-muted-foreground">+{teas.length - (featured ? 8 : 4)}</li>
              )}
            </ul>
          )}
          {g.note && (
            <p className={cn("text-sm leading-6 text-foreground/75", featured ? "line-clamp-4" : "line-clamp-2")}>{g.note}</p>
          )}
        </div>
      </button>
    </motion.li>
  );
}

function Empty({ searching, admin, onAdd }: { searching: boolean; admin: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="font-zh text-6xl font-bold tracking-[0.3em] text-border">茶會</span>
      <p className="text-sm text-muted-foreground">
        {searching ? "조건에 맞는 모임이 없어요." : "아직 기록된 모임이 없어요. 첫 모임을 남겨 볼까요?"}
      </p>
      {admin && !searching && (
        <Button className="rounded-full" onClick={onAdd}>
          <Plus /> 첫 모임 기록하기
        </Button>
      )}
    </div>
  );
}
