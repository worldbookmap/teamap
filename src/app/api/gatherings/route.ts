import { connection } from "next/server";
import { storeError } from "@/lib/api-errors";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { GatheringInput } from "@/lib/types";
import { parseGatheringInput } from "@/lib/validate";

/** GET /api/gatherings — 티끌 모임 기록 (최근 날짜 순) */
export async function GET() {
  await connection();
  try {
    return Response.json(await getStore().listGatherings());
  } catch (e) {
    return storeError(e);
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = parseGatheringInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    return Response.json(await getStore().createGathering(parsed.value as GatheringInput), { status: 201 });
  } catch (e) {
    return storeError(e);
  }
}
