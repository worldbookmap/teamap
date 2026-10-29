import { connection } from "next/server";
import { getStore } from "@/lib/store";
import { pingSupabase } from "@/lib/store/supabase";

/**
 * Supabase 무료 플랜은 일주일 동안 요청이 없으면 일시 중지됩니다.
 * Vercel Cron(vercel.json)이 하루 한 번 호출해 가벼운 조회를 보냅니다.
 * CRON_SECRET 이 설정돼 있으면 Vercel 이 보내는 Authorization 헤더만 받습니다.
 */
export async function GET(req: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (getStore().kind !== "supabase") return Response.json({ ok: true, skipped: "local store" });
  try {
    await pingSupabase();
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
