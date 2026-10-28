"use client";

import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RegionMap } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 참고 지도 전체 화면 보기: 휠·핀치로 확대, 끌어서 이동 */
export function MapViewer({
  map,
  regionLabel,
  admin,
  onClose,
  onEdit,
  onDelete,
}: {
  map: RegionMap | null;
  regionLabel: string;
  admin: boolean;
  onClose: () => void;
  onEdit: (m: RegionMap) => void;
  onDelete: (m: RegionMap) => void;
}) {
  useEffect(() => {
    if (!map) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, onClose]);

  return (
    <AnimatePresence>
      {map && (
        <motion.div
          key={map.id}
          className="fixed inset-0 z-[70] flex flex-col bg-black/90 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label={map.title || "참고 지도"}
        >
          <Viewer map={map} regionLabel={regionLabel} admin={admin} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Viewer({
  map,
  regionLabel,
  admin,
  onClose,
  onEdit,
  onDelete,
}: {
  map: RegionMap;
  regionLabel: string;
  admin: boolean;
  onClose: () => void;
  onEdit: (m: RegionMap) => void;
  onDelete: (m: RegionMap) => void;
}) {
  const [index, setIndex] = useState(0);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [confirming, setConfirming] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const images = map.images;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const z = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([1, 10])
      .on("zoom", (e) => setTransform(e.transform));
    zoomRef.current = z;
    const sel = select(el);
    sel.call(z);
    sel.call(z.transform, zoomIdentity);
    return () => {
      sel.on(".zoom", null);
    };
  }, [index]);

  const zoomBy = (k: number) => {
    if (stageRef.current && zoomRef.current) select(stageRef.current).transition().duration(250).call(zoomRef.current.scaleBy, k);
  };
  const reset = () => {
    if (stageRef.current && zoomRef.current) select(stageRef.current).transition().duration(300).call(zoomRef.current.transform, zoomIdentity);
  };

  return (
    <>
      <header className="flex items-start gap-3 bg-black/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/60">{regionLabel}</p>
          <h2 className="font-heading truncate text-lg font-semibold">{map.title || "참고 지도"}</h2>
          {map.description && <p className="mt-0.5 line-clamp-2 text-sm whitespace-pre-line text-white/75">{map.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {map.link && (
            <Button asChild size="sm" variant="secondary">
              <a href={map.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> 지도 열기
              </a>
            </Button>
          )}
          {admin &&
            (confirming ? (
              <>
                <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setConfirming(false)}>
                  취소
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDelete(map)}>
                  삭제
                </Button>
              </>
            ) : (
              <>
                <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" aria-label="수정" onClick={() => onEdit(map)}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" aria-label="삭제" onClick={() => setConfirming(true)}>
                  <Trash2 />
                </Button>
              </>
            ))}
          <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" aria-label="닫기" onClick={onClose}>
            <X />
          </Button>
        </div>
      </header>

      {images.length ? (
        <div ref={stageRef} className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden active:cursor-grabbing">
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[index]} alt={map.title} draggable={false} className="size-full object-contain select-none" />
          </div>

          <div className="absolute right-3 bottom-3 flex flex-col gap-1 rounded-lg bg-black/60 p-1">
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/15" aria-label="확대" onClick={() => zoomBy(1.6)}>
              <Plus />
            </Button>
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/15" aria-label="축소" onClick={() => zoomBy(1 / 1.6)}>
              <Minus />
            </Button>
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/15" aria-label="원래 크기" onClick={reset}>
              <RotateCcw />
            </Button>
          </div>

          {images.length > 1 && (
            <>
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70"
                aria-label="이전 지도"
                onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              >
                <ChevronLeft />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-1/2 right-16 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70"
                aria-label="다음 지도"
                onClick={() => setIndex((i) => (i + 1) % images.length)}
              >
                <ChevronRight />
              </Button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((src, i) => (
                  <button
                    key={src}
                    aria-label={`${i + 1}번 지도`}
                    onClick={() => setIndex(i)}
                    className={cn("h-1.5 rounded-full bg-white/50 transition-all", i === index ? "w-5 bg-white" : "w-1.5")}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center p-6 text-center text-sm text-white/70">
          <div className="space-y-3">
            <p>이 참고 지도는 외부 링크로 연결되어 있어요.</p>
            {map.link && (
              <Button asChild variant="secondary">
                <a href={map.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> 지도 열기
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
