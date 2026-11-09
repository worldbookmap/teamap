"use client";

import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/categories";
import { loadTheteaArticle, THETEA_GROUPS, THETEA_TO_CATEGORY, theteaUrl, type TheteaIndex } from "@/lib/thetea";
import type { TeaCategory, TeaInput } from "@/lib/types";
import { TheteaPicker } from "./thetea-picker";

/** 등록·수정 폼의 백과사전 연결: 이름으로 자동으로 찾고, 바꾸거나 끌 수 있음. 내용으로 다류·설명 채우기 */
export function TheteaField({
  value,
  index,
  onChange,
  onFill,
}: {
  value: TeaInput;
  index: TheteaIndex | null;
  onChange: (slug: string | null) => void;
  onFill: (fill: { category?: TeaCategory; description?: string }) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [filling, setFilling] = useState(false);

  if (!index) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> 백과사전 목록 불러오는 중…
      </p>
    );
  }

  const { entry, auto } = index.linked(value);
  const hasName = !!(value.name_zh || value.name_ko);

  const fill = async () => {
    if (!entry) return;
    setFilling(true);
    try {
      const article = await loadTheteaArticle(entry.s);
      if (!article) throw new Error("백과사전에 이 글이 없습니다.");
      const category = THETEA_TO_CATEGORY[article.category];
      const description = !value.description.trim() && article.lede ? article.lede : undefined;
      onFill({ category, description });
      const done = [category && `다류(${CATEGORY_META[category].ko})`, description && "설명"].filter(Boolean);
      toast.success(done.length ? `${done.join("·")}을(를) 채웠습니다.` : "채울 내용이 없습니다 (설명이 이미 있어요).");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFilling(false);
    }
  };

  return (
    <div className="space-y-2">
      {entry ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border bg-card px-3 py-2 text-sm">
          <BookOpen className="size-4 text-primary" />
          <a href={theteaUrl(entry.s)} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
            {entry.k}
          </a>
          {entry.c && <span className="font-zh text-muted-foreground">{entry.c}</span>}
          <span className="text-xs text-muted-foreground">
            {THETEA_GROUPS[entry.p] ?? ""} · {auto ? "이름으로 자동 연결" : "직접 고름"}
          </span>
          <span className="ml-auto flex gap-1">
            <Button type="button" size="xs" variant="outline" onClick={fill} disabled={filling}>
              {filling ? <Loader2 className="animate-spin" /> : <Sparkles />} 다류·설명 채우기
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setPicking((v) => !v)}>
              바꾸기
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => onChange("")}>
              연결 안 함
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {value.thetea_slug === "" ? (
            <>
              백과사전에 연결하지 않아요.
              <Button type="button" size="xs" variant="outline" onClick={() => onChange(null)}>
                이름으로 자동 찾기
              </Button>
            </>
          ) : hasName ? (
            "이름이 같은 백과사전 글이 없어요. 아래에서 찾아 연결할 수 있어요."
          ) : (
            "이름을 쓰면 thetea.app 백과사전에서 같은 차의 글을 자동으로 찾아 연결해요."
          )}
        </div>
      )}
      {(picking || (!entry && hasName && value.thetea_slug !== "")) && (
        <TheteaPicker
          index={index}
          suggestions={index.similar(value, 6)}
          onPick={(e) => {
            onChange(e.s);
            setPicking(false);
          }}
        />
      )}
      {!auto && value.thetea_slug && index.exact(value)?.s !== value.thetea_slug && (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange(null)}>
          직접 고른 글 대신 이름으로 자동 찾기
        </button>
      )}
    </div>
  );
}
