import type { RegionMap, RegionMapInput, Tasting, TastingInput, Tea, TeaInput } from "../types";

export interface TeaStore {
  kind: "local" | "supabase";
  list(): Promise<Tea[]>;
  get(id: string): Promise<Tea | null>;
  create(input: TeaInput): Promise<Tea>;
  update(id: string, input: Partial<TeaInput>): Promise<Tea | null>;
  remove(id: string): Promise<boolean>;
  /** 이미지를 저장하고 공개 URL 을 돌려줍니다 */
  uploadImage(file: File): Promise<string>;

  /** 마신 기록. teaId 를 주면 그 차의 기록만 (최근 날짜 순) */
  listTastings(teaId?: string): Promise<Tasting[]>;
  createTasting(input: TastingInput): Promise<Tasting>;
  updateTasting(id: string, input: Partial<TastingInput>): Promise<Tasting | null>;
  removeTasting(id: string): Promise<boolean>;

  /** 지역 참고 지도 */
  listRegionMaps(): Promise<RegionMap[]>;
  createRegionMap(input: RegionMapInput): Promise<RegionMap>;
  updateRegionMap(id: string, input: Partial<RegionMapInput>): Promise<RegionMap | null>;
  removeRegionMap(id: string): Promise<boolean>;

  /**
   * 브라우저에서 저장소로 바로 올릴 수 있는 일회용 주소 (Vercel 의 4.5MB 요청 제한을 피함).
   * 지원하지 않으면 null — 그때는 /api/upload 로 서버를 거쳐 올립니다.
   */
  signUpload(file: { name: string; type: string }): Promise<{ uploadUrl: string; publicUrl: string } | null>;
}

/** Supabase 에 아직 실행하지 않은 마이그레이션이 있을 때 (테이블·컬럼 없음) */
export class MissingTableError extends Error {
  constructor(what: string, migration: string) {
    super(`Supabase 에 ${what} 이(가) 없습니다. SQL Editor 에서 ${migration} 을 실행해 주세요.`);
  }
}
