"use client";

import { motion, useReducedMotion } from "framer-motion";

/** 시작 화면 배경: 수묵화풍 차산(층층이 계단 차밭), 안개, 찻잔의 김, 흩날리는 찻잎 */

const W = 1440;
const H = 900;

const FAR = "M0 500 C 120 420 240 380 360 440 C 450 360 560 300 690 400 C 800 340 900 280 1030 380 C 1140 320 1270 340 1440 420 L1440 900 L0 900 Z";
const MID = "M0 610 C 170 530 330 505 480 570 C 610 505 760 480 900 560 C 1050 505 1210 505 1440 590 L1440 900 L0 900 Z";
const NEAR = "M0 760 C 230 700 430 690 650 740 C 870 690 1110 685 1440 745 L1440 900 L0 900 Z";

// 가운데 산 위 계단 차밭 줄
const TERRACES = Array.from({ length: 13 }, (_, i) => {
  const y = 540 + i * 22;
  return `M-20 ${y + 30} C 300 ${y - 18}, 700 ${y + 34}, 1000 ${y - 6} S 1380 ${y + 8}, 1460 ${y - 10}`;
});

const LEAF = "M0 0 C 7 -9 21 -10 32 0 C 21 10 7 9 0 0 Z";
const LEAVES = [
  { left: "8%", top: "-6%", size: 26, dur: 19, delay: 0, drift: 60, spin: 200 },
  { left: "28%", top: "-10%", size: 18, dur: 23, delay: 5, drift: -40, spin: -160 },
  { left: "62%", top: "-8%", size: 22, dur: 21, delay: 2, drift: 50, spin: 220 },
  { left: "82%", top: "-12%", size: 30, dur: 26, delay: 8, drift: -70, spin: -240 },
  { left: "46%", top: "-14%", size: 16, dur: 28, delay: 12, drift: 30, spin: 180 },
];

export function LandingBackdrop() {
  const still = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* 하늘: 위는 종이색, 아래로 갈수록 찻잎빛 */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklch,var(--primary)_10%,var(--background))_70%,color-mix(in_oklch,var(--primary)_18%,var(--background))_100%)]" />

      {/* 큰 茶 글자 (낙관처럼 옅게) */}
      <div className="absolute -top-[6vh] -left-[4vw] font-zh text-[min(62vw,46vh)] leading-none font-bold text-foreground opacity-[0.045] select-none">
        茶
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="lb-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--background)" stopOpacity="0" />
            <stop offset="0.55" stopColor="var(--background)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--background)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lb-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="color-mix(in oklch, var(--primary) 42%, var(--background))" />
            <stop offset="1" stopColor="color-mix(in oklch, var(--primary) 26%, var(--background))" />
          </linearGradient>
          <clipPath id="lb-mid-clip">
            <path d={MID} />
          </clipPath>
        </defs>

        {/* 해 (인주색) */}
        <circle cx="1130" cy="230" r="70" fill="var(--seal)" opacity="0.13" />
        <circle cx="1130" cy="230" r="46" fill="var(--seal)" opacity="0.16" />

        {/* 먼 산 */}
        <path d={FAR} fill="color-mix(in oklch, var(--foreground) 14%, var(--background))" opacity="0.55" />
        <motion.rect
          x="-200"
          y="380"
          width={W + 400}
          height="200"
          fill="url(#lb-mist)"
          animate={still ? undefined : { x: [-200, -80, -200] }}
          transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 가운데 차산과 계단 차밭 */}
        <path d={MID} fill="url(#lb-mid)" />
        <g clipPath="url(#lb-mid-clip)" fill="none" stroke="color-mix(in oklch, var(--primary) 60%, var(--background))" strokeWidth="2.2" opacity="0.55">
          {TERRACES.map((d) => (
            <path key={d} d={d} strokeDasharray="2 7" strokeLinecap="round" />
          ))}
        </g>
        <motion.rect
          x="-120"
          y="560"
          width={W + 240}
          height="140"
          fill="url(#lb-mist)"
          opacity="0.8"
          animate={still ? undefined : { x: [-120, -10, -120] }}
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 앞 언덕 */}
        <path d={NEAR} fill="color-mix(in oklch, var(--primary) 55%, var(--background))" opacity="0.9" />

        {/* 찻잔과 김 */}
        <g transform="translate(1170 735)">
          {[-18, 0, 18].map((dx, i) => (
            <motion.path
              key={dx}
              d={`M${dx} -38 c -14 -18 14 -30 0 -50 c -12 -16 10 -26 0 -42`}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ opacity: 0.18 }}
              animate={still ? undefined : { opacity: [0, 0.28, 0], y: [8, -10, -24] }}
              transition={{ duration: 4.5, delay: i * 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
          <ellipse cx="0" cy="22" rx="86" ry="12" fill="color-mix(in oklch, var(--foreground) 22%, var(--background))" />
          <path d="M-66 -30 C -62 18 62 18 66 -30 Z" fill="var(--card)" stroke="color-mix(in oklch, var(--foreground) 35%, var(--background))" strokeWidth="2" />
          <ellipse cx="0" cy="-30" rx="66" ry="10" fill="color-mix(in oklch, oklch(0.72 0.12 85) 70%, var(--card))" stroke="color-mix(in oklch, var(--foreground) 35%, var(--background))" strokeWidth="2" />
          <path d="M-40 -6 C -20 4 20 4 40 -6" fill="none" stroke="var(--primary)" strokeWidth="2.5" opacity="0.7" />
        </g>
      </svg>

      {/* 흩날리는 찻잎 */}
      {!still &&
        LEAVES.map((l, i) => (
          <motion.svg
            key={i}
            viewBox="-2 -12 36 24"
            width={l.size}
            height={l.size * 0.66}
            className="absolute"
            style={{ left: l.left, top: l.top }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
            animate={{ y: "115vh", x: [0, l.drift, -l.drift / 2, l.drift / 3], rotate: l.spin, opacity: [0, 0.75, 0.75, 0] }}
            transition={{ duration: l.dur, delay: l.delay, repeat: Infinity, ease: "linear" }}
          >
            <path d={LEAF} fill="color-mix(in oklch, var(--primary) 75%, var(--background))" />
            <path d="M1 0 L 30 0" stroke="color-mix(in oklch, var(--primary) 40%, var(--background))" strokeWidth="1" />
          </motion.svg>
        ))}
    </div>
  );
}
