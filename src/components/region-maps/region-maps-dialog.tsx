"use client";

import { ExternalLink, Loader2, Map as MapIcon, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ImageField } from "@/components/tea/image-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { HanjaConverter } from "@/lib/hanja";
import { CHINA, regionPath, searchRegions, type RegionIndex, type RegionSearchItem } from "@/lib/regions";
import type { RegionMap, RegionMapInput } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 현재 지역과 관련된 참고 지도: 이 지역 → 하위 지역 → 상위 지역 순 */
export function relatedMaps(maps: RegionMap[], regions: RegionIndex | null, code: string) {
  if (!regions) return { here: [], below: [], above: [] };
  const here: RegionMap[] = [];
  const below: RegionMap[] = [];
  const above: RegionMap[] = [];
  const myPath = code === CHINA ? [] : regionPath(regions, code);
  for (const m of maps) {
    if (m.adcode === code) here.push(m);
    else if (code === CHINA || regionPath(regions, m.adcode).includes(code)) below.push(m);
    else if (myPath.includes(m.adcode)) above.push(m);
  }
  return { here, below, above };
}

export function regionLabel(regions: RegionIndex | null, conv: HanjaConverter | null, adcode: string) {
  if (!regions?.[adcode]) return "";
  return regionPath(regions, adcode)
    .map((c) => `${regions[c].n}${conv ? ` ${conv.toHangul(regions[c].n)}` : ""}`)
    .slice(-2)
    .join(" › ");
}

type Mode = { kind: "list" } | { kind: "form"; map: RegionMap | null };

