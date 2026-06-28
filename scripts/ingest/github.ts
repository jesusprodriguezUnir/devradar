import type { GithubRepo } from "./types.ts";

const API = "https://api.github.com";
const UA = "devradar-ingest";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": UA,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Llamada con backoff exponencial y respeto del rate limit de la Search API.
 * Reintenta ante 403/429 (rate limit) y 5xx.
 */
async function ghFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: headers() });
  if (res.ok) return res;

  const retriable = res.status === 403 || res.status === 429 || res.status >= 500;
  if (retriable && attempt < 4) {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    let wait = 2000 * 2 ** attempt;
    if (remaining === 0 && reset) wait = Math.max(wait, reset - Date.now() + 1000);
    console.warn(`  GitHub ${res.status} -> retry en ${Math.round(wait / 1000)}s (intento ${attempt + 1})`);
    await sleep(Math.min(wait, 60_000));
    return ghFetch(url, attempt + 1);
  }
  throw new Error(`GitHub ${res.status} ${res.statusText} en ${url}`);
}

/** Busca repos con la Search API. Devuelve hasta `perPage` ordenados por estrellas. */
export async function searchRepos(q: string, perPage = 15): Promise<GithubRepo[]> {
  const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}`;
  const res = await ghFetch(url);
  const json = (await res.json()) as { items: GithubRepo[] };
  // throttle suave: la Search API permite ~30 req/min autenticada, ~10 sin token.
  await sleep(process.env.GITHUB_TOKEN ? 2200 : 6500);
  return json.items ?? [];
}

/** Obtiene un repo concreto (para enriquecer skills del seed por owner/name). */
export async function getRepo(fullName: string): Promise<GithubRepo | null> {
  try {
    const res = await ghFetch(`${API}/repos/${fullName}`);
    const repo = (await res.json()) as GithubRepo;
    await sleep(400);
    return repo;
  } catch (err) {
    console.warn(`  No se pudo enriquecer ${fullName}: ${(err as Error).message}`);
    return null;
  }
}
