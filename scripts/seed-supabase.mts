// Supabase teas 테이블이 비어 있으면 대표 명차를 넣습니다.
// 사용법: npm run seed:supabase  (.env.local 의 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 사용)
import { createClient } from "@supabase/supabase-js";
import { buildSeedTeas } from "@/lib/store/seed";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정해 주세요.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { count, error } = await db.from("teas").select("id", { count: "exact", head: true });
if (error) throw new Error(`${error.message}\n→ supabase/migrations 의 SQL 을 먼저 실행했는지 확인해 주세요.`);
if (count) {
  console.log(`이미 ${count}개의 차가 있어 건너뜁니다.`);
  process.exit(0);
}
const teas = await buildSeedTeas();
const { error: insertError } = await db.from("teas").insert(teas);
if (insertError) throw new Error(insertError.message);
console.log(`${teas.length}개의 차를 넣었습니다.`);
