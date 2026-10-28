"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** 별점 표시 (0.5 단위) */
export function Stars({ value, className, size }: { value: number | null; className?: string; size?: string }) {
  if (value == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-amber-500", className)} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} fill={Math.max(0, Math.min(1, value - i + 1))} size={size} />
      ))}
    </span>
  );
}

function StarIcon({ fill, size = "size-3.5" }: { fill: number; size?: string }) {
  return (
    <span className={cn("relative inline-block", size)}>
      <Star className={cn("absolute inset-0 text-amber-500/35", size)} />
      {fill > 0 && (
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
          <Star className={cn("fill-current text-amber-500", size)} />
        </span>
      )}
    </span>
  );
}

/** 별점 입력: 별의 왼쪽 절반은 0.5점, 오른쪽 절반은 1점. 같은 값을 다시 누르면 지움 */
export function StarInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex" onPointerLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative">
            <StarIcon fill={Math.max(0, Math.min(1, shown - i + 1))} size="size-7" />
            {[i - 0.5, i].map((v, half) => (
              <button
                key={v}
                type="button"
                aria-label={`${v}점`}
                className={cn("absolute inset-y-0 w-1/2", half ? "right-0" : "left-0")}
                onPointerEnter={() => setHover(v)}
                onClick={() => onChange(value === v ? null : v)}
              />
            ))}
          </span>
        ))}
      </div>
      <span className="w-14 text-sm tabular-nums text-muted-foreground">{shown ? `${shown.toFixed(1)}점` : "평가 없음"}</span>
    </div>
  );
}
