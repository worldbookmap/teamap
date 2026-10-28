import "server-only";
import { cookies } from "next/headers";

/**
 * 간단한 관리자 인증: ADMIN_PASSWORD 와 일치하면 서명된 쿠키를 발급합니다.
 * 로컬 개발에서 ADMIN_PASSWORD 를 비워두면 누구나 편집할 수 있습니다 (배포 환경에서는 필수).
 */
export const ADMIN_COOKIE = "teamap_admin";

async function sign(value: string) {
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(sig).toString("base64url");
}

export function authDisabled() {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

export async function checkPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return authDisabled();
  const [a, b] = await Promise.all([sign(password), sign(expected)]);
  return a === b;
}

export async function issueToken() {
  return sign("admin");
}

export async function isAdmin() {
  if (authDisabled()) return true;
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && token === (await issueToken());
}

export function unauthorized() {
  return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
}
