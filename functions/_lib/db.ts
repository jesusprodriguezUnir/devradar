import type { Env, ManualRepo } from "./types.ts";

// Fila tal cual está en la tabla manual_repos.
interface ManualRepoRow {
  id: string;
  type: string;
  name: string | null;
  owner: string | null;
  url: string;
  description: string | null;
  summary_es: string | null;
  category: string | null;
  tags: string | null;
  language: string | null;
  stars: number | null;
  license: string | null;
  last_commit: string | null;
  added_at: string;
}

/** Convierte una fila de D1 en un ManualRepo (deserializa tags). */
export function rowToRepo(row: ManualRepoRow): ManualRepo {
  let tags: string[] = [];
  try {
    tags = row.tags ? JSON.parse(row.tags) : [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    owner: row.owner,
    url: row.url,
    description: row.description,
    summary_es: row.summary_es,
    category: row.category,
    tags,
    language: row.language,
    stars: row.stars,
    license: row.license,
    lastCommit: row.last_commit,
    addedAt: row.added_at,
  };
}

export async function listManualRepos(env: Env): Promise<ManualRepo[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM manual_repos ORDER BY added_at DESC"
  ).all<ManualRepoRow>();
  return results.map(rowToRepo);
}

export async function listIds(
  env: Env,
  table: "removed_ids" | "saved",
  limit = 5000
): Promise<string[]> {
  const query =
    table === "saved"
      ? "SELECT id FROM saved ORDER BY saved_at DESC LIMIT ?"
      : "SELECT id FROM removed_ids ORDER BY removed_at DESC LIMIT ?";
  const { results } = await env.DB.prepare(query).bind(limit).all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function insertManualRepo(env: Env, repo: ManualRepo): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO manual_repos
       (id, type, name, owner, url, description, summary_es, category, tags,
        language, stars, license, last_commit, added_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      repo.id,
      repo.type,
      repo.name,
      repo.owner,
      repo.url,
      repo.description,
      repo.summary_es,
      repo.category,
      JSON.stringify(repo.tags ?? []),
      repo.language,
      repo.stars,
      repo.license,
      repo.lastCommit,
      repo.addedAt
    )
    .run();
}

export async function isManualRepo(env: Env, id: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT id FROM manual_repos WHERE id = ?").bind(id).first();
  return row !== null;
}
