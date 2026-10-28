import { connection } from "next/server";
import { storeError } from "@/lib/api-errors";
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
  const store = getStore();
  try {
    if (parsed.value.parent_id) {
      const parent = await store.get(parsed.value.parent_id);
      if (!parent) return Response.json({ error: "상위 차를 찾을 수 없습니다." }, { status: 404 });
      if (parent.parent_id) return Response.json({ error: "제품 아래에는 다시 제품을 둘 수 없습니다." }, { status: 400 });
    }
    return Response.json(await store.create(parsed.value as TeaInput), { status: 201 });
  } catch (e) {
    return storeError(e);
  }
}
