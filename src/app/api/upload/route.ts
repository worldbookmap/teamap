import { isAdmin, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "이미지 파일이 없습니다." }, { status: 400 });

  const store = getStore();
  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) return Response.json({ error: `${file.name}: 이미지 파일만 올릴 수 있습니다.` }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: `${file.name}: 8MB 이하만 올릴 수 있습니다.` }, { status: 400 });
    urls.push(await store.uploadImage(file));
  }
  return Response.json({ urls });
}
