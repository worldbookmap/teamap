import {
  TEA_CATEGORIES,
  type OriginDetail,
  type TastingInput,
  type TeaCategory,
  type TeaInput,
  type TeaOrigin,
} from "./types";

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function origin(v: unknown): TeaOrigin | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const adcode = str(o.adcode, 20);
  const path = Array.isArray(o.path) ? o.path.map((p) => str(p, 20)).filter(Boolean) : [];
  const level = o.level === "province" || o.level === "city" || o.level === "district" ? o.level : null;
  if (!/^\d{6}$/.test(adcode) || !level) return null;
  const out: TeaOrigin = { adcode, path: path.length ? path : [adcode], name_zh: str(o.name_zh, 100), name_ko: str(o.name_ko, 100), level };
  const detail = originDetail(o.detail);
  if (detail) out.detail = detail;
  return out;
}

function originDetail(v: unknown): OriginDetail | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  const name_zh = str(d.name_zh, 100);
  const name_ko = str(d.name_ko, 100);
  if (!name_zh && !name_ko) return null;
  const out: OriginDetail = { kind: d.kind === "town" ? "town" : "place", name_zh, name_ko };
  const code = str(d.code, 20);
  if (out.kind === "town" && /^\d{9,12}$/.test(code)) out.code = code;
  const lng = Number(d.lng);
  const lat = Number(d.lat);
  // 중국 범위 안의 좌표만
  if (d.lng != null && d.lat != null && lng >= 70 && lng <= 140 && lat >= 0 && lat <= 56) {
    out.lng = Math.round(lng * 1e5) / 1e5;
    out.lat = Math.round(lat * 1e5) / 1e5;
  }
  return out;
}

/** 요청 본문을 TeaInput 으로 정리합니다. partial=true 면 넘어온 필드만 */
export function parseTeaInput(body: unknown, partial = false): { ok: true; value: Partial<TeaInput> } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "잘못된 요청입니다." };
  const b = body as Record<string, unknown>;
  const out: Partial<TeaInput> = {};

  for (const key of ["name_zh", "name_zh_trad", "name_ko", "description", "maker"] as const) {
    if (key in b) out[key] = str(b[key], key === "description" ? 20000 : 200);
  }
  // 상위 차는 처음 만들 때만 정합니다 (수정으로 옮기지 않음)
  if (!partial && "parent_id" in b) out.parent_id = str(b.parent_id, 64) || null;
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
    out.parent_id ??= null;
    out.maker ??= "";
  }
  return { ok: true, value: out };
}

const TASTING_TEXT = ["amount", "shop", "vintage", "brewing", "aroma", "taste", "note"] as const;

/** 마신 기록 요청 본문 정리. partial=true 면 넘어온 필드만 */
export function parseTastingInput(
  body: unknown,
  partial = false,
): { ok: true; value: Partial<TastingInput> } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "잘못된 요청입니다." };
  const b = body as Record<string, unknown>;
  const out: Partial<TastingInput> = {};

  if ("tea_id" in b) out.tea_id = str(b.tea_id, 64);
  if ("tasted_on" in b) {
    const d = str(b.tasted_on, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { ok: false, error: "마신 날짜를 확인해 주세요." };
    out.tasted_on = d;
  }
  if ("rating" in b) {
    if (b.rating == null || b.rating === "") out.rating = null;
    else {
      const r = Math.round(Number(b.rating) * 2) / 2;
      if (!(r >= 0.5 && r <= 5)) return { ok: false, error: "평점은 0.5 ~ 5 사이여야 합니다." };
      out.rating = r;
    }
  }
  if ("price" in b) {
    if (b.price == null || b.price === "") out.price = null;
    else {
      const p = Math.round(Number(String(b.price).replace(/[^\d.]/g, "")));
      if (!Number.isFinite(p) || p < 0 || p > 2_000_000_000) return { ok: false, error: "가격을 확인해 주세요." };
      out.price = p;
    }
  }
  for (const key of TASTING_TEXT) if (key in b) out[key] = str(b[key], key === "note" ? 20000 : 2000);
  if ("photos" in b) {
    out.photos = Array.isArray(b.photos)
      ? b.photos.map((u) => str(u, 2000)).filter((u) => /^(https?:\/\/|\/api\/uploads\/)/.test(u))
      : [];
  }

  if (!partial) {
    if (!out.tea_id) return { ok: false, error: "어떤 차의 기록인지 알 수 없습니다." };
    out.tasted_on ??= new Date().toISOString().slice(0, 10);
    out.rating ??= null;
    out.price ??= null;
    for (const key of TASTING_TEXT) out[key] ??= "";
    out.photos ??= [];
  } else {
    delete out.tea_id; // 다른 차로 옮기지 않음
  }
  return { ok: true, value: out };
}
