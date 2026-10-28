import type { Tea, TeaInput } from "../types";

export interface TeaStore {
  kind: "local" | "supabase";
  list(): Promise<Tea[]>;
  get(id: string): Promise<Tea | null>;
  create(input: TeaInput): Promise<Tea>;
  update(id: string, input: Partial<TeaInput>): Promise<Tea | null>;
  remove(id: string): Promise<boolean>;
  /** 이미지를 저장하고 공개 URL 을 돌려줍니다 */
  uploadImage(file: File): Promise<string>;
}
