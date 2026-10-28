import { SEED_TEAS } from "@/data/seed-teas";
import { loadConverter } from "../converter";
import { makeOrigin } from "../regions";
import type { TeaInput, TeaOrigin } from "../types";

/** 대표 명차 목록을 저장 가능한 형태(번체·한글명·산지 정보 포함)로 만듭니다 */
export async function buildSeedTeas(): Promise<TeaInput[]> {
  const { conv, regions } = await loadConverter();
  return SEED_TEAS.map((t) => ({
    name_zh: t.name_zh,
    name_zh_trad: conv.traditionalize(t.name_zh),
    name_ko: conv.toHangul(t.name_zh),
    category: t.category,
    description: t.description,
    images: [],
    parent_id: null,
    maker: "",
    origins: t.origins.map((code) => makeOrigin(regions, conv, code)).filter((o): o is TeaOrigin => !!o),
  }));
}
