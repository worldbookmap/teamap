// 로컬 저장소(.data/teas.json, .data/uploads)의 데이터를 Supabase 로 옮깁니다.
// 사용법: npm run migrate:supabase
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Tea } from "@/lib/types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정해 주세요.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const dataDir = path.join(process.cwd(), ".data");
const teas: Tea[] = JSON.parse(await fs.readFile(path.join(dataDir, "teas.json"), "utf8"));

const uploaded = new Map<string, string>();
async function moveImage(src: string) {
  if (!src.startsWith("/api/uploads/")) return src;
  if (uploaded.has(src)) return uploaded.get(src)!;
  const name = path.basename(src);
  const body = await fs.readFile(path.join(dataDir, "uploads", name));
  const keyPath = `migrated/${name}`;
  const type = { ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif" }[path.extname(name)] ?? "image/jpeg";
  const { error } = await db.storage.from("tea-images").upload(keyPath, body, { contentType: type, upsert: true });
  if (error) throw new Error(`${name}: ${error.message}`);
  const publicUrl = db.storage.from("tea-images").getPublicUrl(keyPath).data.publicUrl;
  uploaded.set(src, publicUrl);
  return publicUrl;
}

for (const tea of teas) {
  const images = await Promise.all(tea.images.map(moveImage));
  const { error } = await db.from("teas").upsert({ ...tea, images });
  if (error) throw new Error(`${tea.name_zh}: ${error.message}`);
  console.log(`✓ ${tea.name_ko} ${tea.name_zh}`);
}
console.log(`${teas.length}개의 차, ${uploaded.size}개의 이미지를 옮겼습니다.`);
