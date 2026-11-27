import LINES from "./rivers.json";

/**
 * 지도에 물길로 그려 두는 차와 이어진 강.
 * 물길은 OpenStreetMap 에서 받아 둔 rivers.json (npm run rivers:fetch) 에 있습니다.
 */
export interface River {
  id: keyof typeof LINES;
  /** 간체 */
  zh: string;
  trad?: string;
  ko: string;
  /** 큰 강은 굵게 */
  major?: boolean;
  /**
   * 이 adcode 로 시작하는 지도를 볼 때 표시 (예: "53" → 운남성의 모든 지도, "350000" → 복건성 지도만)
   */
  views: string[];
  note?: string;
}

export const RIVERS: River[] = [
  {
    id: "lancang",
    zh: "澜沧江",
    trad: "瀾滄江",
    ko: "란창강",
    major: true,
    // 청해·티베트에서 운남을 꿰뚫고 라오스·미얀마 국경으로
    views: ["53", "54", "63"],
    note: "메콩강 상류 · 유역에 임창·보이·서쌍판납의 보이차 산지가 이어짐 (빙도·석귀·이우·징마이산 등)",
  },
  {
    id: "jiuqu",
    zh: "九曲溪",
    ko: "구곡계",
    views: ["350000", "3507"],
    note: "무이산 풍경구를 아홉 굽이로 흐르는 시내 · 양쪽 바위산이 무이암차(武夷岩茶)의 정암(正岩) 산지",
  },
  {
    id: "tongmu",
    zh: "桐木溪",
    ko: "동목계",
    views: ["350000", "3507"],
    note: "구곡계 윗물 · 동목관(桐木關)에서 동목촌을 지나 흐름 · 정산소종(正山小種)·금준미(金駿眉)의 고향",
  },
  {
    id: "qiantang",
    zh: "钱塘江",
    trad: "錢塘江",
    ko: "전당강",
    major: true,
    views: ["330000", "3301"],
    note: "용정차(龍井茶) 산지 '서호·전당·월주' 중 전당 산지의 이름 · 서호용정의 매가오·운서 차밭이 강 북쪽 기슭",
  },
  {
    id: "changjiang",
    zh: "阊江",
    trad: "閶江",
    ko: "창강",
    views: ["340000", "3410", "360000", "3602"],
    note: "기문홍차(祁門紅茶)의 산지 기문현을 지나 경덕진으로 흐르는 강",
  },
];

export const RIVER_LINES = LINES as Record<River["id"], [number, number][][]>;
