"use client";

import { ArrowRight, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useSyncExternalStore } from "react";
import { LandingBackdrop } from "@/components/landing-backdrop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANGELOG, type ChangelogEntry } from "@/data/changelog";

export const formatDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}년 ${m}월 ${day}일`;
};

const SEEN_KEY = "teamap:seen-update";
/** 마지막으로 본 업데이트 표시 (날짜 + 항목 수: 같은 날 항목이 늘어도 새 업데이트로 봄) */
const versionOf = (e: ChangelogEntry) => `${e.date}#${e.items.length}`;

const noSubscribe = () => () => {};
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};

/** 아직 보지 않은 업데이트 (처음 온 사람은 최신 것만). 없으면 빈 배열. 서버 렌더에서는 본 것으로 침 */
export function useUnseenUpdates(): ChangelogEntry[] {
  const latest = CHANGELOG[0];
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => (latest ? versionOf(latest) : ""));
  return useMemo(() => {
    if (!latest || seen === versionOf(latest)) return [];
    const seenDate = seen.split("#")[0];
    return seenDate ? CHANGELOG.filter((e) => e.date >= seenDate) : [latest];
  }, [latest, seen]);
}

export function markUpdatesSeen() {
  try {
    if (CHANGELOG[0]) localStorage.setItem(SEEN_KEY, versionOf(CHANGELOG[0]));
  } catch {}
}

/** 시작 화면: 업데이트 내용을 보여 주고 지도로 넘어갑니다 */
export function Landing({ entries, onEnter }: { entries: ChangelogEntry[]; onEnter: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <LandingBackdrop />

      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10 sm:py-16">
        {/* 제목 */}
        <motion.header
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative">
            <motion.img
              src="/teaggle.jpg"
              alt="Teaggle Club"
              width={72}
              height={72}
              className="size-18 rounded-full bg-white object-cover shadow-md ring-4 ring-card/80"
            />
            {/* 낙관 */}
            <span className="absolute -right-2 -bottom-1 grid size-7 rotate-6 place-items-center rounded-[5px] bg-seal font-zh text-sm font-bold text-white shadow-sm">
              茶
            </span>
          </div>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">중국 차 지도</h1>
          <p className="mt-1 font-zh text-sm tracking-[0.5em] text-muted-foreground">中國茶地圖</p>
        </motion.header>

        {entries.map((entry, n) => (
          <motion.section
            key={entry.date}
            className={cn(
              "rounded-2xl border border-border/70 bg-card/75 p-5 shadow-[0_10px_40px_-12px_oklch(0.3_0.04_60/0.25)] backdrop-blur-md sm:p-6",
              n === 0 ? "mt-8" : "mt-3",
            )}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 + n * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">{n === 0 ? "새로워진 점" : "이전 업데이트"}</h2>
              <time
                dateTime={entry.date}
                className="rounded-full border border-seal/30 bg-seal/8 px-2.5 py-0.5 text-xs font-medium text-seal"
              >
                {formatDate(entry.date)} 업데이트
              </time>
            </div>
            <ul className="mt-4 space-y-3 text-[0.9rem] leading-relaxed">
              {entry.items.map((item, i) => (
                <motion.li
                  key={item}
                  className="flex gap-3"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 + i * 0.05 }}
                >
                  <Leaf className="mt-[0.3rem] size-3.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        ))}

        <motion.div
          className="mt-6 flex justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <Button size="lg" onClick={onEnter} className="h-11 w-full rounded-full px-7 text-base shadow-md sm:w-auto">
            지도 보러 가기 <ArrowRight />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
