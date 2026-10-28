import type { Tasting, TastingInput, Tea, TeaInput } from "../types";

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
}

/** Supabase 에 아직 실행하지 않은 마이그레이션이 있을 때 (테이블·컬럼 없음) */
export class MissingTableError extends Error {
  constructor(what: string, migration: string) {
    super(`Supabase 에 ${what} 이(가) 없습니다. SQL Editor 에서 ${migration} 을 실행해 주세요.`);
  }
}
