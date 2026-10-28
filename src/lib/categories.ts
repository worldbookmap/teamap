import type { TeaCategory } from "./types";

/** 6대 다류(六大茶类) — 색은 각 차의 탕색(湯色)에서 따왔습니다 */
export const CATEGORY_META: Record<
  TeaCategory,
  { ko: string; zh: string; hanja: string; color: string; soft: string; desc: string }
> = {
  green: {
    ko: "녹차",
    zh: "绿茶",
    hanja: "綠茶",
    color: "#6f8f3a",
    soft: "#e3ebcf",
    desc: "불발효차. 살청(殺靑)으로 산화를 막아 맑은 연둣빛 탕색과 신선한 향을 지닙니다.",
  },
  white: {
    ko: "백차",
    zh: "白茶",
    hanja: "白茶",
    color: "#b5a27a",
    soft: "#f1ebdc",
    desc: "약발효차. 위조(萎凋)와 건조만 거쳐 흰 솜털이 그대로 남은 담백한 차입니다.",
  },
  yellow: {
    ko: "황차",
    zh: "黄茶",
    hanja: "黃茶",
    color: "#c69a1e",
    soft: "#f5e7bd",
    desc: "경발효차. 민황(悶黃) 공정으로 노란 잎과 노란 탕색, 부드러운 맛을 냅니다.",
  },
  oolong: {
    ko: "청차(우롱차)",
    zh: "青茶",
    hanja: "靑茶",
    color: "#3f7f74",
    soft: "#d6e8e3",
    desc: "반발효차. 요청(搖靑)으로 잎 가장자리만 산화시켜 꽃향과 과일향이 풍부합니다.",
  },
  black: {
    ko: "홍차",
    zh: "红茶",
    hanja: "紅茶",
    color: "#a8432d",
    soft: "#f2d9cf",
    desc: "완전발효차. 유념 후 충분히 산화시켜 붉은 탕색과 달콤한 향을 지닙니다.",
  },
  dark: {
    ko: "흑차",
    zh: "黑茶",
    hanja: "黑茶",
    color: "#4b3528",
    soft: "#e2d6cc",
    desc: "후발효차. 악퇴(渥堆)로 미생물 발효를 거쳐 오래 숙성될수록 깊어지는 차입니다.",
  },
};
