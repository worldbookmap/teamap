"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, EyeOff, Pencil, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { HanjaConverter } from "@/lib/hanja";
import { CATEGORY_META } from "@/lib/categories";
import { matchesQuery } from "@/lib/tea-utils";
import { TEA_CATEGORIES, type Tea } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TeaThumb } from "./tea-visual";

const KEY = "teaggle:today-teas";
const SHOW_KEY = "teaggle:today-teas-shown";

/** 세미나용 오늘의 차 (고른 순서대로) 와 지도에 보일지 여부. 이 브라우저에만 저장 */
export function useTodayTeas() {
  const [ids, setIds] = useState<string[]>([]);
  const [shown, setShownState] = useState(true);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 렌더 뒤 저장해 둔 값을 한 번 읽음 (SSR 과 맞추기 위해)
      if (Array.isArray(v)) setIds(v.filter((x) => typeof x === "string"));
      setShownState(localStorage.getItem(SHOW_KEY) !== "0");
    } catch {}
  }, []);
  const update = useCallback((next: string[]) => {
    setIds(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);
  const setShown = useCallback((v: boolean) => {
    setShownState(v);
    try {
      localStorage.setItem(SHOW_KEY, v ? "1" : "0");
    } catch {}
  }, []);
  return { ids, setIds: update, shown, setShown };
}

/** 오늘의 차 고르기: 고른 순서가 곧 번호 (시음 순서) */
export function TodayTeaPicker({
  open,
  onOpenChange,
  teas,
  selected,
  onChange,
  conv,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teas: Tea[];
  selected: string[];
  onChange: (ids: string[]) => void;
  conv: HanjaConverter | null;
}) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);
  /** 대표 차 아래에 그 제품을 붙여, 다류 순으로 */
  const rows = useMemo(() => {
    const simplify = conv?.simplify.bind(conv);
    const products = new Map<string, Tea[]>();
    for (const t of teas) if (t.parent_id) products.set(t.parent_id, [...(products.get(t.parent_id) ?? []), t]);
    const out: { tea: Tea; product: boolean }[] = [];
    const tops = teas
      .filter((t) => !t.parent_id || !byId.has(t.parent_id))
      .sort(
        (a, b) =>
          TEA_CATEGORIES.indexOf(a.category) - TEA_CATEGORIES.indexOf(b.category) ||
          (a.name_ko || a.name_zh).localeCompare(b.name_ko || b.name_zh, "ko"),
      );
    for (const t of tops) {
      const kids = products.get(t.id) ?? [];
      const hit = (x: Tea) => matchesQuery(x, query, simplify) || (!!query.trim() && x.maker.includes(query.trim()));
      const kidsHit = kids.filter(hit);
      if (!hit(t) && !kidsHit.length) continue;
      out.push({ tea: t, product: false });
      for (const k of query.trim() ? kidsHit : kids) out.push({ tea: k, product: true });
    }
    return out;
  }, [teas, byId, query, conv]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const chosen = selected.map((id) => byId.get(id)).filter((t): t is Tea => !!t);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent className="flex max-h-[88dvh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 fill-today text-today" /> 오늘의 차
          </DialogTitle>
          <DialogDescription>세미나에서 마실 차를 고르면 지도에서 그 산지가 강조돼요. 고른 순서가 번호가 돼요.</DialogDescription>
        </DialogHeader>

        {/* 고른 차 (누르면 빠짐) */}
        <div className="flex min-h-9 flex-wrap items-center gap-1.5">
          {chosen.length ? (
            chosen.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className="group flex items-center gap-1.5 rounded-full border border-today/50 bg-today/10 py-1 pr-2 pl-1 text-xs font-medium"
              >
                <span className="grid size-5 place-items-center rounded-full bg-today text-[11px] font-bold text-white">{i + 1}</span>
                <span className="font-zh">{t.name_zh || t.name_ko}</span>
                {t.name_zh && <span className="text-muted-foreground">{t.name_ko}</span>}
                <X className="size-3 text-muted-foreground group-hover:text-foreground" />
              </button>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">아직 고른 차가 없어요. 아래에서 골라 주세요.</span>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="차 이름·산지로 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <ul className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
          {rows.map(({ tea: t, product }) => {
            const n = selected.indexOf(t.id);
            const on = n >= 0;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-muted",
                    product && "pl-8",
                    on && "bg-today/10 hover:bg-today/15",
                  )}
                >
                  <TeaThumb tea={t} className={cn("shrink-0 rounded-lg text-[8px]", product ? "size-8" : "size-10")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-zh truncate font-semibold">{t.name_zh || t.name_ko}</span>
                      {t.name_zh && <span className="truncate text-sm text-muted-foreground">{t.name_ko}</span>}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full" style={{ background: CATEGORY_META[t.category].color }} />
                      {product ? `제품${t.maker ? ` · ${t.maker}` : ""}` : CATEGORY_META[t.category].ko}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold transition",
                      on ? "border-today bg-today text-white" : "border-border text-transparent",
                    )}
                  >
                    {on ? n + 1 : <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
          {!rows.length && <li className="py-8 text-center text-sm text-muted-foreground">찾는 차가 없어요.</li>}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" disabled={!selected.length} onClick={() => onChange([])}>
            모두 빼기
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            완료 {selected.length > 0 && `· ${selected.length}종`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 지도 위 오늘의 차 띠: 번호·이름 (누르면 차 정보, 올리면 지도에서 그 차 선 강조) */
export function TodayTeaBar({
  teas,
  large,
  onOpen,
  onHover,
  onEdit,
  onHide,
}: {
  teas: Tea[];
  large?: boolean;
  onOpen: (id: string) => void;
  onHover: (id: string | null) => void;
  onEdit: () => void;
  onHide: () => void;
}) {
  return (
    <AnimatePresence>
      {teas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={cn(
            "pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-today/40 bg-card/90 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md",
            large ? "gap-2.5 px-4 py-3" : "px-2.5 py-2",
          )}
        >
          <span className={cn("flex items-center gap-1 font-semibold text-today", large ? "text-lg" : "text-xs")}>
            <Star className={cn("fill-today", large ? "size-5" : "size-3.5")} />
            오늘의 차
          </span>
          {teas.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpen(t.id)}
              onPointerEnter={() => onHover(t.id)}
              onPointerLeave={() => onHover(null)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border bg-card transition hover:border-today hover:bg-today/10",
                large ? "py-1 pr-3 pl-1 text-lg" : "py-0.5 pr-2 pl-0.5 text-xs",
              )}
            >
              <span
                className={cn("grid place-items-center rounded-full font-bold text-white", large ? "size-7 text-sm" : "size-5 text-[11px]")}
                style={{ background: CATEGORY_META[t.category].color }}
              >
                {i + 1}
              </span>
              <span className="font-zh font-semibold">{t.name_zh || t.name_ko}</span>
              {t.name_zh && <span className="text-muted-foreground">{t.name_ko}</span>}
            </button>
          ))}
          <Button size={large ? "icon" : "icon-xs"} variant="ghost" onClick={onEdit} aria-label="오늘의 차 고치기">
            <Pencil />
          </Button>
          <Button size={large ? "icon" : "icon-xs"} variant="ghost" onClick={onHide} aria-label="오늘의 차 숨기기" title="지도에서 숨기기">
            <EyeOff />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
