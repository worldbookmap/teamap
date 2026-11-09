import { connection } from "next/server";
import { isTheteaSlug } from "@/lib/thetea";
import { fetchTheteaArticle } from "@/lib/thetea-server";

/** thetea.app 한국어 글 하나를 장(章)별로 정리해 돌려줍니다 */
export async function GET(_req: Request, ctx: RouteContext<"/api/thetea/[slug]">) {
  await connection();
  const { slug } = await ctx.params;
  if (!isTheteaSlug(slug)) return Response.json({ error: "잘못된 글 주소입니다." }, { status: 400 });
  try {
    const article = await fetchTheteaArticle(slug);
    if (!article) return Response.json({ error: "백과사전에 이 글이 없습니다." }, { status: 404 });
    return Response.json(article, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
