export const TEA_CATEGORIES = ["green", "white", "yellow", "oolong", "black", "dark"] as const;
export type TeaCategory = (typeof TEA_CATEGORIES)[number];

export type RegionLevel = "province" | "city" | "district";

/** 차의 산지. path 는 [성, 시, 현] 순서의 adcode 목록 (지정한 단계까지만) */
export interface TeaOrigin {
  adcode: string;
  path: string[];
  name_zh: string;
  name_ko: string;
  level: RegionLevel;
}

export interface Tea {
  id: string;
  name_zh: string; // 간체
  name_zh_trad: string; // 번체
  name_ko: string; // 한글 독음
  category: TeaCategory;
  description: string;
  images: string[];
  origins: TeaOrigin[];
  created_at: string;
  updated_at: string;
}

export type TeaInput = Omit<Tea, "id" | "created_at" | "updated_at">;

/** 내가 마신 기록 (시음 노트) */
export interface Tasting {
  id: string;
  tea_id: string;
  tasted_on: string; // YYYY-MM-DD
  rating: number | null; // 0.5 ~ 5
  price: number | null; // 원
  amount: string; // 가격 기준 양 (예: 50g, 1편 357g)
  shop: string; // 구매처
  vintage: string; // 생산 연도·시기 (예: 2023 명전)
  brewing: string; // 우림 정보 (예: 95℃ · 5g · 110ml · 10초)
  aroma: string; // 향
  taste: string; // 맛
  note: string; // 메모
  photos: string[];
  created_at: string;
  updated_at: string;
}

export type TastingInput = Omit<Tasting, "id" | "created_at" | "updated_at">;
