import type { Env, ManualRepo } from "./types.ts";

const API = "https://api.github.com";
const UA = "devradar-functions";

// Forma cruda relevante de la GitHub API (espejo de scripts/ingest/types.ts).
interface GithubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  license: { spdx_id: string | null } | null;
}

/** Extrae "owner/name" de una URL de GitHub o de un texto ya en ese formato. */
export function parseRepoRef(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  // URL completa (https://github.com/owner/name[/...]).
  const url = raw.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (url) return `${url[1]}/${stripGit(url[2])}`;
  // Forma "owner/name".
  const slug = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slug) return `${slug[1]}/${stripGit(slug[2])}`;
  return null;
}

const stripGit = (s: string) => s.replace(/\.git$/i, "");

function headers(env: Env): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": UA,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = env.GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Resuelve los metadatos de un repo "owner/name" vía la GitHub API y los
 * normaliza a la forma ManualRepo (mismo patrón que scripts/ingest/github.ts).
 * Lanza Error con mensaje legible si el repo no existe o la API falla.
 */
export async function resolveRepo(
  fullName: string,
  category: string | null,
  env: Env
): Promise<ManualRepo> {
  const res = await fetch(`${API}/repos/${fullName}`, { headers: headers(env) });
  if (res.status === 404) throw new Error(`Repo no encontrado: ${fullName}`);
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText}`);

  const repo = (await res.json()) as GithubRepo;
  return {
    id: `repo:${repo.full_name}`,
    type: "repo",
    name: repo.name,
    owner: repo.owner?.login ?? null,
    url: repo.html_url,
    description: repo.description,
    summary_es: repo.description, // sin Claude aquí: usamos la descripción tal cual
    category,
    tags: repo.topics ?? [],
    language: repo.language,
    stars: repo.stargazers_count ?? null,
    license: repo.license?.spdx_id ?? null,
    lastCommit: repo.pushed_at ?? null,
    addedAt: new Date().toISOString(),
  };
}
