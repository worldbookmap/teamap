import { connection } from "next/server";
import { authDisabled, isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection(); // 요청마다 쿠키를 확인하도록 (빌드 시 정적 생성 방지)
  return Response.json({ admin: await isAdmin(), authDisabled: authDisabled(), store: getStore().kind });
}
