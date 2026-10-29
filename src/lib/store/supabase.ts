import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RegionMap, RegionMapInput, Tasting, TastingInput, Tea, TeaInput } from "../types";
import { extOf } from "./local";
import { MissingTableError, type TeaStore } from "./types";

export const IMAGE_BUCKET = "tea-images";
const TABLE = "teas";
const TASTINGS = "tastings";
const TASTINGS_MIGRATION = "supabase/migrations/20261028010000_tastings.sql";
const PRODUCTS_MIGRATION = "supabase/migrations/20261028020000_tea_products.sql";
const MAPS = "region_maps";
const MAPS_MIGRATION = "supabase/migrations/20261028030000_region_maps.sql";

let client: SupabaseClient | null = null;

/** 서버 전용 클라이언트 (service role 키 사용 — 브라우저로 내보내지 않습니다) */
function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

function check<T>({ data, error }: { data: T; error: { message: string; code?: string } | null }): T {
  if (error?.code === "PGRST205" && error.message.includes(MAPS)) {
    throw new MissingTableError(`${MAPS} 테이블`, MAPS_MIGRATION);
  }
  if (error?.code === "PGRST205" && error.message.includes(TASTINGS)) {
    throw new MissingTableError(`${TASTINGS} 테이블`, TASTINGS_MIGRATION);
  }
  // PGRST204: 컬럼 없음 (제품 기능 마이그레이션 전)
  if (error?.code === "PGRST204" && /parent_id|maker/.test(error.message)) {
    throw new MissingTableError("제품용 컬럼(parent_id, maker)", PRODUCTS_MIGRATION);
  }
  if (error) throw new Error(error.message);
  return data;
}

/** numeric 컬럼은 문자열로 올 수 있어 숫자로 맞춥니다 */
const normTasting = (t: Tasting): Tasting => ({ ...t, rating: t.rating == null ? null : Number(t.rating) });

/** 마이그레이션 전 행에는 parent_id·maker 가 없을 수 있습니다 */
const normTea = (t: Tea): Tea => ({ ...t, parent_id: t.parent_id ?? null, maker: t.maker ?? "" });

/** 제품 기능 마이그레이션 전이면 기본값과 같은 필드는 빼고 보냅니다 (기존 기능은 계속 작동) */
function withoutDefaultProductFields<T extends Partial<TeaInput>>(input: T): T {
  const out = { ...input };
  if (out.parent_id == null) delete out.parent_id;
  if (!out.maker) delete out.maker;
  return out;
}

/** 무료 플랜이 쉬는 상태로 잠기지 않도록 가벼운 조회 한 번 (하루 한 번 cron 에서 호출) */
export async function pingSupabase() {
  check(await db().from(TABLE).select("id").limit(1));
}

export const supabaseStore: TeaStore = {
  kind: "supabase",

  async list() {
    return (check(await db().from(TABLE).select("*").order("created_at")) as Tea[]).map(normTea);
  },

  async get(id) {
    const tea = check(await db().from(TABLE).select("*").eq("id", id).maybeSingle()) as Tea | null;
    return tea && normTea(tea);
  },

  async create(input: TeaInput) {
    return normTea(check(await db().from(TABLE).insert(withoutDefaultProductFields(input)).select().single()) as Tea);
  },

  async update(id, input) {
    const rows = check(
      await db()
        .from(TABLE)
        .update({ ...withoutDefaultProductFields(input), updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(),
    ) as Tea[];
    return rows[0] ? normTea(rows[0]) : null;
  },

  async remove(id) {
    const rows = check(await db().from(TABLE).delete().eq("id", id).select("id")) as { id: string }[];
    return rows.length > 0;
  },

  async listTastings(teaId) {
    let q = db().from(TASTINGS).select("*");
    if (teaId) q = q.eq("tea_id", teaId);
    const rows = check(await q.order("tasted_on", { ascending: false }).order("created_at", { ascending: false })) as Tasting[];
    return rows.map(normTasting);
  },

  async createTasting(input: TastingInput) {
    return normTasting(check(await db().from(TASTINGS).insert(input).select().single()) as Tasting);
  },

  async updateTasting(id, input) {
    const rows = check(
      await db()
        .from(TASTINGS)
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(),
    ) as Tasting[];
    return rows[0] ? normTasting(rows[0]) : null;
  },

  async removeTasting(id) {
    const rows = check(await db().from(TASTINGS).delete().eq("id", id).select("id")) as { id: string }[];
    return rows.length > 0;
  },

  async listRegionMaps() {
    return check(await db().from(MAPS).select("*").order("created_at")) as RegionMap[];
  },

  async createRegionMap(input: RegionMapInput) {
    return check(await db().from(MAPS).insert(input).select().single()) as RegionMap;
  },

  async updateRegionMap(id, input) {
    const rows = check(
      await db()
        .from(MAPS)
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(),
    ) as RegionMap[];
    return rows[0] ?? null;
  },

  async removeRegionMap(id) {
    const rows = check(await db().from(MAPS).delete().eq("id", id).select("id")) as { id: string }[];
    return rows.length > 0;
  },

  async signUpload(file) {
    const key = `${new Date().getFullYear()}/${crypto.randomUUID()}${extOf(file)}`;
    const { signedUrl } = check(await db().storage.from(IMAGE_BUCKET).createSignedUploadUrl(key)) as { signedUrl: string };
    return { uploadUrl: signedUrl, publicUrl: db().storage.from(IMAGE_BUCKET).getPublicUrl(key).data.publicUrl };
  },

  async uploadImage(file) {
    const key = `${new Date().getFullYear()}/${crypto.randomUUID()}${extOf(file)}`;
    check(
      await db()
        .storage.from(IMAGE_BUCKET)
        .upload(key, file, { contentType: file.type || "image/jpeg", upsert: false }),
    );
    return db().storage.from(IMAGE_BUCKET).getPublicUrl(key).data.publicUrl;
  },
};
