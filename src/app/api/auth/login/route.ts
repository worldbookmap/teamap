import { cookies } from "next/headers";
import { ADMIN_COOKIE, checkPassword, issueToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!(await checkPassword(password ?? ""))) {
    return Response.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE, await issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ admin: true });
}
