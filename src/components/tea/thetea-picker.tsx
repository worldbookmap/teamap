"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { THETEA_GROUPS, type TheteaEntry, type TheteaIndex } from "@/lib/thetea";
import { cn } from "@/lib/utils";

/** 백과사전 글을 이름(한글·한자·병음)으로 찾아 고르기 */
export function TheteaPicker({
  index,
  initialQuery = "",
  suggestions = [],
  onPick,
  autoFocus,
  className,
}: {
  index: TheteaIndex;
  initialQuery?: string;
  /** 검색어가 없을 때 보여 줄 후보 */
  suggestions?: TheteaEntry[];
  onPick: (entry: TheteaEntry) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const results = query.trim() ? index.search(query, 12) : suggestions;
  const [active, setActive] = useState(0);
  const cur = Math.min(active, Math.max(results.length - 1, 0));

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          className="pl-8"
          placeholder={`백과사전 ${index.entries.length.toLocaleString()}개 글에서 찾기 (용정, 龍井, longjing…)`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
            else if (e.key === "Enter" && results[cur]) onPick(results[cur]);
            else return;
            e.preventDefault();
          }}
        />
      </div>
      {results.length > 0 ? (
        <ul className="max-h-64 overflow-y-auto rounded-lg border bg-card p-1">
          {!query.trim() && <li className="px-2 py-1 text-[11px] text-muted-foreground">비슷한 이름의 글</li>}
          {results.map((e, i) => (
            <li key={e.s}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(e)}
                className={cn(
                  "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  i === cur && "bg-muted",
                )}
              >
                <span className="font-medium">{e.k}</span>
                {e.c && <span className="font-zh text-muted-foreground">{e.c}</span>}
                <span className="truncate text-xs text-muted-foreground">{e.t}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{THETEA_GROUPS[e.p] ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        query.trim() && <p className="px-1 text-xs text-muted-foreground">찾는 글이 없어요. 병음이나 한자로도 찾아보세요.</p>
      )}
    </div>
  );
}
