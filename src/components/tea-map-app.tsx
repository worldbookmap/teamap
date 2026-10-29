"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CupSoda, LogIn, LogOut, Moon, Plus, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChinaMap } from "@/components/map/china-map";
import { RegionSearch } from "@/components/map/region-search";
import { TownCard } from "@/components/map/town-card";
import { MapViewer } from "@/components/region-maps/map-viewer";
import { MapsButton, regionLabel, RegionMapsDialog, relatedMaps } from "@/components/region-maps/region-maps-dialog";
import { LoginDialog } from "@/components/login-dialog";
import { TeaCard } from "@/components/tea/tea-card";
import { TastingFormDialog } from "@/components/tasting/tasting-form-dialog";
import { tastingSummary } from "@/components/tasting/tasting-list";
import { TastingTimelineSheet } from "@/components/tasting/tasting-timeline-sheet";
import { TeaDetailDialog, type DetailTab } from "@/components/tea/tea-detail-dialog";
import { TeaFormDialog } from "@/components/tea/tea-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConverter } from "@/hooks/use-converter";
import { api } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";
import { buildRegionSearch, CHINA, makeOrigin, regionPath } from "@/lib/regions";
import { categoryCounts, matchesQuery, teasInRegion } from "@/lib/tea-utils";
import { TEA_CATEGORIES, type RegionMap, type Tasting, type Tea, type TeaCategory, type TeaOrigin } from "@/lib/types";
import { originKey, type TownFocus } from "@/lib/towns";
import { cn } from "@/lib/utils";

type Me = Awaited<ReturnType<typeof api.me>>;

