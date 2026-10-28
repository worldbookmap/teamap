"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ImageField } from "@/components/tea/image-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Tasting, TastingInput, Tea } from "@/lib/types";
import { StarInput } from "./star-rating";

/** 오늘 날짜 (현지 시간 기준 YYYY-MM-DD) */
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const empty = (teaId: string): TastingInput => ({
  tea_id: teaId,
  tasted_on: today(),
  rating: null,
  price: null,
  amount: "",
  shop: "",
  vintage: "",
  brewing: "",
  aroma: "",
  taste: "",
  note: "",
  photos: [],
});

export function TastingFormDialog({
  tea,
  tasting,
  open,
  onOpenChange,
  onSaved,
}: {
  tea: Tea | null;
  tasting?: Tasting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (t: Tasting) => void;
}) {
  return (
    <Dialog open={open && !!tea} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {open && tea && (
          <TastingForm
            key={tasting?.id ?? "new"}
            tea={tea}
            tasting={tasting}
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

function TastingForm({
  tea,
  tasting,
  onCancel,
  onSaved,
}: {
  tea: Tea;
  tasting?: Tasting | null;
  onCancel: () => void;
  onSaved: (t: Tasting) => void;
}) {
  const [form, setForm] = useState<TastingInput>(() => (tasting ? { ...tasting } : empty(tea.id)));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof TastingInput>(k: K, v: TastingInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = tasting ? await api.updateTasting(tasting.id, form) : await api.createTasting(form);
      toast.success(tasting ? "기록을 수정했습니다." : "마신 기록을 남겼습니다.");
      onSaved(saved);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl">{tasting ? "마신 기록 수정" : "마신 기록 남기기"}</DialogTitle>
        <DialogDescription>
          <span className="font-zh text-base text-foreground">{tea.name_zh}</span> {tea.name_ko}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="tasted_on">마신 날</Label>
          <Input id="tasted_on" type="date" required value={form.tasted_on} onChange={(e) => set("tasted_on", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>평가</Label>
          <StarInput value={form.rating} onChange={(v) => set("rating", v)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>사진</Label>
        <ImageField value={form.photos} onChange={(v) => set("photos", v)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">가격 (원)</Label>
          <Input
            id="price"
            inputMode="numeric"
            placeholder="25,000"
            value={form.price == null ? "" : form.price.toLocaleString("ko-KR")}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              set("price", digits ? Number(digits) : null);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">기준 양</Label>
          <Input id="amount" placeholder="50g, 1편 357g" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shop">구매처</Label>
          <Input id="shop" placeholder="찻집, 온라인몰…" value={form.shop} onChange={(e) => set("shop", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vintage">생산 연도·시기</Label>
          <Input id="vintage" placeholder="2024 명전, 2015 생차…" value={form.vintage} onChange={(e) => set("vintage", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brewing">우림 정보</Label>
          <Input
            id="brewing"
            placeholder="95℃ · 5g · 110ml · 10초 · 개완"
            value={form.brewing}
            onChange={(e) => set("brewing", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="aroma">향</Label>
          <Textarea id="aroma" rows={2} placeholder="난향, 볶은 콩, 꿀…" value={form.aroma} onChange={(e) => set("aroma", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taste">맛</Label>
          <Textarea id="taste" rows={2} placeholder="단맛, 회감, 바디감…" value={form.taste} onChange={(e) => set("taste", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">메모</Label>
        <Textarea
          id="note"
          rows={4}
          placeholder="함께 마신 사람, 분위기, 다음에 바꿔볼 점…"
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
          {tasting ? "저장" : "기록하기"}
        </Button>
      </DialogFooter>
    </form>
  );
}
