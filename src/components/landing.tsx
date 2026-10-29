"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CHANGELOG } from "@/data/changelog";

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${y}년 ${m}월 ${day}일`;
};

/** 시작 화면: 최근 업데이트 내용을 보여 주고 지도로 넘어갑니다 */
export function Landing({ onEnter }: { onEnter: () => void }) {
  const latest = CHANGELOG[0];
  return (
    <motion.div
      className="paper-grain fixed inset-0 z-50 overflow-y-auto bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.img src="/teaggle.jpg" alt="Teaggle Club" width={56} height={56} className="size-14 shrink-0 rounded-full bg-white object-cover shadow-sm ring-1 ring-border" />
          <div className="leading-tight">
            <h1 className="font-heading text-2xl font-bold">중국 차 지도</h1>
            <p className="font-zh text-sm tracking-[0.3em] text-muted-foreground">中國茶地圖</p>
          </div>
        </motion.div>

        {latest && (
          <motion.section
            className="mt-8 rounded-xl border bg-card/90 p-5 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="size-4 text-seal" /> 새로워진 점
              </h2>
              <time dateTime={latest.date} className="text-xs text-muted-foreground">
                {formatDate(latest.date)}
              </time>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed">
              {latest.items.map((item, i) => (
                <motion.li
                  key={item}
                  className="flex gap-2.5"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.04 }}
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-seal" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.div
          className="mt-6 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Button size="lg" onClick={onEnter} autoFocus>
            지도 보러 가기 <ArrowRight />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
