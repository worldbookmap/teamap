"use client";

import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ImagePlus, Link2, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** 차 사진: 끌어다 놓기/파일 선택/URL 추가, 드래그로 순서 변경 (첫 번째가 대표 사진) */
export function ImageField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [url, setUrl] = useState("");

  const upload = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setUploading(true);
    try {
      const { urls } = await api.upload(images);
      onChange([...value, ...urls]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) return toast.error("http(s):// 로 시작하는 이미지 주소를 넣어 주세요.");
    onChange([...value, u]);
    setUrl("");
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <Reorder.Group axis="x" values={value} onReorder={onChange} className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {value.map((src, i) => (
              <Reorder.Item
                key={src}
                value={src}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="group relative size-20 cursor-grab overflow-hidden rounded-lg border bg-muted active:cursor-grabbing"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" draggable={false} />
                {i === 0 && (
                  <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-seal px-1 text-[10px] text-white">
                    <Star className="size-2.5 fill-current" /> 대표
                  </span>
                )}
                <button
                  type="button"
                  aria-label="사진 삭제"
                  onClick={() => onChange(value.filter((v) => v !== src))}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </Reorder.Item>
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
        {uploading ? "올리는 중…" : "사진을 끌어다 놓거나 눌러서 선택 (여러 장 가능, 8MB 이하)"}
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
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="또는 이미지 주소(URL) 붙여넣기"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={addUrl} disabled={!url.trim()}>
          추가
        </Button>
      </div>
    </div>
  );
}
