"use client";

import { motion, Reorder } from "framer-motion";
import { GripVertical, Leaf, Loader2, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImageField } from "@/components/tea/image-field";
import { TeaThumb } from "@/components/tea/tea-visual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HanjaConverter } from "@/lib/hanja";
import { api } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";
import { matchesQuery } from "@/lib/tea-utils";
import { GATHERING_KINDS, type Gathering, type GatheringInput, type GatheringTea, type Tea } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KIND_META, teaLabel } from "./gathering-utils";

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const empty = (): GatheringInput => ({
  kind: "regular",
  held_on: today(),
  time: "",
  title: "",
  place: "",
  photos: [],
  teas: [],
  note: "",
});

export function GatheringFormDialog({
  open,
  onOpenChange,
  gathering,
  teas,
  places,
  conv,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gathering?: Gathering | null;
  teas: Tea[];
  /** 전에 모였던 장소 (입력 제안) */
  places: string[];
  conv: HanjaConverter | null;
  onSaved: (g: Gathering) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {open && (
          <GatheringForm
            key={gathering?.id ?? "new"}
            gathering={gathering}
            teas={teas}
            places={places}
            conv={conv}
            onCancel={() => onOpenChange(false)}
            onSaved={(g) => {
              onSaved(g);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GatheringForm({
  gathering,
  teas,
  places,
  conv,
  onCancel,
  onSaved,
}: {
  gathering?: Gathering | null;
  teas: Tea[];
  places: string[];
  conv: HanjaConverter | null;
  onCancel: () => void;
  onSaved: (g: Gathering) => void;
}) {
  const [form, setForm] = useState<GatheringInput>(() => {
    if (!gathering) return empty();
    const { kind, held_on, time, title, place, photos, teas, note } = gathering;
    return { kind, held_on, time, title, place, photos, teas, note };
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof GatheringInput>(k: K, v: GatheringInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const placeList = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = gathering ? await api.updateGathering(gathering.id, form) : await api.createGathering(form);
      toast.success(gathering ? "모임 기록을 수정했습니다." : "모임 기록을 남겼습니다.");
      onSaved(saved);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl">{gathering ? "모임 기록 수정" : "모임 기록 남기기"}</DialogTitle>
        <DialogDescription>함께 마신 차는 지도에 등록된 차와 연결돼요.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>모임 종류</Label>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {GATHERING_KINDS.map((k) => {
            const active = form.kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("kind", k)}
                className={cn(
                  "flex items-baseline justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                  active
                    ? k === "regular"
                      ? "border-seal bg-seal/10 font-semibold text-seal"
                      : "border-amber-400 bg-amber-100/70 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
                    : "hover:bg-muted",
                )}
              >
                {KIND_META[k].ko}
                <span className="font-zh text-xs font-normal opacity-70">{KIND_META[k].zh}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="held_on">날짜</Label>
          <Input id="held_on" type="date" required value={form.held_on} onChange={(e) => set("held_on", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time">
            시간 <span className="font-normal text-muted-foreground">(선택)</span>
          </Label>
          <Input id="time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="place">장소</Label>
          <Input
            id="place"
            list={placeList}
            placeholder="성수동 ○○찻집, 회원 집…"
            value={form.place}
            onChange={(e) => set("place", e.target.value)}
          />
          <datalist id={placeList}>
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">
            제목 <span className="font-normal text-muted-foreground">(선택)</span>
          </Label>
          <Input id="title" placeholder="무이암차 비교 시음" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>사진</Label>
        <ImageField value={form.photos} onChange={(v) => set("photos", v)} />
      </div>

      <div className="space-y-1.5">
        <Label>
          마신 차 <span className="font-normal text-muted-foreground">(마신 순서대로, 끌어서 순서 변경)</span>
        </Label>
        <TeaPicker teas={teas} conv={conv} value={form.teas} onChange={(v) => set("teas", v)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">메모</Label>
        <Textarea
          id="note"
          rows={5}
          placeholder="함께한 사람, 이야기 나눈 것, 인상 깊었던 차…"
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {gathering ? "저장" : "기록하기"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 등록된 차를 이름(한글·간체·번체·제조사)으로 찾아 고르고, 없으면 이름만으로 추가 */
function TeaPicker({
  teas,
  conv,
  value,
  onChange,
}: {
  teas: Tea[];
  conv: HanjaConverter | null;
  value: GatheringTea[];
  onChange: (v: GatheringTea[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const byId = useMemo(() => new Map(teas.map((t) => [t.id, t])), [teas]);
  // 순서 바꾸기용 안정된 키 (같은 차를 두 번 넣어도 구분)
  const [keys, setKeys] = useState(() => value.map(() => crypto.randomUUID()));

  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return [];
    const simplify = conv?.simplify.bind(conv);
    const chosen = new Set(value.map((v) => v.tea_id));
    const lower = q.toLowerCase();
    const score = (t: Tea) => {
      const names = [t.name_ko, t.name_zh, t.name_zh_trad].map((n) => n.toLowerCase());
      if (names.includes(lower)) return 0;
      if (names.some((n) => n.startsWith(lower))) return 1;
      return t.parent_id ? 3 : 2;
    };
    return teas
      .filter((t) => !chosen.has(t.id) && (matchesQuery(t, q, simplify) || t.maker.includes(q) || teaLabel(t, byId).includes(q)))
      .sort((a, b) => score(a) - score(b))
      .slice(0, 8);
  }, [q, teas, conv, value, byId]);
  const exact = results.some((t) => [t.name_ko, t.name_zh, t.name_zh_trad].includes(q));
  const options = [...results.map((t) => ({ tea: t })), ...(q && !exact ? [{ tea: null }] : [])];
  const cur = Math.min(active, Math.max(options.length - 1, 0));

  const add = (tea: Tea | null) => {
    onChange([...value, tea ? { tea_id: tea.id, name: teaLabel(tea, byId) } : { tea_id: null, name: q }]);
    setKeys((k) => [...k, crypto.randomUUID()]);
    setQuery("");
    setActive(0);
  };
  const removeAt = (i: number) => {
    onChange(value.filter((_, j) => j !== i));
    setKeys((k) => k.filter((_, j) => j !== i));
  };

  const items = value.map((v, i) => ({ key: keys[i] ?? `k${i}`, v }));

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <Reorder.Group
          axis="y"
          values={items.map((x) => x.key)}
          onReorder={(order) => {
            const map = new Map(items.map((x) => [x.key, x.v]));
            setKeys(order);
            onChange(order.map((k) => map.get(k)!));
          }}
          className="space-y-1.5"
        >
          {items.map(({ key, v }, i) => {
            const tea = v.tea_id ? byId.get(v.tea_id) : null;
            return (
              <Reorder.Item
                key={key}
                value={key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex cursor-grab items-center gap-2 rounded-lg border bg-card p-1.5 pr-2 active:cursor-grabbing",
                  !tea && "border-dashed",
                )}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
                <span className="w-4 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                {tea ? (
                  <TeaThumb tea={tea} className="size-8 shrink-0 rounded-md text-[7px]" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Leaf className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-medium", tea && "font-zh")}>
                    {tea ? teaLabel(tea, byId) : v.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {tea ? `${tea.name_ko} · ${CATEGORY_META[tea.category].ko}` : "등록되지 않은 차 (이름만)"}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="빼기"
                  onClick={() => removeAt(i)}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="차 이름으로 찾기 (용정, 龍井, 7542…)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, options.length - 1));
            else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
            else if (e.key === "Enter" && options[cur]) add(options[cur].tea);
            else if (e.key === "Enter") {
              // 빈 칸에서 Enter 로 폼이 제출되지 않게
            } else return;
            e.preventDefault();
          }}
        />
      </div>
      {options.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-sm"
        >
          {options.map((o, i) =>
            o.tea ? (
              <li key={o.tea.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(o.tea)}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left", i === cur && "bg-muted")}
                >
                  <TeaThumb tea={o.tea} className="size-8 shrink-0 rounded-md text-[7px]" />
                  <span className="min-w-0 flex-1">
                    <span className="font-zh block truncate text-sm font-medium">{teaLabel(o.tea, byId)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.tea.name_ko}
                      {o.tea.maker && <span className="font-zh"> · {o.tea.maker}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full" style={{ background: CATEGORY_META[o.tea.category].color }} />
                    {CATEGORY_META[o.tea.category].ko.replace(/\(.*\)/, "")}
                  </span>
                </button>
              </li>
            ) : (
              <li key="__free">
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(null)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground",
                    i === cur && "bg-muted text-foreground",
                  )}
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="truncate">
                    <b className="font-medium text-foreground">‘{q}’</b> 지도에 없는 차로 이름만 추가
                  </span>
                </button>
              </li>
            ),
          )}
        </motion.ul>
      )}
    </div>
  );
}
