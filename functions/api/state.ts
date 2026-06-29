import type { Env } from "../_lib/types.ts";
import { json, error } from "../_lib/http.ts";
import { listManualRepos, listIds } from "../_lib/db.ts";

// GET /api/state → { manualRepos, removedIds, saved } (lectura pública).
export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const { env } = context;
  try {
    const [manualRepos, removedIds, saved] = await Promise.all([
      listManualRepos(env),
      listIds(env, "removed_ids"),
      listIds(env, "saved"),
    ]);
    return json({ manualRepos, removedIds, saved });
  } catch (err) {
    return error(`No se pudo leer el estado: ${(err as Error).message}`, 500);
  }
};
