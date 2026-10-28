"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HanjaConverter } from "@/lib/hanja";
import { LEVEL_KO, searchRegions, type RegionIndex, type RegionSearchItem } from "@/lib/regions";
import { loadTownIndex, searchTowns, type TownSearchItem } from "@/lib/towns";
import { cn } from "@/lib/utils";

/** 지도 위 지역 검색: 고르면 그 지역으로 이동 */
export function RegionSearch({
  search,
  conv,
  regions,
  onSelect,
  onSelectTown,
}: {
  search: RegionSearchItem[];
  conv: HanjaConverter | null;
  regions: RegionIndex | null;
  onSelect: (adcode: string) => void;
  onSelectTown: (town: TownSearchItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [townIndex, setTownIndex] = useState<TownSearchItem[] | null>(null);
  useEffect(() => {
    if (!open || !conv || townIndex) return;
    let alive = true;
    loadTownIndex(conv).then((t) => alive && setTownIndex(t));
    return () => {
      alive = false;
    };
  }, [open, conv, townIndex]);

  type Entry = { kind: "region"; item: RegionSearchItem } | { kind: "town"; item: TownSearchItem };
  const results = useMemo<Entry[]>(() => {
    if (!conv) return [];
    const simplify = (x: string) => conv.simplify(x);
    const r = searchRegions(search, query, simplify, 10).map((item) => ({ kind: "region" as const, item }));
    const t = townIndex ? searchTowns(townIndex, query, simplify, 8).map((item) => ({ kind: "town" as const, item })) : [];
    return [...r, ...t];
  }, [search, query, conv, townIndex]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  // 바깥을 누르면 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery("");
      setActive(0);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (e: Entry) => {
    if (e.kind === "region") onSelect(e.item.adcode);
    else onSelectTown(e.item);
    close();
  };
  const countyLabel = (county: string) => {
    const r = regions?.[county];
    if (!r) return "";
    const city = r.p ? regions?.[r.p] : null;
    return [city?.n, r.n].filter(Boolean).join(" ");
  };

  return (
    <div ref={boxRef} className="relative flex justify-end">
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.div
            key="input"
            initial={{ width: 36, opacity: 0 }}
            animate={{ width: "min(18rem, calc(100vw - 2rem))", opacity: 1 }}
            exit={{ width: 36, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  pick(results[active]);
                }
              }}
              placeholder="지역·향진 찾기 — 항주, 무이산, 이무…"
              aria-label="지역 검색"
              className="h-9 w-full rounded-lg border bg-card/95 pr-8 pl-8 text-sm shadow-sm backdrop-blur outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              aria-label="검색 닫기"
              onClick={close}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>

            {query && (
              <ul className="absolute right-0 z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                {results.map((e, i) => (
                  <li key={`${e.kind}-${e.kind === "region" ? e.item.adcode : e.item.code}`}>
                    {e.kind === "town" && (i === 0 || results[i - 1].kind !== "town") && (
                      <div className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground">향·진 · 乡镇</div>
                    )}
                    <button
                      type="button"
                      onPointerEnter={() => setActive(i)}
                      onClick={() => pick(e)}
                      className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm", i === active && "bg-accent")}
                    >
                      <MapPin className={cn("mt-0.5 size-3.5 shrink-0", e.kind === "region" ? "text-seal" : "text-muted-foreground")} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="font-zh font-medium">{e.item.zh}</span>
                          <span>{e.item.ko}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {e.kind === "region" ? LEVEL_KO[e.item.level] : e.item.lng != null ? "향·진" : "향·진 (위치 없음)"}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.kind === "region"
                            ? e.item.full_ko.split(" ").slice(0, -1).join(" ") || "중국"
                            : countyLabel(e.item.county)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-2 py-2 text-xs text-muted-foreground">{townIndex ? "찾는 지역이 없어요." : "찾는 중…"}</li>
                )}
              </ul>
            )}
          </motion.div>
        ) : (
          <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button
              size="icon"
              variant="outline"
              className="size-9 bg-card/90 shadow-sm backdrop-blur"
              aria-label="지역 검색"
              onClick={() => setOpen(true)}
            >
              <Search />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
