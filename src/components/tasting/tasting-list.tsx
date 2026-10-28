"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Coffee, Pencil, Plus, Store, Thermometer, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Tasting } from "@/lib/types";
import { Stars } from "./star-rating";

export const formatPrice = (t: Pick<Tasting, "price" | "amount">) =>
  t.price == null ? "" : `${t.price.toLocaleString("ko-KR")}원${t.amount ? ` / ${t.amount}` : ""}`;

export const formatDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}. ${m}. ${day}.`;
};

/** 한 차의 마신 기록 요약 */
export function tastingSummary(list: Tasting[]) {
  const rated = list.filter((t) => t.rating != null);
  return {
    count: list.length,
    avg: rated.length ? rated.reduce((s, t) => s + t.rating!, 0) / rated.length : null,
    last: list[0]?.tasted_on ?? null,
  };
}

export function TastingList({
  tastings,
  admin,
  error,
  onAdd,
  onEdit,
  onDelete,
}: {
  tastings: Tasting[];
  admin: boolean;
  error: string | null;
  onAdd: () => void;
  onEdit: (t: Tasting) => void;
  onDelete: (t: Tasting) => void;
}) {
  const [viewer, setViewer] = useState<string | null>(null);
  const { count, avg, last } = tastingSummary(tastings);

  if (error) {
    return <p className="rounded-lg border border-dashed border-destructive/50 p-4 text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
        {count ? (
          <>
            <span>
              <b className="text-base">{count}</b>번 마심
            </span>
            {avg != null && (
              <span className="flex items-center gap-1.5">
                <Stars value={Math.round(avg * 2) / 2} />
                <b>{avg.toFixed(1)}</b>
              </span>
            )}
            {last && <span className="text-muted-foreground">최근 {formatDate(last)}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">아직 마신 기록이 없습니다.</span>
        )}
        {admin && (
          <Button size="sm" className="ml-auto" onClick={onAdd}>
            <Plus /> 기록 남기기
          </Button>
        )}
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {tastings.map((t) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="space-y-3 rounded-xl border bg-card p-4"
            >
              <TastingEntry t={t} admin={admin} onEdit={onEdit} onDelete={onDelete} onPhoto={setViewer} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {viewer && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewer(null)}
          >
            <motion.img
              src={viewer}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain"
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
            />
            <button className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white" aria-label="닫기">
              <X className="size-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TastingEntry({
  t,
  admin,
  onEdit,
  onDelete,
  onPhoto,
}: {
  t: Tasting;
  admin: boolean;
  onEdit: (t: Tasting) => void;
  onDelete: (t: Tasting) => void;
  onPhoto: (src: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const facts = [
    t.price != null && { icon: Coffee, text: formatPrice(t) },
    t.shop && { icon: Store, text: t.shop },
    t.vintage && { icon: CalendarDays, text: t.vintage },
    t.brewing && { icon: Thermometer, text: t.brewing },
  ].filter(Boolean) as { icon: typeof Coffee; text: string }[];

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="font-heading font-semibold">{formatDate(t.tasted_on)}</span>
        <Stars value={t.rating} />
        {admin && (
          <div className="ml-auto flex gap-1">
            {confirming ? (
              <>
                <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
                  취소
                </Button>
                <Button size="xs" variant="destructive" onClick={() => onDelete(t)}>
                  삭제
                </Button>
              </>
            ) : (
              <>
                <Button size="icon-xs" variant="ghost" aria-label="기록 수정" onClick={() => onEdit(t)}>
                  <Pencil />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="기록 삭제" onClick={() => setConfirming(true)}>
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {t.photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {t.photos.map((src) => (
            <button key={src} onClick={() => onPhoto(src)} className="shrink-0 overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="size-24 object-cover transition hover:scale-105" />
            </button>
          ))}
        </div>
      )}

      {facts.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {facts.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <Icon className="size-3 text-muted-foreground" />
              {text}
            </li>
          ))}
        </ul>
      )}

      {(t.aroma || t.taste) && (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {t.aroma && (
            <div>
              <dt className="text-xs text-muted-foreground">향 · 香</dt>
              <dd className="whitespace-pre-line">{t.aroma}</dd>
            </div>
          )}
          {t.taste && (
            <div>
              <dt className="text-xs text-muted-foreground">맛 · 味</dt>
              <dd className="whitespace-pre-line">{t.taste}</dd>
            </div>
          )}
        </dl>
      )}

      {t.note && <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">{t.note}</p>}
    </>
  );
}
