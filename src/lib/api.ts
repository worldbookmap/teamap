import type { RegionMap, RegionMapInput, Tasting, TastingInput, Tea, TeaInput } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `요청 실패 (${res.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  listTeas: () => request<Tea[]>("/api/teas", { cache: "no-store" }),
  createTea: (input: TeaInput) => request<Tea>("/api/teas", json("POST", input)),
  updateTea: (id: string, input: Partial<TeaInput>) => request<Tea>(`/api/teas/${id}`, json("PATCH", input)),
  deleteTea: (id: string) => request<void>(`/api/teas/${id}`, { method: "DELETE" }),
  /** 이미지 올리기: Supabase 면 브라우저에서 저장소로 바로, 로컬이면 서버를 거쳐 */
  upload: async (files: File[]): Promise<{ urls: string[] }> => {
    const plan = await request<{ mode: "direct"; uploads: { uploadUrl: string; publicUrl: string }[] } | { mode: "server" }>(
      "/api/upload/sign",
      json("POST", { files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) }),
    );
    if (plan.mode === "direct") {
      await Promise.all(
        files.map(async (file, i) => {
          const body = new FormData();
          body.append("cacheControl", "31536000");
          body.append("", file);
          const res = await fetch(plan.uploads[i].uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
          if (!res.ok) throw new Error(`${file.name}: 업로드 실패 (${res.status})`);
        }),
      );
      return { urls: plan.uploads.map((u) => u.publicUrl) };
    }
    const form = new FormData();
    files.forEach((f) => form.append("file", f));
    return request<{ urls: string[] }>("/api/upload", { method: "POST", body: form });
  },
  listTastings: (teaId?: string) =>
    request<Tasting[]>(`/api/tastings${teaId ? `?tea_id=${encodeURIComponent(teaId)}` : ""}`, { cache: "no-store" }),
  createTasting: (input: TastingInput) => request<Tasting>("/api/tastings", json("POST", input)),
  updateTasting: (id: string, input: Partial<TastingInput>) => request<Tasting>(`/api/tastings/${id}`, json("PATCH", input)),
  deleteTasting: (id: string) => request<void>(`/api/tastings/${id}`, { method: "DELETE" }),
  listRegionMaps: () => request<RegionMap[]>("/api/region-maps", { cache: "no-store" }),
  createRegionMap: (input: RegionMapInput) => request<RegionMap>("/api/region-maps", json("POST", input)),
  updateRegionMap: (id: string, input: Partial<RegionMapInput>) => request<RegionMap>(`/api/region-maps/${id}`, json("PATCH", input)),
  deleteRegionMap: (id: string) => request<void>(`/api/region-maps/${id}`, { method: "DELETE" }),
  me: () => request<{ admin: boolean; authDisabled: boolean; store: "local" | "supabase" }>("/api/auth/me", { cache: "no-store" }),
  login: (password: string) => request<{ admin: boolean }>("/api/auth/login", json("POST", { password })),
  logout: () => request<{ admin: boolean }>("/api/auth/logout", { method: "POST" }),
};
