import { storeError } from "@/lib/api-errors";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

/** 브라우저에서 저장소로 바로 올리는 이미지 크기 한도 (서버를 거치지 않으므로 Vercel 4.5MB 제한과 무관) */
const MAX_DIRECT_BYTES = 25 * 1024 * 1024;

/**
 * POST { files: [{ name, type, size }] }
 * → { mode: "direct", uploads: [{ uploadUrl, publicUrl }] }  (Supabase: 브라우저가 uploadUrl 로 바로 PUT)
 * → { mode: "server" }                                        (로컬 저장소: /api/upload 로 올림)
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = (await request.json().catch(() => null)) as { files?: { name?: string; type?: string; size?: number }[] } | null;
  const files = Array.isArray(body?.files) ? body.files.slice(0, 30) : [];
  if (!files.length) return Response.json({ error: "이미지 파일이 없습니다." }, { status: 400 });
  for (const f of files) {
    if (!String(f.type ?? "").startsWith("image/")) return Response.json({ error: `${f.name}: 이미지 파일만 올릴 수 있습니다.` }, { status: 400 });
    if (Number(f.size) > MAX_DIRECT_BYTES) return Response.json({ error: `${f.name}: 25MB 이하만 올릴 수 있습니다.` }, { status: 400 });
  }
  try {
    const store = getStore();
    const uploads = [];
    for (const f of files) {
      const signed = await store.signUpload({ name: String(f.name ?? ""), type: String(f.type) });
      if (!signed) return Response.json({ mode: "server" });
      uploads.push(signed);
    }
    return Response.json({ mode: "direct", uploads });
  } catch (e) {
    return storeError(e);
  }
}
