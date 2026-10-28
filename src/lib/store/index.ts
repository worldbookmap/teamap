import "server-only";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";
import type { TeaStore } from "./types";

/** SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 있으면 Supabase, 없으면 로컬 파일 저장소 */
export function getStore(): TeaStore {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseStore : localStore;
}
