import type { Env } from "../_lib/types.ts";
import { json, error } from "../_lib/http.ts";
import { listManualRepos, listIds } from "../_lib/db.ts";

const MAX_PUBLIC_IDS = 5000;

// GET /api/state → { manualRepos, removedIds, saved } (lectura pública).
export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const { env } = context;
  try {
    const [manualRepos, removedIds, saved] = await Promise.all([
      listManualRepos(env),
      listIds(env, "removed_ids", MAX_PUBLIC_IDS),
      listIds(env, "saved", MAX_PUBLIC_IDS),
    ]);
    return json({ manualRepos, removedIds, saved });
  } catch (err) {
    return error(`No se pudo leer el estado: ${(err as Error).message}`, 500);
  }
};
