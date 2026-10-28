import { TEA_CATEGORIES, type TeaCategory, type TeaInput, type TeaOrigin } from "./types";

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function origin(v: unknown): TeaOrigin | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const adcode = str(o.adcode, 20);
  const path = Array.isArray(o.path) ? o.path.map((p) => str(p, 20)).filter(Boolean) : [];
  const level = o.level === "province" || o.level === "city" || o.level === "district" ? o.level : null;
  if (!/^\d{6}$/.test(adcode) || !level) return null;
  return { adcode, path: path.length ? path : [adcode], name_zh: str(o.name_zh, 100), name_ko: str(o.name_ko, 100), level };
}

/** 요청 본문을 TeaInput 으로 정리합니다. partial=true 면 넘어온 필드만 */
export function parseTeaInput(body: unknown, partial = false): { ok: true; value: Partial<TeaInput> } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "잘못된 요청입니다." };
  const b = body as Record<string, unknown>;
  const out: Partial<TeaInput> = {};

  for (const key of ["name_zh", "name_zh_trad", "name_ko", "description"] as const) {
    if (key in b) out[key] = str(b[key], key === "description" ? 20000 : 200);
  }
  if ("category" in b) {
    if (!TEA_CATEGORIES.includes(b.category as TeaCategory)) return { ok: false, error: "다류를 선택해 주세요." };
    out.category = b.category as TeaCategory;
  }
  if ("images" in b) {
    out.images = Array.isArray(b.images)
      ? b.images.map((u) => str(u, 2000)).filter((u) => /^(https?:\/\/|\/api\/uploads\/)/.test(u))
      : [];
  }
  if ("origins" in b) {
    out.origins = Array.isArray(b.origins) ? b.origins.map(origin).filter((o): o is TeaOrigin => !!o) : [];
  }

  if (!partial) {
    if (!out.name_zh && !out.name_ko) return { ok: false, error: "차 이름(한자 또는 한글)을 입력해 주세요." };
    if (!out.category) return { ok: false, error: "다류를 선택해 주세요." };
    out.name_zh ??= "";
    out.name_zh_trad ??= "";
    out.name_ko ??= "";
    out.description ??= "";
    out.images ??= [];
    out.origins ??= [];
  }
  return { ok: true, value: out };
}
