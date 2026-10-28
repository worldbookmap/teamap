import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Tasting, TastingInput, Tea, TeaInput } from "../types";
import { extOf } from "./local";
import { MissingTableError, type TeaStore } from "./types";

export const IMAGE_BUCKET = "tea-images";
const TABLE = "teas";
const TASTINGS = "tastings";
const TASTINGS_MIGRATION = "supabase/migrations/20261028010000_tastings.sql";

let client: SupabaseClient | null = null;

/** 서버 전용 클라이언트 (service role 키 사용 — 브라우저로 내보내지 않습니다) */
function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

function check<T>({ data, error }: { data: T; error: { message: string; code?: string } | null }): T {
  if (error?.code === "PGRST205" && error.message.includes(TASTINGS)) {
    throw new MissingTableError(TASTINGS, TASTINGS_MIGRATION);
  }
  if (error) throw new Error(error.message);
  return data;
}

/** numeric 컬럼은 문자열로 올 수 있어 숫자로 맞춥니다 */
const normTasting = (t: Tasting): Tasting => ({ ...t, rating: t.rating == null ? null : Number(t.rating) });

export const supabaseStore: TeaStore = {
  kind: "supabase",

  async list() {
    return check(await db().from(TABLE).select("*").order("created_at")) as Tea[];
  },

  async get(id) {
    return check(await db().from(TABLE).select("*").eq("id", id).maybeSingle()) as Tea | null;
  },

  async create(input: TeaInput) {
    return check(await db().from(TABLE).insert(input).select().single()) as Tea;
  },

  async update(id, input) {
    const rows = check(
      await db()
        .from(TABLE)
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(),
    ) as Tea[];
    return rows[0] ?? null;
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