export function TeaMapApp() {
  const bundle = useConverter();
  const conv = bundle?.conv ?? null;
  const regions = bundle?.regions ?? null;

  const [teas, setTeas] = useState<Tea[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  const [viewCode, setViewCode] = useState(CHINA);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [cats, setCats] = useState<Set<TeaCategory>>(new Set());
  const [query, setQuery] = useState("");
  const [hoverTeaId, setHoverTeaId] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    tea?: Tea | null;
    parent?: Tea | null;
    origins?: TeaOrigin[];
    /** 지도에서 길게 눌러 열었을 때: 세부 산지 편집부터 */
    fromMap?: boolean;
  }>({ open: false });
  const [mapResetKey, setMapResetKey] = useState(0);
  /** 지역 검색에서 고른 향·진 */
  const [focusTown, setFocusTown] = useState<TownFocus | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  // 마신 기록
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [tastingError, setTastingError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [tastingForm, setTastingForm] = useState<{ open: boolean; tasting?: Tasting | null }>({ open: false });
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [drunkOnly, setDrunkOnly] = useState(false);

  // 지역 참고 지도
  const [regionMaps, setRegionMaps] = useState<RegionMap[]>([]);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [viewingMap, setViewingMap] = useState<RegionMap | null>(null);
  const [editingMap, setEditingMap] = useState<RegionMap | null>(null);
  /** 목록에서 연 지도면 닫을 때 목록으로 돌아감 */
  const [viewFromList, setViewFromList] = useState(false);

  const refreshMe = useCallback(() => api.me().then(setMe).catch(() => setMe(null)), []);

  useEffect(() => {
    api
      .listTeas()
      .then(setTeas)
      .catch((e) => toast.error(`차 목록을 불러오지 못했습니다: ${e.message}`))
      .finally(() => setLoading(false));
    api
      .listTastings()
      .then(setTastings)
      .catch((e) => setTastingError(e.message));
    api
      .listRegionMaps()
      .then(setRegionMaps)
      .catch((e) => setMapsError(e.message));
    refreshMe();
  }, [refreshMe]);

  const byTea = useMemo(() => {
    const m = new Map<string, Tasting[]>();
    for (const t of tastings) m.set(t.tea_id, [...(m.get(t.tea_id) ?? []), t]);
    return m;
  }, [tastings]);

  // 제품(하위 차)은 지도·목록에서 상위 차에 묶어서 보여줍니다
  const productsOf = useMemo(() => {
    const m = new Map<string, Tea[]>();
    for (const t of teas) if (t.parent_id) m.set(t.parent_id, [...(m.get(t.parent_id) ?? []), t]);
    return m;
  }, [teas]);
  /** 차 + 그 제품들의 마신 기록 (최근 날짜 순) */
  const familyTastings = useCallback(
    (id: string) =>
      [id, ...(productsOf.get(id) ?? []).map((p) => p.id)]
        .flatMap((x) => byTea.get(x) ?? [])
        .sort((a, b) => b.tasted_on.localeCompare(a.tasted_on) || b.created_at.localeCompare(a.created_at)),
    [byTea, productsOf],
  );
  const summaries = useMemo(
    () => new Map(teas.map((t) => [t.id, tastingSummary(t.parent_id ? (byTea.get(t.id) ?? []) : familyTastings(t.id))])),
    [teas, byTea, familyTastings],
  );
  /** 목록·지도용 대표 차: 제품의 산지까지 합친 산지 목록 */
  const topTeas = useMemo(
    () =>
      teas
        .filter((t) => !t.parent_id)
        .map((t) => {
          const extra = (productsOf.get(t.id) ?? []).flatMap((p) => p.origins);
          const origins = [...t.origins, ...extra].filter(
            (o, i, all) => all.findIndex((x) => originKey(x) === originKey(o)) === i,
          );
          return { ...t, origins };
        }),
    [teas, productsOf],
  );
  /** 검색은 제품 이름·제조사로도 */
  const matchesFamily = useCallback(
    (t: Tea) => {
      const simplify = conv?.simplify.bind(conv);
      return (
        matchesQuery(t, query, simplify) ||
        (productsOf.get(t.id) ?? []).some(
          (p) => matchesQuery(p, query, simplify) || (!!query.trim() && p.maker.includes(query.trim())),
        )
      );
    },
    [conv, query, productsOf],
  );

  // 등록된 차 이름도 한글→한자 사전에 넣어 둡니다
  useEffect(() => {
    if (conv) conv.addWords(teas.filter((t) => t.name_zh && t.name_ko).map((t) => [t.name_zh, t.name_zh_trad, t.name_ko]));
  }, [conv, teas]);

  const regionSearch = useMemo(() => (regions && conv ? buildRegionSearch(regions, conv) : []), [regions, conv]);

  const filtered = useMemo(
    () =>
      topTeas.filter(
        (t) =>
          (cats.size === 0 || cats.has(t.category)) &&
          (!drunkOnly || (summaries.get(t.id)?.count ?? 0) > 0) &&
          matchesFamily(t),
      ),
    [topTeas, cats, drunkOnly, summaries, matchesFamily],
  );
  const regionCode = focusCode ?? viewCode;
  /** 목록 순서: 다류 순으로 묶고, 다류 안에서는 최근에 고친 차(제품 수정 포함)가 먼저 */
  const inRegion = useMemo(() => {
    const updated = (t: Tea) =>
      [t, ...(productsOf.get(t.id) ?? [])].reduce((max, x) => (x.updated_at > max ? x.updated_at : max), "");
    return teasInRegion(filtered, regionCode)
      .map((t) => ({ t, at: updated(t) }))
      .sort(
        (a, b) =>
          TEA_CATEGORIES.indexOf(a.t.category) - TEA_CATEGORIES.indexOf(b.t.category) || b.at.localeCompare(a.at),
      )
      .map(({ t }) => t);
  }, [filtered, regionCode, productsOf]);
  const counts = useMemo(
    () => categoryCounts(teasInRegion(topTeas.filter(matchesFamily), regionCode)),
    [topTeas, matchesFamily, regionCode],
  );

  /** 지역으로 이동: 하위 지도가 있으면 그 지도로, 말단이면 상위 지도에서 선택 */
  const goTo = useCallback(
    (code: string) => {
      if (!regions || code === CHINA || !regions[code]) {
        setViewCode(CHINA);
        setFocusCode(null);
        return;
      }
      if (regions[code].k > 0) {
        setViewCode(code);
        setFocusCode(null);
      } else {
        setViewCode(regions[code].p ?? CHINA);
        setFocusCode(code);
      }
    },
    [regions],
  );

  const onRegionClick = (code: string, hasChildren: boolean) => {
    setFocusTown(null);
    if (hasChildren) goTo(code);
    else setFocusCode((f) => (f === code ? null : code));
  };

  const crumbs = regions ? [CHINA, ...regionPath(regions, regionCode)] : [CHINA];
  const parentOf = (code: string) => (code === CHINA ? null : (regions?.[code]?.p ?? CHINA));
  const back = () => {
    setFocusTown(null);
    if (focusCode) setFocusCode(null);
    else goTo(parentOf(viewCode) ?? CHINA);
  };

  const regionName = (code: string) => (code === CHINA ? "中国" : (regions?.[code]?.n ?? ""));
  const curName = regionName(regionCode);
  const mapCount = useMemo(() => {
    const r = relatedMaps(regionMaps, regions, regionCode);
    return r.here.length + r.below.length + r.above.length;
  }, [regionMaps, regions, regionCode]);
  const detail = teas.find((t) => t.id === detailId) ?? null;
  const detailParent = detail?.parent_id ? (teas.find((t) => t.id === detail.parent_id) ?? null) : null;
  const teaName = (id: string) => {
    const t = teas.find((x) => x.id === id);
    return t ? t.name_zh || t.name_ko : "";
  };

  /** 처음 화면으로: 지도·검색·필터 초기화 */
  const goHome = () => {
    setViewCode(CHINA);
    setFocusCode(null);
    setQuery("");
    setCats(new Set());
    setDrunkOnly(false);
    setFocusTown(null);
    setMapResetKey((k) => k + 1);
  };
  const admin = !!me?.admin;

  const openNewTea = () => {
    const origin = regionCode !== CHINA && regions && conv ? makeOrigin(regions, conv, regionCode) : null;
    setForm({ open: true, tea: null, origins: origin ? [origin] : [] });
  };

  /** 지도에서 현·구를 길게 누름: 그 구역 + 누른 위치로 새 차 등록 */
  const onMapLongPress = (adcode: string, [lng, lat]: [number, number]) => {
    if (!regions || !conv) return;
    const origin = makeOrigin(regions, conv, adcode);
    if (!origin) return;
    origin.detail = { kind: "place", name_zh: "", name_ko: "", lng, lat };
    setFocusCode(adcode);
    setForm({ open: true, tea: null, parent: null, origins: [origin], fromMap: true });
  };

  const onSaved = (saved: Tea) => {
    setTeas((list) => (list.some((t) => t.id === saved.id) ? list.map((t) => (t.id === saved.id ? saved : t)) : [...list, saved]));
  };

  const onDelete = async (tea: Tea) => {
    try {
      await api.deleteTea(tea.id);
      // 제품도 함께 삭제됩니다
      const gone = new Set([tea.id, ...(productsOf.get(tea.id) ?? []).map((p) => p.id)]);
      setTeas((list) => list.filter((t) => !gone.has(t.id)));
      setTastings((list) => list.filter((t) => !gone.has(t.tea_id)));
      setDetailId(tea.parent_id);
      toast.success("삭제했습니다.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="paper-grain flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <Header
        admin={admin}
        me={me}
        onLogin={() => setLoginOpen(true)}
        onLogout={async () => {
          await api.logout();
          refreshMe();
        }}
        onAdd={openNewTea}
        drunkCount={tastings.length}
        onTimeline={() => setTimelineOpen(true)}
        onHome={goHome}
      />

      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* 지도 */}
        <section className="relative h-[52svh] shrink-0 border-b lg:h-auto lg:flex-1 lg:border-r lg:border-b-0">
          <ChinaMap
            viewCode={viewCode}
            focusCode={focusCode}
            teas={filtered}
            conv={conv}
            highlightTeaId={hoverTeaId}
            onRegionClick={onRegionClick}
            resetKey={mapResetKey}
            focusTown={focusTown}
            onTownClick={(t) => {
              setFocusCode(t.county);
              setFocusTown(t);
            }}
            onLongPress={admin ? onMapLongPress : undefined}
            onTeaClick={setDetailId}
          />

          <div className="absolute top-3 right-3 z-20">
            <RegionSearch
              search={regionSearch}
              conv={conv}
              regions={regions}
              onSelect={(code) => {
                setFocusTown(null);
                goTo(code);
              }}
              onSelectTown={(t) => {
                goTo(t.county);
                setFocusTown({ code: t.code, county: t.county, zh: t.zh, ko: t.ko, lng: t.lng, lat: t.lat });
              }}
            />
          </div>

          <nav className="absolute top-3 right-14 left-3 flex items-center gap-1 lg:right-auto">
            <AnimatePresence>
              {regionCode !== CHINA && (
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                  <Button size="icon-sm" variant="outline" className="bg-card/90 backdrop-blur" onClick={back} aria-label="뒤로">
                    <ChevronLeft />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <ol className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border bg-card/90 px-2 py-1 text-sm shadow-sm backdrop-blur">
              {crumbs.map((code, i) => (
                <li key={code} className="flex shrink-0 items-center">
                  {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
                  <button
                    onClick={() => (code === regionCode ? null : goTo(code))}
                    className={cn("rounded px-1 font-zh hover:bg-muted", code === regionCode && "font-semibold text-primary")}
                  >
                    {regionName(code)}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <Legend />

          <div className="absolute top-14 left-3 z-20">
            <AnimatePresence>
              {focusTown && (
                <TownCard
                  town={focusTown}
                  teas={teas}
                  regions={regions}
                  conv={conv}
                  admin={admin}
                  onClose={() => setFocusTown(null)}
                  onOpenTea={(id) => {
                    setDetailTab("info");
                    setDetailId(id);
                  }}
                  onAddTea={() => {
                    if (!regions || !conv) return;
                    const origin = makeOrigin(regions, conv, focusTown.county);
                    if (!origin) return;
                    origin.detail = {
                      kind: "town",
                      code: focusTown.code,
                      name_zh: focusTown.zh,
                      name_ko: focusTown.ko,
                      ...(focusTown.lng != null && focusTown.lat != null ? { lng: focusTown.lng, lat: focusTown.lat } : {}),
                    };
                    setForm({ open: true, tea: null, parent: null, origins: [origin] });
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* 목록 */}
        <aside className="flex flex-col bg-background/60 lg:min-h-0 lg:w-[420px] lg:flex-none">
          <div className="space-y-3 border-b p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={regionCode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-baseline gap-2">
                  <h2 className="font-zh text-2xl font-bold">{curName}</h2>
                  <span className="font-heading text-lg text-muted-foreground">
                    {regionCode === CHINA ? "중국 전역" : conv?.toHangul(curName)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {loading ? "불러오는 중…" : `${inRegion.length}종의 차`}
                  {regionCode === CHINA && " · 지도의 성(省)을 눌러 시·현 단위까지 들어가 보세요"}
                </p>
                {(admin || mapCount > 0) && <MapsButton className="mt-2" count={mapCount} onClick={() => setMapsOpen(true)} />}
              </motion.div>
            </AnimatePresence>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="bg-card pl-8"
                placeholder="차·지역 검색 (용정, 龍井, 龙井…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={drunkOnly}
                color="var(--seal)"
                soft="color-mix(in oklch, var(--seal) 12%, transparent)"
                onClick={() => setDrunkOnly((v) => !v)}
              >
                <CupSoda className="size-3" />
                마신 차
                <span className="opacity-60">
                  {teasInRegion(topTeas, regionCode).filter((t) => (summaries.get(t.id)?.count ?? 0) > 0).length}
                </span>
              </FilterChip>
              <FilterChip active={cats.size === 0} onClick={() => setCats(new Set())}>
                전체
              </FilterChip>
              {TEA_CATEGORIES.map((c) => {
                const m = CATEGORY_META[c];
                const active = cats.has(c);
                return (
                  <FilterChip
                    key={c}
                    active={active}
                    color={m.color}
                    soft={m.soft}
                    onClick={() =>
                      setCats((s) => {
                        const n = new Set(s);
                        if (n.has(c)) n.delete(c);
                        else n.add(c);
                        return n;
                      })
                    }
                  >
                    <span className="size-2 rounded-full" style={{ background: m.color }} />
                    {m.ko.replace(/\(.*\)/, "")}
                    <span className="opacity-60">{counts[c]}</span>
                  </FilterChip>
                );
              })}
            </div>
          </div>

          {/* 모바일은 페이지 전체가 스크롤, 데스크톱은 목록만 스크롤 */}
          <div className="p-4 pb-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {inRegion.length > 0 ? (
              <motion.ul layout className="space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {inRegion.map((t) => (
                    <TeaCard
                      key={t.id}
                      tea={t}
                      drunk={summaries.get(t.id)}
                      productCount={productsOf.get(t.id)?.length ?? 0}
                      onOpen={(x) => {
                        setDetailTab("info");
                        setDetailId(x.id);
                      }}
                      onHover={setHoverTeaId}
                    />
                  ))}
                </AnimatePresence>
              </motion.ul>
            ) : (
              !loading && (
                <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                  <span className="font-zh text-5xl text-border">茶</span>
                  <p>{query || cats.size || drunkOnly ? "조건에 맞는 차가 없습니다." : "이 지역에 등록된 차가 없습니다."}</p>
                  {admin && (
                    <Button size="sm" variant="outline" onClick={openNewTea}>
                      <Plus /> 이 지역에 차 등록
                    </Button>
                  )}
                </div>
              )
            )}
          </div>
        </aside>
      </main>

      <Footer />

      <TeaDetailDialog
        tea={detail}
        onOpenChange={(o) => !o && setDetailId(null)}
        regions={regions}
        admin={admin}
        onEdit={(t) => setForm({ open: true, tea: t, parent: detailParent })}
        onDelete={onDelete}
        product={{
          parent: detailParent,
          products: detail && !detail.parent_id ? (productsOf.get(detail.id) ?? []) : [],
          stats: summaries,
          onOpen: (id) => {
            setDetailTab("info");
            setDetailId(id);
          },
          onAdd: () => setForm({ open: true, tea: null, parent: detail }),
        }}
        tasting={{
          tastings: detail ? (detail.parent_id ? (byTea.get(detail.id) ?? []) : familyTastings(detail.id)) : [],
          labelOf: (t) => (detail && t.tea_id !== detail.id ? teaName(t.tea_id) : null),
          error: tastingError,
          tab: detailTab,
          onTabChange: setDetailTab,
          onAdd: () => setTastingForm({ open: true, tasting: null }),
          onEdit: (t) => setTastingForm({ open: true, tasting: t }),
          onDelete: async (t) => {
            try {
              await api.deleteTasting(t.id);
              setTastings((list) => list.filter((x) => x.id !== t.id));
              toast.success("기록을 삭제했습니다.");
            } catch (e) {
              toast.error((e as Error).message);
            }
          },
        }}
        onShowOrigin={(o) => {
          setDetailId(null);
          goTo(o.adcode);
        }}
      />
      <TeaFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        tea={form.tea}
        parent={form.parent}
        initialOrigins={form.origins}
        editFirstOriginDetail={form.fromMap}
        conv={conv}
        regions={regions}
        regionSearch={regionSearch}
        onSaved={onSaved}
      />
      <TastingFormDialog
        tea={detail}
        tasting={tastingForm.tasting}
        open={tastingForm.open}
        onOpenChange={(open) => setTastingForm((f) => ({ ...f, open }))}
        onSaved={(saved) =>
          setTastings((list) =>
            [saved, ...list.filter((t) => t.id !== saved.id)].sort(
              (a, b) => b.tasted_on.localeCompare(a.tasted_on) || b.created_at.localeCompare(a.created_at),
            ),
          )
        }
      />
      <TastingTimelineSheet
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        tastings={tastings}
        teas={teas}
        error={tastingError}
        onOpenTea={(id) => {
          setTimelineOpen(false);
          setDetailTab("tastings");
          setDetailId(id);
        }}
      />
      <RegionMapsDialog
        open={mapsOpen}
        onOpenChange={setMapsOpen}
        regionCode={regionCode}
        maps={regionMaps}
        error={mapsError}
        regions={regions}
        regionSearch={regionSearch}
        conv={conv}
        admin={admin}
        editing={editingMap}
        onEditingDone={() => setEditingMap(null)}
        onView={(m) => {
          setMapsOpen(false);
          setViewFromList(true);
          setViewingMap(m);
        }}
        onSaved={(m) => setRegionMaps((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]))}
      />
      <MapViewer
        map={viewingMap}
        regionLabel={viewingMap ? regionLabel(regions, conv, viewingMap.adcode) : ""}
        admin={admin}
        onClose={() => {
          setViewingMap(null);
          if (viewFromList) setMapsOpen(true);
          setViewFromList(false);
        }}
        onEdit={(m) => {
          setViewingMap(null);
          setViewFromList(false);
          setEditingMap(m);
          setMapsOpen(true);
        }}
        onDelete={async (m) => {
          try {
            await api.deleteRegionMap(m.id);
            setRegionMaps((list) => list.filter((x) => x.id !== m.id));
            setViewingMap(null);
            if (viewFromList) setMapsOpen(true);
            setViewFromList(false);
            toast.success("참고 지도를 삭제했습니다.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLoggedIn={refreshMe} />
    </div>
  );
}

function Header({
  admin,
  me,
  onLogin,
  onLogout,
  onAdd,
  drunkCount,
  onTimeline,
  onHome,
}: {
  admin: boolean;
  me: Me | null;
  onLogin: () => void;
  onLogout: () => void;
  onAdd: () => void;
  drunkCount: number;
  onTimeline: () => void;
  onHome: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="flex items-center gap-3 border-b bg-card/70 px-4 py-2.5 backdrop-blur">
      <button
        type="button"
        onClick={onHome}
        aria-label="처음 지도로"
        className="flex items-center gap-3 rounded-lg text-left outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <motion.img
          src="/teaggle.jpg"
          alt="Teaggle Club"
          width={40}
          height={40}
          initial={{ rotate: -12, scale: 0.8, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="size-10 shrink-0 rounded-full bg-white object-cover shadow-sm ring-1 ring-border"
        />
        <div className="leading-tight">
          <h1 className="font-heading text-lg font-bold">중국 차 지도</h1>
          <p className="font-zh text-xs tracking-[0.3em] text-muted-foreground">中國茶地圖</p>
        </div>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {me?.store === "local" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
                로컬 저장소
              </span>
            </TooltipTrigger>
            <TooltipContent>Supabase 미설정 — .data/ 폴더에 저장 중</TooltipContent>
          </Tooltip>
        )}
        <Button size="sm" variant="outline" onClick={onTimeline}>
          <CupSoda /> <span className="hidden sm:inline">마신 기록</span>
          {drunkCount > 0 && <span className="text-seal">{drunkCount}</span>}
        </Button>
        {admin && (
          <Button size="sm" onClick={onAdd}>
            <Plus /> 차 등록
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="테마 전환"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
        {!me?.authDisabled &&
          (admin ? (
            <Button size="icon-sm" variant="ghost" aria-label="로그아웃" onClick={onLogout}>
              <LogOut />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onLogin}>
              <LogIn /> 관리자
            </Button>
          ))}
      </div>
    </header>
  );
}

function FilterChip({
  active,
  color,
  soft,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  soft?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
        active ? "border-transparent font-semibold" : "bg-card hover:bg-muted",
        active && !color && "bg-primary text-primary-foreground",
      )}
      style={active && color ? { background: soft, color, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
    >
      {children}
    </motion.button>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 hidden flex-col gap-1 rounded-lg border bg-card/90 px-3 py-2 text-xs shadow-sm backdrop-blur sm:flex">
      <span className="mb-0.5 font-medium text-muted-foreground">6대 다류 · 六大茶類</span>
      {TEA_CATEGORIES.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
          <span className="font-zh">{CATEGORY_META[c].zh}</span>
          <span className="text-muted-foreground">{CATEGORY_META[c].ko}</span>
        </span>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t bg-card/70 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground backdrop-blur">
      <span>
        만든이 <b className="font-medium text-foreground">고릴라닷컴</b>
      </span>
      <span aria-hidden className="text-border">
        |
      </span>
      <span className="flex items-center gap-1">
        운영하는이
        <a
          href="https://instagram.com/teaggle.club"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:text-seal hover:underline"
        >
          <InstagramGlyph className="size-3.5" />
          티끌
          <span className="text-muted-foreground">@teaggle.club</span>
        </a>
      </span>
    </footer>
  );
}

/** 인스타그램 모양 아이콘 (lucide 에는 브랜드 아이콘이 없어 직접 그림) */
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
