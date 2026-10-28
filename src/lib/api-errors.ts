import { MissingTableError } from "./store/types";

/** 저장소 오류를 JSON 응답으로 (테이블 미생성은 503 + 안내 문구) */
export function storeError(e: unknown) {
  if (e instanceof MissingTableError) return Response.json({ error: e.message, missingTable: true }, { status: 503 });
  console.error(e);
  return Response.json({ error: (e as Error).message ?? "저장소 오류" }, { status: 500 });
}
