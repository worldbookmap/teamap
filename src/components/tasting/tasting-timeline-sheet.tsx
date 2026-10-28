"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { TeaThumb } from "@/components/tea/tea-visual";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Tasting, Tea } from "@/lib/types";
import { Stars } from "./star-rating";
import { formatDate, formatPrice } from "./tasting-list";

/** 내가 마신 모든 기록을 날짜순으로 */
export function TastingTimelineSheet({
  open,
  onOpenChange,
  tastings,
  teas,
  error,
  onOpenTea,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tastings: Tasting[];
  teas: Tea[];
  error: string | null;
  onOpenTea: (teaId: string) => void;
}) {
  const teaById = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);
  const months = useMemo(() => {
    const groups = new Map<string, Tasting[]>();
    for (const t of tastings) {
      const key = t.tasted_on.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()];
  }, [tastings]);
  const drunkTeas = new Set(tastings.map((t) => t.tea_id)).size;
  const spent = tastings.reduce((s, t) => s + (t.price ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-xl">내가 마신 차</SheetTitle>
          <SheetDescription>
            {tastings.length
              ? `${drunkTeas}종 · ${tastings.length}번${spent ? ` · 기록된 가격 합계 ${spent.toLocaleString("ko-KR")}원` : ""}`
              : "차 상세의 「마신 기록」 탭에서 기록을 남길 수 있어요."}
          </SheetDescription>
        </SheetHeader>

        {error && <p className="m-4 rounded-lg border border-dashed border-destructive/50 p-4 text-sm text-destructive">{error}</p>}

        <div className="space-y-6 p-4">
          {months.map(([month, list]) => (
            <section key={month} className="space-y-2">
              <h3 className="font-heading text-sm font-semibold text-muted-foreground">
                {Number(month.slice(0, 4))}년 {Number(month.slice(5))}월
              </h3>
              <ul className="space-y-2">
                {list.map((t, i) => {
                  const tea = teaById.get(t.tea_id);
                  if (!tea) return null;
                  return (
                    <motion.li
                      key={t.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.03 }}
                    >
                      <button
                        onClick={() => onOpenTea(tea.id)}
                        className="flex w-full gap-3 rounded-xl border bg-card p-2.5 text-left transition hover:border-primary/40 hover:shadow-sm"
                      >
                        {t.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.photos[0]} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <TeaThumb tea={tea} className="size-14 shrink-0 rounded-lg text-[10px]" />
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-baseline gap-2">
                            <span className="font-zh truncate font-semibold">{tea.name_zh || tea.name_ko}</span>
                            <span className="truncate text-xs text-muted-foreground">{tea.name_ko}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(t.tasted_on)}</span>
                            <Stars value={t.rating} />
                          </div>
                          {(t.price != null || t.note) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {[formatPrice(t), t.note.split("\n")[0]].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
