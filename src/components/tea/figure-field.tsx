"use client";

import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { GripVertical, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { TeaFigure } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 설명 사진: 사진마다 설명(캡션)을 달고, 손잡이를 끌어 순서를 바꿉니다 */
export function FigureField({ value, onChange }: { value: TeaFigure[]; onChange: (v: TeaFigure[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setUploading(true);
    try {
      const { urls } = await api.upload(images);
      const have = new Set(value.map((f) => f.src));
      onChange([...value, ...urls.filter((u) => !have.has(u)).map((src) => ({ src, caption: "" }))]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const setCaption = (src: string, caption: string) =>
    onChange(value.map((f) => (f.src === src ? { ...f, caption } : f)));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <Reorder.Group axis="y" values={value} onReorder={onChange} className="space-y-2">
          <AnimatePresence initial={false}>
            {value.map((f) => (
              <FigureRow
                key={f.src}
                figure={f}
                onCaption={(c) => setCaption(f.src, c)}
                onRemove={() => onChange(value.filter((v) => v.src !== f.src))}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground transition",
          dragOver ? "border-primary bg-secondary" : "hover:bg-muted/60",
        )}
      >
        {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        {uploading ? "올리는 중…" : "찻잎·탕색·엽저·포장·차밭 사진 등을 끌어다 놓거나 눌러서 선택"}
      </motion.button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          upload([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function FigureRow({
  figure,
  onCaption,
  onRemove,
}: {
  figure: TeaFigure;
  onCaption: (caption: string) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={figure}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex gap-2 rounded-lg border bg-card p-2"
    >
      <button
        type="button"
        aria-label="끌어서 순서 바꾸기"
        onPointerDown={(e) => controls.start(e)}
        className="-ml-1 cursor-grab touch-none self-center text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={figure.src} alt="" className="size-20 shrink-0 rounded-md bg-muted object-cover" draggable={false} />
      <Textarea
        rows={3}
        value={figure.caption}
        onChange={(e) => onCaption(e.target.value)}
        placeholder="사진 설명 (예: 2023년 명전 건엽, 3번째 우림 탕색)"
        className="min-h-20 flex-1 resize-none text-sm"
      />
      <button
        type="button"
        aria-label="사진 삭제"
        onClick={onRemove}
        className="self-start rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </Reorder.Item>
  );
}
