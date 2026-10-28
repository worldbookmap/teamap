"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, Loader2, MapPin, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CountyPinMap } from "@/components/map/county-pin-map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HanjaConverter } from "@/lib/hanja";
import type { RegionIndex } from "@/lib/regions";
import { loadTowns, type Town } from "@/lib/towns";
import type { OriginDetail, TeaOrigin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HangulToHanja } from "./name-fields";

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 현·구 산지에 세부 산지(향·진 또는 차산·마을)와 지도 위치를 정합니다 */
export function OriginDetailDialog({
  origin,
  onOpenChange,
  onSave,
  regions,
  conv,
}: {
  /** 편집할 산지 (null 이면 닫힘) */
  origin: TeaOrigin | null;
  onOpenChange: (open: boolean) => void;
  /** detail 이 null 이면 세부 산지 지우기 */
  onSave: (detail: OriginDetail | null) => void;
  regions: RegionIndex;
  conv: HanjaConverter;
}) {
  return (
    <Dialog open={!!origin} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {origin && (
          <DetailForm
            key={origin.adcode}
            origin={origin}
            regions={regions}
            conv={conv}
            onCancel={() => onOpenChange(false)}
            onSave={(d) => {
              onSave(d);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailForm({
  origin,
  regions,
  conv,
  onCancel,
  onSave,
}: {
  origin: TeaOrigin;
  regions: RegionIndex;
  conv: HanjaConverter;
  onCancel: () => void;
  onSave: (d: OriginDetail | null) => void;
}) {
  const init = origin.detail;
  const [zh, setZh] = useState(init?.name_zh ?? "");
  const [ko, setKo] = useState(init?.name_ko ?? "");
  const [koManual, setKoManual] = useState(!!init?.name_ko && init.name_ko !== conv.toHangul(init.name_zh));
  const [town, setTown] = useState<string | null>(init?.kind === "town" ? (init.code ?? null) : null);
  const [pos, setPos] = useState<{ lng: number; lat: number } | null>(
    init?.lng != null && init?.lat != null ? { lng: init.lng, lat: init.lat } : null,
  );
  const [picking, setPicking] = useState(false);
  const [towns, setTowns] = useState<Town[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadTowns(origin.adcode).then((t) => alive && setTowns(t));
    return () => {
      alive = false;
    };
  }, [origin.adcode]);

  const townItems = useMemo(
    () => (towns ?? []).map(([code, name]) => ({ code, name, ko: conv.toHangul(name) })),
    [towns, conv],
  );
  const suggestions = useMemo(() => {
    const qz = norm(conv.simplify(zh));
    const qk = norm(ko);
    if (town || (!qz && !qk)) return townItems;
    return townItems.filter((t) => (qz && norm(t.name).includes(qz)) || (qk && norm(t.ko).includes(qk)));
  }, [townItems, zh, ko, town, conv]);

  const setName = (nextZh: string) => {
    setZh(nextZh);
    setTown(null);
    if (!koManual) setKo(conv.toHangul(nextZh));
  };

  const parentCode = regions[origin.adcode]?.p ?? null;
  const save = () => {
    if (!zh.trim() && !ko.trim() && !pos) return onSave(null);
    onSave({
      kind: town ? "town" : "place",
      ...(town ? { code: town } : {}),
      name_zh: conv.simplify(zh.trim()),
      name_ko: ko.trim() || (zh.trim() ? conv.toHangul(zh.trim()) : ""),
      ...(pos ? { lng: pos.lng, lat: pos.lat } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl">세부 산지</DialogTitle>
        <DialogDescription>
          <span className="font-zh text-foreground">{origin.name_zh}</span> {origin.name_ko} 안의 향·진을 고르거나, 차산·마을
          이름을 직접 입력하세요.
          {pos && !init?.name_zh && !init?.name_ko && " 지도에서 누른 위치는 이미 찍혀 있어요."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="detail_zh" className="flex items-center gap-2">
            한자
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px]",
                town ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {town ? "공식 향·진" : "직접 입력"}
            </span>
          </Label>
          <Input
            id="detail_zh"
            autoFocus
            className="font-zh"
            placeholder="例: 易武镇, 老班章村, 狮峰山"
            value={zh}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="detail_ko" className="flex justify-between">
            한글
            <button
              type="button"
              disabled={!ko}
              className="flex items-center gap-0.5 text-xs text-primary hover:underline disabled:opacity-40"
              onClick={() => setPicking((p) => !p)}
            >
              <ArrowUp className="size-3" /> 한자로
            </button>
          </Label>
          <Input
            id="detail_ko"
            placeholder="예: 이무진, 노반장촌"
            value={ko}
            onChange={(e) => {
              setKo(e.target.value);
              setKoManual(true);
              setTown(null);
            }}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {picking && ko && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <HangulToHanja
              conv={conv}
              text={ko}
              onApply={({ simp }) => {
                setZh(simp);
                setTown(null);
                setPicking(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        <Label>
          향·진 목록 <span className="font-normal text-muted-foreground">{towns ? `${suggestions.length}곳` : ""}</span>
        </Label>
        {towns === null ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : townItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">이 지역은 향·진 목록이 없습니다. 이름을 직접 입력해 주세요.</p>
        ) : (
          <ul className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-1">
            {suggestions.map((t) => (
              <li key={t.code}>
                <button
                  type="button"
                  onClick={() => {
                    setZh(t.name);
                    setKo(t.ko);
                    setKoManual(false);
                    setTown(t.code);
                  }}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-accent",
                    town === t.code && "bg-secondary",
                  )}
                >
                  {town === t.code && <Check className="size-3.5 shrink-0 text-primary" />}
                  <span className="font-zh truncate">{t.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.ko}</span>
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="col-span-2 p-2 text-xs text-muted-foreground">일치하는 향·진이 없어요 — 입력한 이름으로 저장됩니다.</li>
            )}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5 text-seal" /> 지도 위치 <span className="font-normal text-muted-foreground">(선택, 눌러서 찍기)</span>
          </span>
          {pos && (
            <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setPos(null)}>
              위치 지우기
            </button>
          )}
        </Label>
        {parentCode ? (
          <CountyPinMap adcode={origin.adcode} parentCode={parentCode} value={pos} onChange={setPos} />
        ) : (
          <p className="text-xs text-muted-foreground">이 지역은 위치를 찍을 수 없습니다.</p>
        )}
        {pos && (
          <p className="text-right text-[11px] tabular-nums text-muted-foreground">
            {pos.lat.toFixed(4)}°N, {pos.lng.toFixed(4)}°E
          </p>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        {origin.detail ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => onSave(null)}>
            <Trash2 /> 세부 산지 지우기
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" onClick={save} disabled={!zh.trim() && !ko.trim() && !pos}>
            저장
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
