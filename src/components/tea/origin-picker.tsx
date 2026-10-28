"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPin, MapPinPlus, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HanjaConverter } from "@/lib/hanja";
import {
  childrenOf,
  fullName,
  LEVEL_KO,
  makeOrigin,
  searchRegions,
  type RegionIndex,
  type RegionSearchItem,
} from "@/lib/regions";
import { originKey, UNNAMED_SPOT } from "@/lib/towns";
import type { OriginDetail, TeaOrigin } from "@/lib/types";
import { OriginDetailDialog } from "./origin-detail-dialog";

/** 산지 선택: 한글·한자 검색 또는 성 → 시 → 현 단계 선택 */
export function OriginPicker({
  value,
  onChange,
  regions,
  search,
  conv,
  autoEditFirst = false,
}: {
  value: TeaOrigin[];
  onChange: (v: TeaOrigin[]) => void;
  regions: RegionIndex;
  search: RegionSearchItem[];
  conv: HanjaConverter;
  /** 처음 열 때 첫 산지의 세부 산지 편집을 바로 엽니다 (지도에서 길게 눌러 등록할 때) */
  autoEditFirst?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [prov, setProv] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [dist, setDist] = useState<string>("");
  /** 세부 산지 편집: index 가 null 이면 같은 현에 새로 추가 */
  const [editing, setEditing] = useState<{ index: number | null; origin: TeaOrigin } | null>(() =>
    autoEditFirst && value[0] ? { index: 0, origin: value[0] } : null,
  );

  const add = (code: string) => {
    if (value.some((o) => o.adcode === code && !o.detail)) return;
    const o = makeOrigin(regions, conv, code);
    if (o) onChange([...value, o]);
  };

  const saveDetail = (detail: OriginDetail | null) => {
    if (!editing) return;
    const { index, origin } = editing;
    const next: TeaOrigin = { ...origin };
    if (detail) next.detail = detail;
    else delete next.detail;
    if (index == null) {
      if (detail && !value.some((o) => originKey(o) === originKey(next))) onChange([...value, next]);
    } else {
      onChange(value.map((o, i) => (i === index ? next : o)));
    }
  };
  /** 세부 산지는 더 나눌 수 없는 말단 구역(현·구 등)에만 */
  const canDetail = (o: TeaOrigin) => regions[o.adcode]?.k === 0 && o.level !== "province";

  const results = useMemo(() => searchRegions(search, query, (x) => conv.simplify(x)), [query, search, conv]);

  const provinces = useMemo(() => childrenOf(regions, null), [regions]);
  const cities = useMemo(() => (prov ? childrenOf(regions, prov) : []), [regions, prov]);
  const dists = useMemo(() => (city ? childrenOf(regions, city) : []), [regions, city]);
  const picked = dist || city || prov;

  const label = (code: string) => `${regions[code].n} · ${conv.toHangul(regions[code].n)}`;

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {value.length > 0 && (
          <motion.ul layout className="flex flex-wrap gap-1.5">
            {value.map((o, i) => (
              <motion.li
                layout
                key={originKey(o)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Badge variant="secondary" className="h-auto max-w-full flex-wrap justify-start gap-1 py-1 pr-1 pl-2 text-left whitespace-normal">
                  <MapPin className="size-3" />
                  <span className="font-zh">{o.name_zh}</span>
                  <span>{o.name_ko}</span>
                  {o.detail && (
                    <button
                      type="button"
                      className="rounded bg-background/70 px-1 hover:bg-background"
                      onClick={() => setEditing({ index: i, origin: o })}
                    >
                      › <span className="font-zh">{o.detail.name_zh}</span>{" "}
                      {o.detail.name_ko || (!o.detail.name_zh && <span className="text-muted-foreground">{UNNAMED_SPOT}</span>)}
                      {o.detail.lng != null && <MapPin className="ml-0.5 inline size-3 text-seal" />}
                    </button>
                  )}
                  <span className="text-muted-foreground">
                    · {o.path.slice(0, -1).map((c) => regions[c]?.n ?? "").join(" ")}
                  </span>
                  {canDetail(o) && (
                    <button
                      type="button"
                      aria-label={o.detail ? "같은 지역에 세부 산지 하나 더" : "세부 산지 추가"}
                      title={o.detail ? "같은 지역에 세부 산지 하나 더" : "세부 산지(향·진, 차산·마을) 추가"}
                      className="flex items-center gap-0.5 rounded-full px-1 py-0.5 text-primary hover:bg-background"
                      onClick={() =>
                        o.detail
                          ? setEditing({ index: null, origin: { ...o, detail: undefined } })
                          : setEditing({ index: i, origin: o })
                      }
                    >
                      <MapPinPlus className="size-3" />
                      {!o.detail && <span className="text-[11px]">세부</span>}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="삭제"
                    className="ml-0.5 rounded-full p-0.5 hover:bg-background"
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="지역 검색 — 항주, 杭州, 무이산, 勐海…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
            {results.map((r) => (
              <li key={r.adcode}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    add(r.adcode);
                    setQuery("");
                  }}
                >
                  <span className="font-zh font-medium">{r.zh}</span>
                  <span>{r.ko}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {LEVEL_KO[r.level]} · {fullName(regions, r.adcode, conv).split(" ").slice(0, -1).join(" ") || "중국"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <Select
          value={prov}
          onValueChange={(v) => {
            setProv(v);
            setCity("");
            setDist("");
          }}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="성(省)" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((c) => (
              <SelectItem key={c} value={c}>
                {label(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={city}
          disabled={!cities.length}
          onValueChange={(v) => {
            setCity(v);
            setDist("");
          }}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="시(市)" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {label(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dist} disabled={!dists.length} onValueChange={setDist}>
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="현·구(县区)" />
          </SelectTrigger>
          <SelectContent>
            {dists.map((c) => (
              <SelectItem key={c} value={c}>
                {label(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" className="col-span-3 sm:col-span-1" disabled={!picked} onClick={() => add(picked)}>
          <Plus /> 추가
        </Button>
      </div>

      <OriginDetailDialog
        origin={editing?.origin ?? null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={saveDetail}
        regions={regions}
        conv={conv}
      />
    </div>
  );
}
