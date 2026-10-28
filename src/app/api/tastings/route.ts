import { connection } from "next/server";
import { storeError } from "@/lib/api-errors";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { TastingInput } from "@/lib/types";
import { parseTastingInput } from "@/lib/validate";

/** GET /api/tastings?tea_id=… — 없으면 전체 기록 */
export async function GET(request: Request) {
  await connection();
  const teaId = new URL(request.url).searchParams.get("tea_id") ?? undefined;
  try {
    return Response.json(await getStore().listTastings(teaId));
  } catch (e) {
    return storeError(e);
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = parseTastingInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const store = getStore();
  try {
    if (!(await store.get(parsed.value.tea_id!))) return Response.json({ error: "차를 찾을 수 없습니다." }, { status: 404 });
    return Response.json(await store.createTasting(parsed.value as TastingInput), { status: 201 });
  } catch (e) {
    return storeError(e);
  }
}
