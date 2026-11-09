import { CalendarCheck, Zap } from "lucide-react";
import { CATEGORY_META } from "@/lib/categories";
import type { Gathering, GatheringKind, Tea } from "@/lib/types";
import { cn } from "@/lib/utils";

export const KIND_META: Record<GatheringKind, { ko: string; short: string; zh: string }> = {
  regular: { ko: "정기모임", short: "정기", zh: "定期茶會" },
  casual: { ko: "벙개모임", short: "벙개", zh: "即興茶會" },
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

export function dateParts(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, d: day, wd: WEEKDAYS[new Date(y, m - 1, day).getDay()] };
}

/** 2026. 11. 9. (일) */
export function formatHeld(d: string) {
  const p = dateParts(d);
  return `${p.y}. ${p.m}. ${p.d}. (${p.wd})`;
}

/** 14:00 → 오후 2:00 */
export function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
}

/** 간지(干支) 연도: 2026 → 丙午 */
export function ganzhi(year: number) {
  return STEMS[(((year - 4) % 10) + 10) % 10] + BRANCHES[(((year - 4) % 12) + 12) % 12];
}

/** 정기모임 회차 (날짜 순으로 1회부터) */
export function regularOrdinals(list: Gathering[]) {
  const map = new Map<string, number>();
  [...list]
    .filter((g) => g.kind === "regular")
    .sort((a, b) => a.held_on.localeCompare(b.held_on) || a.time.localeCompare(b.time) || a.created_at.localeCompare(b.created_at))
    .forEach((g, i) => map.set(g.id, i + 1));
  return map;
}

/** 제목이 없을 때 쓰는 이름: 제12회 정기모임 · 11월 벙개모임 */
export function kindLabel(g: Gathering, ordinal?: number) {
  if (g.kind === "regular" && ordinal) return `제${ordinal}회 정기모임`;
  return `${dateParts(g.held_on).m}월 ${KIND_META[g.kind].ko}`;
}

/** 제품이면 상위 차 이름을 앞에: 普洱茶 · 7542 */
export function teaLabel(tea: Tea, byId: Map<string, Tea>) {
  const parent = tea.parent_id ? byId.get(tea.parent_id) : null;
  const name = tea.name_zh || tea.name_ko;
  return parent ? `${parent.name_zh || parent.name_ko} · ${name}` : name;
}

/** 모임에서 마신 차를 등록된 차와 이어서 */
export function resolveTeas(g: Gathering, byId: Map<string, Tea>) {
  return g.teas.map((t) => ({ ...t, tea: t.tea_id ? (byId.get(t.tea_id) ?? null) : null }));
}

export function KindBadge({ kind, className }: { kind: GatheringKind; className?: string }) {
  const Icon = kind === "regular" ? CalendarCheck : Zap;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        kind === "regular"
          ? "bg-seal text-white"
          : "bg-amber-400 text-amber-950",
        className,
      )}
    >
      <Icon className={cn("size-3", kind === "casual" && "fill-current")} />
      {KIND_META[kind].ko}
    </span>
  );
}

/** 사진이 없는 모임의 표지: 마신 차의 다류 색을 섞은 바탕에 茶會 */
export function CoverArt({ teas, className }: { teas: (Tea | null)[]; className?: string }) {
  // --tint-* 는 다크 모드에서 어둡게 바뀌는 다류별 바탕색
  const cats = [...new Set(teas.filter((t): t is Tea => !!t).map((t) => t.category))].slice(0, 2);
  const a = cats[0] ? `var(--tint-${cats[0]})` : "var(--accent)";
  const b = cats[1] ? `var(--tint-${cats[1]})` : cats[0] ? `var(--tint-${cats[0]})` : "var(--secondary)";
  const ink = cats[0] ? CATEGORY_META[cats[0]].color : "var(--muted-foreground)";
  return (
    <div
      className={cn("relative grid place-items-center overflow-hidden", className)}
      style={{ background: `radial-gradient(120% 90% at 15% 10%, ${a}, transparent 60%), radial-gradient(100% 90% at 90% 100%, ${b}, var(--muted))` }}
    >
      <span className="font-zh text-[3.2em] leading-none font-bold tracking-[0.2em] opacity-25 select-none" style={{ color: ink }}>
        茶會
      </span>
    </div>
  );
}
