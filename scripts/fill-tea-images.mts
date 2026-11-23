// 대표 사진이 없는 차에 백과사전(thetea.app) 글의 대표 사진, 없으면 위키백과 문서 사진을 넣습니다.
// 사용법: npm run images:fill -- [--dry]
import { createClient } from "@supabase/supabase-js";
import { TheteaIndex, type TheteaEntry } from "@/lib/thetea";
import type { Tea } from "@/lib/types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정해 주세요.");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const db = createClient(url, key, { auth: { persistSession: false } });
const UA = { "User-Agent": "teamap (Chinese tea map)" };

const { data, error } = await db.from("teas").select("*");
if (error) throw error;
const teas = (data as Tea[]).filter((t) => !t.images?.length);
console.log(`대표 사진이 없는 차: ${teas.length}개`);

const [list, names] = await Promise.all([
  fetch("https://thetea.app/search.json", { headers: UA }).then((r) => r.json() as Promise<{ s: string; t: string; c?: string; p: string }[]>),
  fetch("https://thetea.app/names-ko.json", { headers: UA }).then((r) => (r.ok ? r.json() : {})) as Promise<Record<string, string>>,
]);
const entries: TheteaEntry[] = list.map((x) => ({ s: x.s, k: names[x.s] || x.t, t: x.t, c: x.c ?? "", p: x.p }));
const index = new TheteaIndex(entries);

/** 이름이 달라 자동으로 못 찾는 차 → 백과사전 글 */
const MANUAL: Record<string, string> = { 武夷肉桂: "rou-gui", 육보: "liu-bao-cha", "大雪山 紫芽苞": "da-xue-shan" };

async function theteaImage(tea: Tea): Promise<{ src: string; from: string } | null> {
  const manual = MANUAL[tea.name_zh] ?? MANUAL[tea.name_ko];
  const entry = manual ? index.bySlug.get(manual) : index.linked(tea).entry;
  if (!entry) return null;
  const html = await fetch(`https://thetea.app/ko/article/${encodeURIComponent(entry.s)}`, { headers: UA }).then((r) => (r.ok ? r.text() : ""));
  const src = /<meta property="og:image" content="(https:\/\/media\.thetea\.app\/[^"]+)"/.exec(html)?.[1];
  return src ? { src, from: `thetea:${entry.s}` } : null;
}

/** 위키백과 문서의 대표 그림 (중국어 간체 → 번체 → 한국어 순) */
async function wikiImage(tea: Tea): Promise<{ src: string; from: string } | null> {
  const tries: [string, string][] = [
    ["zh", tea.name_zh],
    ["zh", tea.name_zh_trad],
    ["ko", tea.name_ko],
  ];
  for (const [lang, title] of tries) {
    if (!title) continue;
    const q = new URLSearchParams({
      action: "query", format: "json", redirects: "1", prop: "pageimages", piprop: "original", titles: title,
    });
    const j = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, { headers: UA }).then((r) => r.json()).catch(() => null);
    const page = j && (Object.values(j.query?.pages ?? {})[0] as { title?: string; original?: { source: string } } | undefined);
    const src = page?.original?.source;
    if (src && !/\.svg$/i.test(src)) return { src, from: `${lang}wiki:${page!.title}` };
  }
  return null;
}

let done = 0;
for (const tea of teas) {
  const hit = (await theteaImage(tea).catch(() => null)) ?? (await wikiImage(tea).catch(() => null));
  if (!hit) {
    console.log(`✗ ${tea.name_ko} ${tea.name_zh} — 사진을 찾지 못함`);
    continue;
  }
  console.log(`${dry ? "·" : "✓"} ${tea.name_ko} ${tea.name_zh} ← ${hit.from} ${hit.src}`);
  if (dry) continue;

  const res = await fetch(hit.src, { headers: UA });
  if (!res.ok) {
    console.log(`  내려받기 실패 (${res.status})`);
    continue;
  }
  const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!type.startsWith("image/")) continue;
  const ext = { "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" }[type] ?? "jpg";
  const path = `reference/${tea.id}.${ext}`;
  const up = await db.storage.from("tea-images").upload(path, Buffer.from(await res.arrayBuffer()), { contentType: type, upsert: true });
  if (up.error) throw new Error(`${tea.name_zh}: ${up.error.message}`);
  const publicUrl = db.storage.from("tea-images").getPublicUrl(path).data.publicUrl;
  const { error: e } = await db.from("teas").update({ images: [publicUrl] }).eq("id", tea.id);
  if (e) throw new Error(`${tea.name_zh}: ${e.message}`);
  done++;
}
console.log(dry ? "(미리 보기만 했습니다)" : `${done}개의 차에 사진을 넣었습니다.`);
