"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";
import type { HanjaConverter } from "@/lib/hanja";
import type { RegionIndex, RegionSearchItem } from "@/lib/regions";
import { TEA_CATEGORIES, type Tea, type TeaInput, type TeaOrigin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImageField } from "./image-field";
import { NameFields } from "./name-fields";
import { OriginPicker } from "./origin-picker";

/** 새 차. 제품(parent 있음)이면 상위 차의 다류·산지를 기본값으로 */
const empty = (origins: TeaOrigin[] = [], parent?: Tea | null): TeaInput => ({
  name_zh: "",
  name_zh_trad: "",
  name_ko: "",
  category: parent?.category ?? "green",
  description: "",
  images: [],
  origins: parent ? parent.origins : origins,
  parent_id: parent?.id ?? null,
  maker: "",
});

export function TeaFormDialog({
  open,
  onOpenChange,
  tea,
  parent,
  initialOrigins,
  editFirstOriginDetail,
  conv,
  regions,
  regionSearch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tea?: Tea | null;
  /** 제품을 등록·수정할 때의 상위 차 */
  parent?: Tea | null;
  initialOrigins?: TeaOrigin[];
  /** 열자마자 첫 산지의 세부 산지 편집 열기 */
  editFirstOriginDetail?: boolean;
  conv: HanjaConverter | null;
  regions: RegionIndex | null;
  regionSearch: RegionSearchItem[];
  onSaved: (tea: Tea) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {open && (
          <TeaForm
            key={tea?.id ?? `new-${parent?.id ?? ""}`}
            tea={tea}
            parent={parent}
            initialOrigins={initialOrigins}
            editFirstOriginDetail={editFirstOriginDetail}
            conv={conv}
            regions={regions}
            regionSearch={regionSearch}
            onCancel={() => onOpenChange(false)}
            onSaved={(t) => {
              onSaved(t);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TeaForm({
  tea,
  parent,
  initialOrigins,
  editFirstOriginDetail,
  conv,
  regions,
  regionSearch,
  onCancel,
  onSaved,
}: {
  tea?: Tea | null;
  parent?: Tea | null;
  initialOrigins?: TeaOrigin[];
  editFirstOriginDetail?: boolean;
  conv: HanjaConverter | null;
  regions: RegionIndex | null;
  regionSearch: RegionSearchItem[];
  onCancel: () => void;
  onSaved: (tea: Tea) => void;
}) {
  const [form, setForm] = useState<TeaInput>(() => (tea ? { ...tea } : empty(initialOrigins, parent)));
  const isProduct = !!(parent || tea?.parent_id);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof TeaInput>(k: K, v: TeaInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_zh && !form.name_ko) return toast.error("차 이름을 입력해 주세요.");
    setSaving(true);
    try {
      const saved = tea ? await api.updateTea(tea.id, form) : await api.createTea(form);
      toast.success(tea ? "수정했습니다." : `${saved.name_ko || saved.name_zh}을(를) 등록했습니다.`);
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
        <DialogTitle className="font-heading text-xl">
          {isProduct ? (tea ? "제품 정보 수정" : "제품 등록") : tea ? "차 정보 수정" : "새 차 등록"}
        </DialogTitle>
        <DialogDescription>
          {parent && (
            <span className="mb-1 block text-foreground">
              <span className="font-zh">{parent.name_zh}</span> {parent.name_ko} 의 제품 — 예: 大益 7542, 下关 沱茶
            </span>
          )}
          한자로 이름을 쓰면 번체와 한글 독음이 자동으로 채워집니다.
        </DialogDescription>
      </DialogHeader>

      <NameFields
        value={form}
        conv={conv}
        onChange={(n) => setForm((f) => ({ ...f, ...n }))}
      />

      {isProduct && (
        <div className="space-y-1.5">
          <Label htmlFor="maker" className="flex justify-between">
            제조사·차창
            {conv && /\p{Script=Han}/u.test(form.maker) && !/\(/.test(form.maker) && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => set("maker", annotateHanja(form.maker, conv))}
              >
                한글 독음 달기
              </button>
            )}
          </Label>
          <Input
            id="maker"
            className="font-zh"
            placeholder="勐海茶厂, 下关茶厂, 大益…"
            value={form.maker}
            onChange={(e) => set("maker", e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>6대 다류</Label>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {TEA_CATEGORIES.map((c) => {
            const m = CATEGORY_META[c];
            const active = form.category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => set("category", c)}
                className={cn(
                  "flex flex-col items-center rounded-lg border px-2 py-2 text-sm transition",
                  active ? "border-transparent shadow-sm" : "hover:bg-muted",
                )}
                style={active ? { background: m.soft, color: m.color, boxShadow: `inset 0 0 0 1.5px ${m.color}` } : undefined}
              >
                <span className="font-zh text-base font-semibold">{m.zh}</span>
                <span className="text-xs">{m.ko}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{CATEGORY_META[form.category].desc}</p>
      </div>

      <div className="space-y-1.5">
        <Label>산지 (여러 곳 가능)</Label>
        {regions && conv ? (
          <OriginPicker
            value={form.origins}
            onChange={(v) => set("origins", v)}
            regions={regions}
            search={regionSearch}
            conv={conv}
            autoEditFirst={editFirstOriginDetail}
          />
        ) : (
          <Loader2 className="size-4 animate-spin" />
        )}
      </div>

      <div className="space-y-1.5">
        <Label>사진</Label>
        <ImageField value={form.images} onChange={(v) => set("images", v)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">설명</Label>
        <Textarea
          id="description"
          rows={6}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="산지의 풍토, 제다 방법, 맛과 향, 우리는 법…"
        />
        {conv && /\p{Script=Han}/u.test(form.description) && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => set("description", annotateHanja(form.description, conv))}
          >
            설명 속 한자에 한글 독음 달기 — 예: 岩韻 → 암운(岩韻)
          </button>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {tea ? "저장" : "등록"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 「한자」 를 「독음(한자)」 로 바꿉니다. 이미 괄호 안에 든 한자는 건드리지 않습니다 */
function annotateHanja(text: string, conv: HanjaConverter) {
  return text.replace(/(?<!\()(\p{Script=Han}+)(?![^(]*\))/gu, (m) => `${conv.toHangul(m)}(${m})`);
}
