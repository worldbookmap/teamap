"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, Leaf, MapPin, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryBadge, TeaThumb } from "@/components/tea/tea-visual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Gathering, Tea } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CoverArt, formatHeld, formatTime, KIND_META, KindBadge, kindLabel, resolveTeas, teaLabel } from "./gathering-utils";

export function GatheringDetailDialog({
  gathering,
  ordinal,
  teas,
  admin,
  onOpenChange,
  onOpenTea,
  onEdit,
  onDelete,
}: {
  gathering: Gathering | null;
  ordinal?: number;
  teas: Tea[];
  admin: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTea: (teaId: string) => void;
  onEdit: (g: Gathering) => void;
  onDelete: (g: Gathering) => void;
}) {
  return (
    <Dialog open={!!gathering} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {gathering && (
          <Detail
            key={gathering.id}
            g={gathering}
            ordinal={ordinal}
            teas={teas}
            admin={admin}
            onOpenTea={onOpenTea}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  g,
  ordinal,
  teas,
  admin,
  onOpenTea,
  onEdit,
  onDelete,
}: {
  g: Gathering;
  ordinal?: number;
  teas: Tea[];
  admin: boolean;
  onOpenTea: (teaId: string) => void;
  onEdit: (g: Gathering) => void;
  onDelete: (g: Gathering) => void;
}) {
  const byId = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);
  const drunk = resolveTeas(g, byId);
  const [confirming, setConfirming] = useState(false);
  const label = kindLabel(g, ordinal);

  return (
    <div>
      {g.photos.length ? (
        <PhotoCarousel photos={g.photos} />
      ) : (
        <CoverArt teas={drunk.map((t) => t.tea)} className="aspect-[16/7] w-full rounded-t-xl text-3xl" />
      )}

      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={g.kind} />
            <span className="font-zh text-xs tracking-[0.3em] text-muted-foreground">{KIND_META[g.kind].zh}</span>
          </div>
          {g.title && <p className="text-sm font-medium text-seal">{label}</p>}
          <DialogTitle className="font-heading text-2xl leading-snug font-bold sm:text-3xl">{g.title || label}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{formatHeld(g.held_on)}</span>
              {g.time && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" /> {formatTime(g.time)}
                </span>
              )}
              {g.place && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-seal" /> {g.place}
                </span>
              )}
            </div>
          </DialogDescription>
        </div>

        {drunk.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="flex items-baseline gap-2 text-xs font-medium tracking-wider text-muted-foreground">
              마신 차 <span className="font-zh">品茗</span>
              <span className="ml-auto tabular-nums">{drunk.length}종</span>
            </h3>
            <ol className="grid gap-2 sm:grid-cols-2">
              {drunk.map((t, i) => (
                <motion.li
                  key={`${t.tea_id ?? t.name}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.035 }}
                >
                  {t.tea ? (
                    <button
                      onClick={() => onOpenTea(t.tea!.id)}
                      className="group flex w-full items-center gap-3 rounded-xl border bg-card p-2 text-left transition hover:border-primary/40 hover:shadow-sm"
                    >
                      <span className="relative shrink-0">
                        <TeaThumb tea={t.tea} className="size-12 rounded-lg text-[9px]" />
                        <span className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background tabular-nums">
                          {i + 1}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="font-zh block truncate font-semibold">{teaLabel(t.tea, byId)}</span>
                        <span className="flex items-center gap-1.5">
                          {t.tea.name_ko && <span className="truncate text-xs text-muted-foreground">{t.tea.name_ko}</span>}
                          <CategoryBadge category={t.tea.category} className="shrink-0 px-1.5 py-0 text-[10px]" />
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed p-2">
                      <span className="relative grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Leaf className="size-5" />
                        <span className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background tabular-nums">
                          {i + 1}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">지도에 등록되지 않은 차</span>
                      </span>
                    </div>
                  )}
                </motion.li>
              ))}
            </ol>
          </section>
        )}

        {g.note && (
          <section className="space-y-2.5">
            <h3 className="text-xs font-medium tracking-wider text-muted-foreground">
              메모 <span className="font-zh">茶記</span>
            </h3>
            <p className="rounded-xl border-l-2 border-seal/60 bg-muted/50 px-4 py-3 leading-7 whitespace-pre-line text-foreground/90">
              {g.note}
            </p>
          </section>
        )}

        {admin && (
          <div className="flex justify-end gap-2 border-t pt-4">
            {confirming ? (
              <>
                <span className="mr-auto self-center text-sm text-destructive">이 모임 기록을 삭제할까요?</span>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  취소
                </Button>
                <Button variant="destructive" onClick={() => onDelete(g)}>
                  <Trash2 /> 삭제
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
                  <Trash2 /> 삭제
                </Button>
                <Button onClick={() => onEdit(g)}>
                  <Pencil /> 수정
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 모임 사진: 잘리지 않게 전체를 보여 주고, 같은 사진을 흐리게 깔아 빈 곳을 채움 */
function PhotoCarousel({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (d: number) => {
    setDir(d);
    setIndex((i) => (i + d + photos.length) % photos.length);
  };
  const src = photos[index];

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-black sm:aspect-[16/10]">
        <AnimatePresence initial={false}>
          <motion.img
            key={`bg-${src}`}
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        </AnimatePresence>
        <AnimatePresence initial={false} custom={dir}>
          <motion.img
            key={src}
            src={src}
            alt={`모임 사진 ${index + 1}`}
            className="absolute inset-0 size-full object-contain"
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag={photos.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => Math.abs(info.offset.x) > 60 && go(info.offset.x < 0 ? 1 : -1)}
          />
        </AnimatePresence>
        {photos.length > 1 && (
          <>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur"
              onClick={() => go(-1)}
              aria-label="이전 사진"
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur"
              onClick={() => go(1)}
              aria-label="다음 사진"
            >
              <ChevronRight />
            </Button>
            <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white tabular-nums backdrop-blur">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-6 pb-1">
          {photos.map((p, i) => (
            <button
              key={p}
              aria-label={`${i + 1}번 사진`}
              onClick={() => {
                setDir(i > index ? 1 : -1);
                setIndex(i);
              }}
              className={cn(
                "size-14 shrink-0 overflow-hidden rounded-lg ring-2 transition",
                i === index ? "ring-seal" : "opacity-60 ring-transparent hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
