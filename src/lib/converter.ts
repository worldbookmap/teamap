import { WORDS } from "@/data/dictionary";
import { HanjaConverter, type HanjaData } from "./hanja";
import { regionWords, type RegionIndex } from "./regions";

export interface ConverterBundle {
  conv: HanjaConverter;
  regions: RegionIndex;
}

let pending: Promise<ConverterBundle> | null = null;

/** 한자 데이터(약 300KB)와 지역 색인은 필요할 때 한 번만 불러옵니다 */
export function loadConverter(): Promise<ConverterBundle> {
  pending ??= Promise.all([import("@/data/hanja.json"), import("@/data/regions.json")]).then(
    ([hanja, regions]) => {
      const data = (hanja.default ?? hanja) as unknown as HanjaData;
      const index = (regions.default ?? regions) as unknown as RegionIndex;
      const conv = new HanjaConverter(data, WORDS);
      conv.addWords(regionWords(index, conv));
      return { conv, regions: index };
    },
  );
  return pending;
}
