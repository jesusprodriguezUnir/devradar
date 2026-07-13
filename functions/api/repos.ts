import type { Env } from "../_lib/types.ts";
import { json, error, readJson } from "../_lib/http.ts";
import { isAuthorized } from "../_lib/auth.ts";
import { parseRepoRef, resolveRepo } from "../_lib/github.ts";
import { insertManualRepo, isManualRepo } from "../_lib/db.ts";
import { validCategory, isValidId } from "../_lib/validate.ts";

type Ctx = { request: Request; env: Env };

// POST /api/repos (auth) — body { url | "owner/name", category? }
// Resuelve metadatos vía GitHub, inserta en manual_repos y lo des-oculta si estaba removido.
export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return error("No autorizado", 401);

  const body = await readJson<{ url?: string; category?: string }>(request);
  const ref = parseRepoRef(body?.url ?? "");
  if (!ref) return error("Falta una URL o 'owner/name' de GitHub válida", 400);

  try {
    // Categoría inválida o vacía => null (no persistimos slugs arbitrarios).
    const repo = await resolveRepo(ref, validCategory(body?.category), env);
    await insertManualRepo(env, repo);
    // Si estaba oculto, lo reactivamos.
    await env.DB.prepare("DELETE FROM removed_ids WHERE id = ?").bind(repo.id).run();
    return json({ ok: true, repo }, 201);
  } catch (err) {
    return error((err as Error).message, 502);
  }
};

// DELETE /api/repos (auth) — body { id }
// Si es manual lo borra; si es del catálogo estático lo añade a removed_ids (ocultar).
export const onRequestDelete = async ({ request, env }: Ctx): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return error("No autorizado", 401);

  const body = await readJson<{ id?: string }>(request);
  const id = body?.id?.trim();
  if (!isValidId(id)) return error("Falta un 'id' válido a eliminar", 400);

  try {
    if (await isManualRepo(env, id)) {
      await env.DB.prepare("DELETE FROM manual_repos WHERE id = ?").bind(id).run();
      return json({ ok: true, mode: "deleted" });
    }
    await env.DB.prepare(
      "INSERT OR REPLACE INTO removed_ids (id, removed_at) VALUES (?, ?)"
    )
      .bind(id, new Date().toISOString())
      .run();
    return json({ ok: true, mode: "hidden" });
  } catch (err) {
    return error(`No se pudo eliminar: ${(err as Error).message}`, 500);
  }
};
