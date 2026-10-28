"use client";

import { motion } from "framer-motion";
import { MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/categories";
import type { HanjaConverter } from "@/lib/hanja";
import { regionPath, type RegionIndex } from "@/lib/regions";
import type { TownFocus } from "@/lib/towns";
import type { Tea } from "@/lib/types";

/** 이 향·진을 세부 산지로 가진 차 (제품 포함) */
export function teasAtTown(teas: Tea[], town: TownFocus) {
  return teas.filter((t) =>
    t.origins.some(
      (o) =>
        o.detail &&
        (o.detail.code === town.code || (o.adcode === town.county && !!o.detail.name_zh && o.detail.name_zh === town.zh)),
    ),
  );
}

/** 지도에서 고른 향·진의 정보와 차 등록 */
export function TownCard({
  town,
  teas,
  regions,
  conv,
  admin,
  onOpenTea,
  onAddTea,
  onClose,
}: {
  town: TownFocus;
  teas: Tea[];
  regions: RegionIndex | null;
  conv: HanjaConverter | null;
  admin: boolean;
  onOpenTea: (id: string) => void;
  onAddTea: () => void;
  onClose: () => void;
}) {
  const here = teasAtTown(teas, town);
  const path = regions ? regionPath(regions, town.county) : [];
  const parentName = (id: string | null) => (id ? teas.find((t) => t.id === id) : undefined);

  return (
    <motion.div
      key={town.code}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-2">
        <MapPin className="mt-1 size-4 shrink-0 text-seal" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-zh text-lg font-bold">{town.zh}</span>
            <span className="font-heading">{town.ko}</span>
            <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">향·진</span>
          </div>
          {regions && (
            <p className="text-xs text-muted-foreground">
              {path.map((c) => regions[c].n).join(" › ")}
              <br />
              {conv && path.map((c) => conv.toHangul(regions[c].n)).join(" › ")}
            </p>
          )}
          {town.lng != null && town.lat != null ? (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {town.lat.toFixed(3)}°N, {town.lng.toFixed(3)}°E
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-muted-foreground">지도 위치 정보 없음</p>
          )}
        </div>
        <button type="button" aria-label="닫기" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-2 border-t pt-2">
        <p className="mb-1 text-xs font-medium text-muted-foreground">이곳의 차 {here.length > 0 && <b className="text-foreground">{here.length}</b>}</p>
        {here.length ? (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {here.map((t) => {
              const parent = parentName(t.parent_id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTea(t.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[t.category].color }} />
                    <span className="font-zh truncate">
                      {parent && <span className="text-muted-foreground">{parent.name_zh} · </span>}
                      {t.name_zh || t.name_ko}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{t.name_ko !== t.name_zh ? t.name_ko : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">아직 이곳으로 등록된 차가 없어요.</p>
        )}
      </div>

      {admin && (
        <Button size="sm" className="mt-2 w-full" onClick={onAddTea}>
          <Plus /> 이 향·진에 차 등록
        </Button>
      )}
    </motion.div>
  );
}
