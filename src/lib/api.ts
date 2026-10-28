import type { Tea, TeaInput } from "./types";

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
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("file", f));
    return request<{ urls: string[] }>("/api/upload", { method: "POST", body: form });
  },
  me: () => request<{ admin: boolean; authDisabled: boolean; store: "local" | "supabase" }>("/api/auth/me", { cache: "no-store" }),
  login: (password: string) => request<{ admin: boolean }>("/api/auth/login", json("POST", { password })),
  logout: () => request<{ admin: boolean }>("/api/auth/logout", { method: "POST" }),
};
