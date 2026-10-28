import { connection } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { TeaInput } from "@/lib/types";
import { parseTeaInput } from "@/lib/validate";

export async function GET() {
  await connection(); // 저장소를 요청마다 읽도록 (캐시·정적 생성 방지)
  const teas = await getStore().list();
  return Response.json(teas);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = parseTeaInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const tea = await getStore().create(parsed.value as TeaInput);
  return Response.json(tea, { status: 201 });
}