export function RegionMapsDialog({
  open,
  onOpenChange,
  regionCode,
  maps,
  error,
  regions,
  regionSearch,
  conv,
  admin,
  editing,
  onEditingDone,
  onView,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regionCode: string;
  maps: RegionMap[];
  error: string | null;
  regions: RegionIndex | null;
  regionSearch: RegionSearchItem[];
  conv: HanjaConverter | null;
  admin: boolean;
  /** 보기 화면에서 「수정」을 눌러 열었을 때 그 지도 */
  editing: RegionMap | null;
  onEditingDone: () => void;
  onView: (m: RegionMap) => void;
  onSaved: (m: RegionMap) => void;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const current: Mode = editing ? { kind: "form", map: editing } : mode;
  const { here, below, above } = useMemo(() => relatedMaps(maps, regions, regionCode), [maps, regions, regionCode]);
  const name = regionCode === CHINA ? "中国" : (regions?.[regionCode]?.n ?? "");

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setMode({ kind: "list" });
      onEditingDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {current.kind === "list" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2 text-xl">
                <MapIcon className="size-5 text-seal" /> 참고 지도
              </DialogTitle>
              <DialogDescription>
                <span className="font-zh text-foreground">{name}</span> {regionCode !== CHINA && conv?.toHangul(name)} 의 차산 지도·옛
                지도·외부 지도를 모아 두는 곳이에요.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p className="rounded-lg border border-dashed border-destructive/50 p-4 text-sm text-destructive">{error}</p>
            ) : (
              <div className="space-y-5">
                <MapGroup title="이 지역" maps={here} regions={regions} conv={conv} onView={onView} empty="아직 등록된 참고 지도가 없어요." />
                {below.length > 0 && <MapGroup title="하위 지역" maps={below} regions={regions} conv={conv} onView={onView} />}
                {above.length > 0 && <MapGroup title="상위 지역" maps={above} regions={regions} conv={conv} onView={onView} />}
              </div>
            )}

            {admin && !error && (
              <DialogFooter>
                <Button onClick={() => setMode({ kind: "form", map: null })}>
                  <Plus /> 참고 지도 추가
                </Button>
              </DialogFooter>
            )}
          </>
        ) : (
          <MapForm
            key={current.map?.id ?? "new"}
            map={current.map}
            defaultAdcode={regionCode === CHINA ? "" : regionCode}
            regions={regions}
            regionSearch={regionSearch}
            conv={conv}
            onCancel={() => {
              setMode({ kind: "list" });
              onEditingDone();
            }}
            onSaved={(m) => {
              onSaved(m);
              setMode({ kind: "list" });
              onEditingDone();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MapGroup({
  title,
  maps,
  regions,
  conv,
  onView,
  empty,
}: {
  title: string;
  maps: RegionMap[];
  regions: RegionIndex | null;
  conv: HanjaConverter | null;
  onView: (m: RegionMap) => void;
  empty?: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium tracking-wider text-muted-foreground">{title}</h3>
      {maps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {maps.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => onView(m)}
                className="group flex w-full gap-3 rounded-xl border bg-card p-2 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-map-sea">
                  {m.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.images[0]} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <ExternalLink className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 py-0.5">
                  <div className="truncate font-medium">{m.title || "참고 지도"}</div>
                  <div className="truncate text-xs text-muted-foreground">{regionLabel(regions, conv, m.adcode)}</div>
                  {m.description && <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>}
                  <div className="flex gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
                    {m.images.length > 1 && <span className="rounded bg-muted px-1">이미지 {m.images.length}장</span>}
                    {m.link && <span className="rounded bg-muted px-1">링크</span>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MapForm({
  map,
  defaultAdcode,
  regions,
  regionSearch,
  conv,
  onCancel,
  onSaved,
}: {
  map: RegionMap | null;
  defaultAdcode: string;
  regions: RegionIndex | null;
  regionSearch: RegionSearchItem[];
  conv: HanjaConverter | null;
  onCancel: () => void;
  onSaved: (m: RegionMap) => void;
}) {
  const [form, setForm] = useState<RegionMapInput>(() =>
    map
      ? { adcode: map.adcode, title: map.title, description: map.description, images: map.images, link: map.link }
      : { adcode: defaultAdcode, title: "", description: "", images: [], link: "" },
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof RegionMapInput>(k: K, v: RegionMapInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const results = useMemo(
    () => (conv ? searchRegions(regionSearch, query, (x) => conv.simplify(x), 8) : []),
    [regionSearch, query, conv],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = map ? await api.updateRegionMap(map.id, form) : await api.createRegionMap(form);
      toast.success(map ? "참고 지도를 수정했습니다." : "참고 지도를 추가했습니다.");
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
        <DialogTitle className="font-heading text-xl">{map ? "참고 지도 수정" : "참고 지도 추가"}</DialogTitle>
        <DialogDescription>지도 이미지를 올리거나 외부 지도 주소를 넣으세요. 둘 다 넣어도 됩니다.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>지역</Label>
        {form.adcode && regions?.[form.adcode] ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <MapIcon className="size-4 text-seal" />
            <span className="flex-1 truncate">{regionLabel(regions, conv, form.adcode)}</span>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => set("adcode", "")}>
              바꾸기
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-8"
              placeholder="지역 검색 — 무이산, 勐海, 항주…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-1 shadow-lg">
                {results.map((r) => (
                  <li key={r.adcode}>
                    <button
                      type="button"
                      className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        set("adcode", r.adcode);
                        setQuery("");
                      }}
                    >
                      <span className="font-zh font-medium">{r.zh}</span>
                      <span>{r.ko}</span>
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {r.full_ko.split(" ").slice(0, -1).join(" ") || "중국"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="map_title">제목</Label>
        <Input id="map_title" placeholder="예: 무이산 정암 차산 지도" value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>지도 이미지</Label>
        <ImageField value={form.images} onChange={(v) => set("images", v)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="map_link">외부 지도 주소 (선택)</Label>
        <Input
          id="map_link"
          type="url"
          placeholder="https://…"
          value={form.link}
          onChange={(e) => set("link", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="map_desc">설명·출처</Label>
        <Textarea
          id="map_desc"
          rows={3}
          placeholder="어떤 지도인지, 출처(책·웹사이트·제작자)는 어디인지"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={saving || !form.adcode || (!form.images.length && !form.link.trim())}>
          {saving && <Loader2 className="animate-spin" />}
          {map ? "저장" : "추가"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MapsButton({ count, onClick, className }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition hover:border-seal/50 hover:text-seal",
        count > 0 ? "border-seal/30 bg-seal/5 text-seal" : "text-muted-foreground",
        className,
      )}
    >
      <MapIcon className="size-3.5" />
      참고 지도{count > 0 && <b>{count}</b>}
    </button>
  );
}
