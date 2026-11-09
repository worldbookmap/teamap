import { connection } from "next/server";
import { fetchTheteaIndex } from "@/lib/thetea-server";

/** thetea.app 백과사전 글 목록 (한국어 이름·병음·한자·분류) */
export async function GET() {
  await connection(); // 빌드 때 남의 사이트를 받지 않도록 — 요청 때 받고 하루 캐시
  try {
    return Response.json(await fetchTheteaIndex(), {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
