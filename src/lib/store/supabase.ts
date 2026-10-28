import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Tea, TeaInput } from "../types";
import { extOf } from "./local";
import type { TeaStore } from "./types";

export const IMAGE_BUCKET = "tea-images";
const TABLE = "teas";

let client: SupabaseClient | null = null;

/** 서버 전용 클라이언트 (service role 키 사용 — 브라우저로 내보내지 않습니다) */
function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

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
