import { storeError } from "@/lib/api-errors";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { parseTastingInput } from "@/lib/validate";

const notFound = () => Response.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });

export async function PATCH(request: Request, ctx: RouteContext<"/api/tastings/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const parsed = parseTastingInput(await request.json().catch(() => null), true);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const t = await getStore().updateTasting(id, parsed.value);
    return t ? Response.json(t) : notFound();
  } catch (e) {
    return storeError(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tastings/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  try {
    return (await getStore().removeTasting(id)) ? new Response(null, { status: 204 }) : notFound();
  } catch (e) {
    return storeError(e);
  }
}
