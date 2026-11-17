"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { TeaFigure } from "@/lib/types";

/** 차 정보 탭의 설명 사진: 캡션과 함께 보여 주고, 누르면 크게 */
export function TeaFigures({ figures }: { figures: TeaFigure[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!figures.length) return null;
  const go = (d: number) => setOpen((i) => (i == null ? i : (i + d + figures.length) % figures.length));
  const cur = open == null ? null : figures[open];

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground">
        사진으로 보기 · <span className="font-zh">圖解</span>
      </h3>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {figures.map((f, i) => (
          <li key={f.src}>
            <button onClick={() => setOpen(i)} className="group block w-full text-left">
              <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.src}
                  alt={f.caption}
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              {f.caption && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 whitespace-pre-line text-muted-foreground">{f.caption}</p>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={cur != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {cur && (
            <>
              <div className="relative grid max-h-[75dvh] place-items-center bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.src} alt={cur.caption} className="max-h-[75dvh] w-full object-contain" />
                {figures.length > 1 && (
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
                      {open! + 1} / {figures.length}
                    </span>
                  </>
                )}
              </div>
              <DialogTitle className="sr-only">설명 사진 {open! + 1}</DialogTitle>
              <DialogDescription className="px-5 py-4 text-sm leading-6 whitespace-pre-line text-foreground/90 empty:hidden">
                {cur.caption}
              </DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
