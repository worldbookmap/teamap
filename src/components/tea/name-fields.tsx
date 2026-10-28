"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, Languages } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { joinSegments, type HanjaConverter } from "@/lib/hanja";
import { cn } from "@/lib/utils";

export interface Names {
  name_zh: string;
  name_zh_trad: string;
  name_ko: string;
}

/**
 * 차 이름 입력: 한자(간체)를 쓰면 번체·한글 독음이 자동으로 채워지고,
 * 한글을 쓰면 「한자로」 버튼으로 음절마다 한자 후보를 골라 바꿀 수 있습니다.
 */
export function NameFields({
  value,
  onChange,
  conv,
}: {
  value: Names;
  onChange: (v: Names) => void;
  conv: HanjaConverter | null;
}) {
  // 사용자가 직접 고친 칸은 자동 변환으로 덮어쓰지 않습니다
  const [manual, setManual] = useState({ trad: !!value.name_zh_trad, ko: !!value.name_ko });
  const [picking, setPicking] = useState(false);

  const setZh = (zh: string) => {
    const next = { ...value, name_zh: zh };
    if (conv && !manual.trad) next.name_zh_trad = conv.traditionalize(zh);
    if (conv && !manual.ko) next.name_ko = conv.toHangul(zh);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name_zh">한자 이름 (간체)</Label>
          <Input
            id="name_zh"
            className="font-zh text-base"
            placeholder="例: 西湖龙井"
            value={value.name_zh}
            onChange={(e) => setZh(e.target.value)}
            onBlur={() => conv && value.name_zh && setZh(conv.simplify(value.name_zh))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name_zh_trad" className="flex justify-between">
            번체
            {conv && value.name_zh && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setManual((m) => ({ ...m, trad: false }));
                  onChange({ ...value, name_zh_trad: conv.traditionalize(value.name_zh) });
                }}
              >
                자동 변환
              </button>
            )}
          </Label>
          <Input
            id="name_zh_trad"
            className="font-zh text-base"
            placeholder="例: 西湖龍井"
            value={value.name_zh_trad}
            onChange={(e) => {
              setManual((m) => ({ ...m, trad: true }));
              const trad = e.target.value;
              onChange({ ...value, name_zh_trad: trad, name_zh: value.name_zh || (conv ? conv.simplify(trad) : "") });
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!conv || !value.name_zh}
          onClick={() => {
            setManual((m) => ({ ...m, ko: false }));
            onChange({ ...value, name_ko: conv!.toHangul(value.name_zh) });
          }}
        >
          <ArrowDown /> 한자 → 한글
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!conv || !value.name_ko}
          onClick={() => setPicking((p) => !p)}
        >
          <ArrowUp /> 한글 → 한자
        </Button>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name_ko">한글 이름 (독음)</Label>
        <Input
          id="name_ko"
          placeholder="예: 서호용정"
          value={value.name_ko}
          onChange={(e) => {
            setManual((m) => ({ ...m, ko: true }));
            onChange({ ...value, name_ko: e.target.value });
          }}
        />
      </div>

      <AnimatePresence initial={false}>
        {picking && conv && value.name_ko && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <HangulToHanja
              conv={conv}
              text={value.name_ko}
              onApply={({ simp, trad }) => {
                setManual((m) => ({ ...m, trad: false }));
                onChange({ ...value, name_zh: simp, name_zh_trad: trad });
                setPicking(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** 한글 → 한자: 음절(또는 사전 단어)마다 후보를 골라 바꿉니다 */
export function HangulToHanja({
  conv,
  text,
  onApply,
}: {
  conv: HanjaConverter;
  text: string;
  onApply: (v: { simp: string; trad: string }) => void;
}) {
  const segments = useMemo(() => conv.segment(text), [conv, text]);
  const [choices, setChoices] = useState<number[]>([]);
  const result = joinSegments(segments, choices);

  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Languages className="size-3.5" /> 글자를 눌러 다른 한자를 고를 수 있어요
      </p>
      <div className="flex flex-wrap gap-1.5">
        {segments.map((seg, i) =>
          seg.kind === "raw" ? (
            <span key={i} className="w-2" />
          ) : (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex min-w-11 flex-col items-center rounded-md border bg-card px-2 py-1 transition hover:border-primary hover:bg-secondary",
                    seg.options.length === 0 && "border-destructive/60",
                  )}
                >
                  <span className="font-zh text-lg leading-tight">{seg.options[choices[i] ?? 0]?.simp ?? "?"}</span>
                  <span className="text-[10px] text-muted-foreground">{seg.ko}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <p className="mb-1.5 px-1 text-xs text-muted-foreground">
                  「{seg.ko}」 {seg.kind === "word" ? "사전 단어" : "음의 한자"} · {seg.options.length}개
                </p>
                <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
                  {seg.options.map((o, j) => (
                    <button
                      key={o.simp + j}
                      type="button"
                      onClick={() => setChoices((c) => Object.assign([...c], { [i]: j }))}
                      className={cn(
                        "relative flex flex-col items-center rounded border px-1 py-0.5 hover:bg-secondary",
                        seg.kind === "word" && "col-span-3",
                        (choices[i] ?? 0) === j && "border-primary bg-secondary",
                      )}
                    >
                      <span className="font-zh text-base">{o.simp}</span>
                      {o.trad !== o.simp && <span className="font-zh text-[10px] text-muted-foreground">{o.trad}</span>}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ),
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="font-zh text-sm">
          {result.simp} {result.trad !== result.simp && <span className="text-muted-foreground">/ {result.trad}</span>}
        </div>
        <Button type="button" size="sm" onClick={() => onApply(result)}>
          <Check /> 적용
        </Button>
      </div>
    </div>
  );
}
