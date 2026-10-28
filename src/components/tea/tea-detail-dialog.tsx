"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Factory, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Stars } from "@/components/tasting/star-rating";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TastingList } from "@/components/tasting/tasting-list";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_META } from "@/lib/categories";
import type { RegionIndex } from "@/lib/regions";
import { originKey } from "@/lib/towns";
import type { Tasting, Tea, TeaOrigin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryBadge, TeaSeal, TeaThumb } from "./tea-visual";

export type DetailTab = "info" | "products" | "tastings";

/** 제품(하위 차) 탭에 필요한 것들 */
export interface ProductPanel {
  /** 지금 보는 것이 제품이면 그 상위 차 */
  parent: Tea | null;
  /** 지금 보는 차의 제품 목록 */
  products: Tea[];
  stats: Map<string, { count: number; avg: number | null }>;
  onOpen: (teaId: string) => void;
  onAdd: () => void;
}

/** 상세 창의 「마신 기록」 탭에 필요한 것들 */
export interface TastingPanel {
  tastings: Tasting[];
  error: string | null;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onAdd: () => void;
  onEdit: (t: Tasting) => void;
  onDelete: (t: Tasting) => void;
  /** 제품의 기록이 섞여 있을 때 그 제품 이름 */
  labelOf?: (t: Tasting) => string | null;
}

