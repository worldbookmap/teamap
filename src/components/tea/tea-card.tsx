"use client";

import { motion } from "framer-motion";
import { CupSoda, Layers, MapPin } from "lucide-react";
import { Stars } from "@/components/tasting/star-rating";
import { originNameKo } from "@/lib/towns";
import type { Tea } from "@/lib/types";
import { CategoryBadge, TeaThumb } from "./tea-visual";

export function TeaCard({
  tea,
  onOpen,
  onHover,
  drunk,
  productCount = 0,
  className,
}: {
  tea: Tea;
  /** 마신 횟수와 평균 별점 */
  drunk?: { count: number; avg: number | null };
  /** 등록된 제품 수 */
  productCount?: number;
  onOpen: (tea: Tea) => void;
  onHover: (id: string | null) => void;
  className?: string;
}) {
  return (
    <motion.li
      layout
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        onClick={() => onOpen(tea)}
        onPointerEnter={() => onHover(tea.id)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(tea.id)}
        onBlur={() => onHover(null)}
        className="group flex w-full gap-3 rounded-xl border bg-card p-2.5 text-left shadow-xs transition hover:-translate-y-px hover:border-primary/40 hover:shadow-md"
      >
        <TeaThumb tea={tea} className="size-16 shrink-0 rounded-lg text-[11px] transition group-hover:scale-[1.03]" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="font-zh truncate text-lg font-semibold leading-tight">{tea.name_zh || tea.name_ko}</span>
            <span className="truncate text-sm text-muted-foreground">{tea.name_ko}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={tea.category} />
            {productCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                <Layers className="size-3" /> 제품 {productCount}
              </span>
            )}
            {drunk && drunk.count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-seal/10 px-2 py-0.5 text-[11px] font-medium text-seal">
                <CupSoda className="size-3" /> {drunk.count}번
                {drunk.avg != null && <Stars value={Math.round(drunk.avg * 2) / 2} size="size-2.5" className="ml-0.5" />}
              </span>
            )}
          </div>
          {tea.origins.length > 0 && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {tea.origins.map(originNameKo).join(" · ")}
            </p>
          )}
        </div>
      </button>
    </motion.li>
  );
}
