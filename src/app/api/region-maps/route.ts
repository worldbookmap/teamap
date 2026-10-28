import { connection } from "next/server";
import { storeError } from "@/lib/api-errors";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { RegionMapInput } from "@/lib/types";
import { parseRegionMapInput } from "@/lib/validate";

export async function GET() {
  await connection();
  try {
    return Response.json(await getStore().listRegionMaps());
  } catch (e) {
    return storeError(e);
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const parsed = parseRegionMapInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    return Response.json(await getStore().createRegionMap(parsed.value as RegionMapInput), { status: 201 });
  } catch (e) {
    return storeError(e);
  }
}