export function TeaDetailDialog({
  tea,
  onOpenChange,
  regions,
  admin,
  onEdit,
  onDelete,
  onShowOrigin,
  tasting,
  product,
}: {
  tea: Tea | null;
  onOpenChange: (open: boolean) => void;
  regions: RegionIndex | null;
  admin: boolean;
  onEdit: (tea: Tea) => void;
  onDelete: (tea: Tea) => void;
  onShowOrigin: (origin: TeaOrigin) => void;
  tasting: TastingPanel;
  product: ProductPanel;
}) {
  return (
    <Dialog open={!!tea} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {tea && (
          <TeaDetail
            key={tea.id}
            tea={tea}
            regions={regions}
            admin={admin}
            onEdit={onEdit}
            onDelete={onDelete}
            onShowOrigin={onShowOrigin}
            tasting={tasting}
            product={product}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TeaDetail({
  tea,
  regions,
  admin,
  onEdit,
  onDelete,
  onShowOrigin,
  tasting,
  product,
}: {
  tea: Tea;
  regions: RegionIndex | null;
  admin: boolean;
  onEdit: (tea: Tea) => void;
  onDelete: (tea: Tea) => void;
  onShowOrigin: (origin: TeaOrigin) => void;
  tasting: TastingPanel;
  product: ProductPanel;
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const meta = CATEGORY_META[tea.category];
  const images = tea.images;
  const go = (d: number) => {
    setDir(d);
    setIndex((i) => (i + d + images.length) % images.length);
  };

  return (
    <div>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-muted">
        {images.length ? (
          <AnimatePresence initial={false} custom={dir}>
            <motion.img
              key={images[index]}
              src={images[index]}
              alt={tea.name_ko}
              custom={dir}
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              drag={images.length > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => Math.abs(info.offset.x) > 60 && go(info.offset.x < 0 ? 1 : -1)}
            />
          </AnimatePresence>
        ) : (
          <TeaSeal tea={tea} className="absolute inset-0 text-4xl" />
        )}
        {images.length > 1 && (
          <>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur"
              onClick={() => go(-1)}
              aria-label="이전 사진"
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur"
              onClick={() => go(1)}
              aria-label="다음 사진"
            >
              <ChevronRight />
            </Button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  aria-label={`${i + 1}번 사진`}
                  onClick={() => {
                    setDir(i > index ? 1 : -1);
                    setIndex(i);
                  }}
                  className={cn("h-1.5 rounded-full bg-white/70 transition-all", i === index ? "w-5 bg-white" : "w-1.5")}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-5 p-6">
        <div className="space-y-2">
          {product.parent && (
            <button
              onClick={() => product.onOpen(product.parent!.id)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="size-4" />
              <span className="font-zh">{product.parent.name_zh}</span> {product.parent.name_ko}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={tea.category} />
            {tea.maker && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                <Factory className="size-3" />
                <span className="font-zh">{tea.maker}</span>
              </span>
            )}
          </div>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-zh text-3xl font-bold tracking-wide dark:brightness-[1.9] dark:saturate-[0.9]" style={{ color: meta.color }}>
              {tea.name_zh}
            </span>
            {tea.name_zh_trad && tea.name_zh_trad !== tea.name_zh && (
              <span className="font-zh text-xl text-muted-foreground">{tea.name_zh_trad}</span>
            )}
          </DialogTitle>
          <DialogDescription className="font-heading text-lg text-foreground">
            {tea.name_ko !== tea.name_zh ? tea.name_ko : null}
          </DialogDescription>
        </div>

        <Tabs value={tasting.tab} onValueChange={(v) => tasting.onTabChange(v as DetailTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="info">차 정보</TabsTrigger>
            {!product.parent && (
              <TabsTrigger value="products">
                제품{product.products.length > 0 && <span className="text-primary">{product.products.length}</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="tastings">
              마신 기록{tasting.tastings.length > 0 && <span className="text-primary">{tasting.tastings.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tastings" className="pt-3">
            <TastingList
              tastings={tasting.tastings}
              admin={admin}
              error={tasting.error}
              onAdd={tasting.onAdd}
              onEdit={tasting.onEdit}
              onDelete={tasting.onDelete}
              labelOf={tasting.labelOf}
            />
          </TabsContent>

          {!product.parent && (
            <TabsContent value="products" className="space-y-3 pt-3">
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {product.products.length
                    ? `${product.products.length}개 제품`
                    : "차창·브랜드별 제품(예: 7542, 7572)을 따로 등록할 수 있어요."}
                </span>
                {admin && (
                  <Button size="sm" className="ml-auto" onClick={product.onAdd}>
                    <Plus /> 제품 추가
                  </Button>
                )}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.products.map((p) => {
                  const st = product.stats.get(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => product.onOpen(p.id)}
                        className="flex w-full gap-3 rounded-xl border bg-card p-2.5 text-left transition hover:border-primary/40 hover:shadow-sm"
                      >
                        <TeaThumb tea={p} className="size-14 shrink-0 rounded-lg text-[10px]" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-zh truncate font-semibold">{p.name_zh || p.name_ko}</div>
                          {p.name_ko && p.name_ko !== p.name_zh && (
                            <div className="truncate text-xs text-muted-foreground">{p.name_ko}</div>
                          )}
                          {p.maker && <div className="font-zh truncate text-xs text-muted-foreground">{p.maker}</div>}
                          {st && st.count > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-seal">
                              {st.count}번 마심 <Stars value={st.avg == null ? null : Math.round(st.avg * 2) / 2} size="size-2.5" />
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          )}

          <TabsContent value="info" className="space-y-5 pt-3">
            {tea.origins.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-medium tracking-wider text-muted-foreground">산지 · 産地</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {tea.origins.map((o) => (
                    <li key={originKey(o)}>
                      <button
                        onClick={() => onShowOrigin(o)}
                        className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition hover:border-primary hover:bg-secondary"
                      >
                        <MapPin className="size-3.5 text-seal" />
                        <span className="text-muted-foreground">
                          {o.path
                            .slice(0, -1)
                            .map((c) => regions?.[c]?.n)
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                        <span className="font-zh font-medium">{o.name_zh}</span>
                        <span>{o.name_ko}</span>
                        {o.detail && (
                          <>
                            <span className="text-muted-foreground">›</span>
                            <span className="font-zh font-medium">{o.detail.name_zh}</span>
                            <span>{o.detail.name_ko}</span>
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tea.description && (
              <p className="whitespace-pre-line leading-7 text-foreground/90">{tea.description}</p>
            )}

            <div className="rounded-lg p-3 text-xs leading-5" style={{ background: meta.soft, color: meta.color }}>
              <b>
                {meta.ko} {meta.hanja}
              </b>{" "}
              — {meta.desc}
            </div>

            {admin && (
              <div className="flex justify-end gap-2 border-t pt-4">
                {confirming ? (
                  <>
                    <span className="mr-auto self-center text-sm text-destructive">정말 삭제할까요?</span>
                    <Button variant="ghost" onClick={() => setConfirming(false)}>
                      취소
                    </Button>
                    <Button variant="destructive" onClick={() => onDelete(tea)}>
                      <Trash2 /> 삭제
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
                      <Trash2 /> 삭제
                    </Button>
                    <Button onClick={() => onEdit(tea)}>
                      <Pencil /> 수정
                    </Button>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
