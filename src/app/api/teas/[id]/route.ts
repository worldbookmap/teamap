import { connection } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { parseTeaInput } from "@/lib/validate";

const notFound = () => Response.json({ error: "차를 찾을 수 없습니다." }, { status: 404 });

export async function GET(_req: Request, ctx: RouteContext<"/api/teas/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const tea = await getStore().get(id);
  return tea ? Response.json(tea) : notFound();
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/teas/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const parsed = parseTeaInput(await request.json().catch(() => null), true);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const tea = await getStore().update(id, parsed.value);
  return tea ? Response.json(tea) : notFound();
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/teas/[id]">) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  return (await getStore().remove(id)) ? new Response(null, { status: 204 }) : notFound();
}
