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
