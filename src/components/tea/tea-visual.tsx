import { CATEGORY_META } from "@/lib/categories";
import type { Tea, TeaCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 사진이 없을 때 쓰는 낙관(落款) 느낌의 자리 표시 */
export function TeaSeal({ tea, className }: { tea: Pick<Tea, "name_zh" | "name_ko" | "category">; className?: string }) {
  const meta = CATEGORY_META[tea.category];
  const chars = [...(tea.name_zh || tea.name_ko)].slice(0, 4);
  return (
    <div
      className={cn("relative grid place-items-center overflow-hidden", className)}
      style={{ background: `radial-gradient(circle at 30% 25%, ${meta.soft}, color-mix(in oklch, ${meta.soft} 70%, ${meta.color}))` }}
    >
      <div
        className={cn("font-zh grid font-bold leading-none", chars.length > 2 ? "grid-cols-2 gap-0.5" : "")}
        style={{ color: meta.color, fontSize: chars.length > 2 ? "1.6em" : "2.4em" }}
      >
        {chars.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
    </div>
  );
}

export function TeaThumb({ tea, className }: { tea: Tea; className?: string }) {
  if (tea.images[0]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tea.images[0]} alt={tea.name_ko} className={cn("object-cover", className)} loading="lazy" />
    );
  }
  return <TeaSeal tea={tea} className={className} />;
}

export function CategoryBadge({ category, className }: { category: TeaCategory; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ background: meta.soft, color: meta.color }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.ko} <span className="font-zh opacity-80">{meta.zh}</span>
    </span>
  );
}
