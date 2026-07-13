import type { Env } from "../_lib/types.ts";
import { json, error, readJson } from "../_lib/http.ts";
import { listIds } from "../_lib/db.ts";
import { isValidId } from "../_lib/validate.ts";

type Ctx = { request: Request; env: Env };

// Tope de filas: `saved` es una lista pública sin auth; evita crecimiento ilimitado
// por escrituras automatizadas (curl en bucle).
const MAX_SAVED = 5000;

// GET /api/saved → { saved: string[] } (lectura pública).
export const onRequestGet = async ({ env }: Ctx): Promise<Response> => {
  try {
    return json({ saved: await listIds(env, "saved") });
  } catch (err) {
    return error(`No se pudo leer guardados: ${(err as Error).message}`, 500);
  }
};

// POST /api/saved — body { id } añade. Sin auth (sincronización ligera).
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  const body = await readJson<{ id?: string }>(request);
  const id = body?.id?.trim();
  if (!isValidId(id)) return error("Falta un 'id' válido a guardar", 400);
  try {
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM saved").first<number>("n");
    if ((count ?? 0) >= MAX_SAVED) return error("Lista de guardados llena", 429);

    await env.DB.prepare("INSERT OR REPLACE INTO saved (id, saved_at) VALUES (?, ?)")
      .bind(id, new Date().toISOString())
      .run();
    return json({ ok: true });
  } catch (err) {
    return error(`No se pudo guardar: ${(err as Error).message}`, 500);
  }
};

// DELETE /api/saved — body { id } quita.
export const onRequestDelete = async ({ request, env }: Ctx): Promise<Response> => {
  const body = await readJson<{ id?: string }>(request);
  const id = body?.id?.trim();
  if (!isValidId(id)) return error("Falta un 'id' válido a quitar", 400);
  try {
    await env.DB.prepare("DELETE FROM saved WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (err) {
    return error(`No se pudo quitar: ${(err as Error).message}`, 500);
  }
};
