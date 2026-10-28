import fs from "node:fs/promises";
import path from "node:path";
import type { Tasting, TastingInput, Tea, TeaInput } from "../types";
import { buildSeedTeas } from "./seed";
import type { TeaStore } from "./types";

/** Supabase 를 설정하기 전 로컬 테스트용 저장소: .data/teas.json + .data/uploads/ */
export const DATA_DIR = path.join(process.cwd(), ".data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "teas.json");
const TASTING_FILE = path.join(DATA_DIR, "tastings.json");

let queue: Promise<unknown> = Promise.resolve();
/** 파일 쓰기가 겹치지 않도록 순서대로 실행 */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

async function readAll(): Promise<Tea[]> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const now = new Date().toISOString();
    const seeded = (await buildSeedTeas()).map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    }));
    await writeAll(seeded);
    return seeded;
  }
}

async function writeAll(teas: Tea[]) {
  await writeJson(DB_FILE, teas);
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

async function readTastings(): Promise<Tasting[]> {
  try {
    return JSON.parse(await fs.readFile(TASTING_FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

const byDateDesc = (a: Tasting, b: Tasting) =>
  b.tasted_on.localeCompare(a.tasted_on) || b.created_at.localeCompare(a.created_at);

export const localStore: TeaStore = {
  kind: "local",

  list: () => serial(readAll),

  get: (id) => serial(async () => (await readAll()).find((t) => t.id === id) ?? null),

  create: (input: TeaInput) =>
    serial(async () => {
      const teas = await readAll();
      const now = new Date().toISOString();
      const tea: Tea = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
      teas.push(tea);
      await writeAll(teas);
      return tea;
    }),

  update: (id, input) =>
    serial(async () => {
      const teas = await readAll();
      const i = teas.findIndex((t) => t.id === id);
      if (i < 0) return null;
      teas[i] = { ...teas[i], ...input, id, updated_at: new Date().toISOString() };
      await writeAll(teas);
      return teas[i];
    }),

  remove: (id) =>
    serial(async () => {
      const teas = await readAll();
      const next = teas.filter((t) => t.id !== id);
      if (next.length === teas.length) return false;
      await writeAll(next);
      const tastings = await readTastings();
      const kept = tastings.filter((t) => t.tea_id !== id);
      if (kept.length !== tastings.length) await writeJson(TASTING_FILE, kept);
      return true;
    }),

  listTastings: (teaId) =>
    serial(async () =>
      (await readTastings()).filter((t) => !teaId || t.tea_id === teaId).sort(byDateDesc),
    ),

  createTasting: (input: TastingInput) =>
    serial(async () => {
      const list = await readTastings();
      const now = new Date().toISOString();
      const tasting: Tasting = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
      list.push(tasting);
      await writeJson(TASTING_FILE, list);
      return tasting;
    }),

  updateTasting: (id, input) =>
    serial(async () => {
      const list = await readTastings();
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) return null;
      list[i] = { ...list[i], ...input, id, updated_at: new Date().toISOString() };
      await writeJson(TASTING_FILE, list);
      return list[i];
    }),

  removeTasting: (id) =>
    serial(async () => {
      const list = await readTastings();
      const next = list.filter((t) => t.id !== id);
      if (next.length === list.length) return false;
      await writeJson(TASTING_FILE, next);
      return true;
    }),

  async uploadImage(file) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomUUID()}${extOf(file)}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
    return `/api/uploads/${name}`;
  },
};

export function extOf(file: File) {
  const fromName = path.extname(file.name).toLowerCase();
  if (/^\.(jpe?g|png|webp|gif|avif)$/.test(fromName)) return fromName;
  return { "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif" }[file.type] ?? ".jpg";
}
