import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type { GithubRepo, IngestConfig, Resource } from "./types.ts";
import { searchRepos, getRepo } from "./github.ts";
import { categorizeByRules } from "./categories.ts";
import { relevanceScore } from "./score.ts";
import { claudeEnabled, classifyWithClaude } from "./claude.ts";
import { ClassificationCache, StarHistory, contentHash } from "./cache.ts";
import { loadPrevious, writeDataset } from "./writer.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const P = {
  config: resolve(ROOT, "config/queries.yaml"),
  websites: resolve(ROOT, "seed/websites.yaml"),
  skills: resolve(ROOT, "seed/skills.yaml"),
  data: resolve(ROOT, "data/resources.json"),
  cache: resolve(ROOT, ".cache/classifications.json"),
  stars: resolve(ROOT, ".cache/star-history.json"),
};

const nowISO = () => new Date().toISOString();
const truncate = (s: string, n = 200) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function loadYaml<T>(path: string): Promise<T> {
  return parseYaml(await readFile(path, "utf8")) as T;
}

function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("▶ DevRadar ingest");
  const config = await loadYaml<IngestConfig>(P.config);
  const websitesSeed = (await loadYaml<{ websites: any[] }>(P.websites)).websites ?? [];
  const skillsSeed = (await loadYaml<{ skills: any[] }>(P.skills)).skills ?? [];

  const cache = new ClassificationCache(P.cache);
  const stars = new StarHistory(P.stars);
  await Promise.all([cache.load(), stars.load()]);
  const previous = await loadPrevious(P.data);

  const { minStars, perQuery, pushedSinceDays } = config.defaults;
  const since = sinceDate(pushedSinceDays);

  const byId = new Map<string, Resource>();
  let claudeCalls = 0;
  let collectError = false;

  // ---- 1. Repos / skills via GitHub Search ----
  for (const query of config.queries) {
    const q = query.q
      .replaceAll("{{minStars}}", String(minStars))
      .replaceAll("{{since}}", since);
    console.log(`  · query ${query.id}: ${q}`);

    let repos: GithubRepo[] = [];
    try {
      repos = await searchRepos(q, perQuery);
    } catch (err) {
      console.warn(`  ! fallo en query ${query.id}: ${(err as Error).message}`);
      collectError = true;
      continue;
    }

    for (const repo of repos) {
      const id = `${query.type}:${repo.full_name}`;
      if (byId.has(id)) continue;

      const topics = repo.topics ?? [];
      const signals = [...topics, repo.name, repo.language ?? "", repo.description ?? ""];
      let category = categorizeByRules(signals);
      const ruleMatched = category !== null;
      let tags = topics.slice(0, 6);
      let summary = repo.description ? truncate(repo.description) : "";

      // Fallback: Claude solo si ambiguo, con cache por content-hash.
      if (!category) {
        const hash = contentHash([repo.description, topics.join(","), repo.language]);
        const cached = cache.get(hash);
        if (cached) {
          category = cached.category;
          tags = cached.tags.length ? cached.tags : tags;
          summary = cached.summary_es || summary;
        } else if (claudeEnabled()) {
          const r = await classifyWithClaude({
            name: repo.full_name,
            description: repo.description ?? "",
            topics,
            language: repo.language,
          });
          claudeCalls++;
          if (r) {
            category = r.category;
            tags = r.tags.length ? r.tags : tags;
            summary = r.summary_es || summary;
            cache.set(hash, { ...r, cachedAt: nowISO() });
          }
        }
        category ??= query.defaultCategory;
      }

      if (!summary) summary = `Repositorio relevante en ${category}.`;

      const starsDelta = stars.delta(id, repo.stargazers_count);
      stars.record(id, repo.stargazers_count);

      const prev = previous.get(id);
      byId.set(id, {
        id,
        type: query.type,
        name: repo.full_name,
        owner: repo.owner.login,
        url: repo.html_url,
        description: repo.description ?? "",
        summary_es: summary,
        category,
        tags,
        language: repo.language,
        stars: repo.stargazers_count,
        starsDelta,
        lastCommit: repo.pushed_at,
        license: repo.license?.spdx_id ?? null,
        source: "search",
        relevanceScore: relevanceScore({
          stars: repo.stargazers_count,
          pushedAt: repo.pushed_at,
          starsDelta,
          queryWeight: query.weight,
          ruleMatched,
        }),
        featured: false,
        claudeCompatible: query.type === "skill",
        stale: false,
        addedAt: prev?.addedAt ?? nowISO(),
        updatedAt: nowISO(),
      });
    }
  }

  // ---- 2. Skills "ancla" del seed (se enriquecen con GitHub si tienen repo) ----
  for (const s of skillsSeed) {
    const id = `skill:${s.repo ?? s.name}`;
    let repo: GithubRepo | null = null;
    if (s.repo) repo = await getRepo(s.repo);

    const prev = previous.get(id);
    byId.set(id, {
      id,
      type: "skill",
      name: s.name,
      owner: repo?.owner.login ?? (s.repo ? s.repo.split("/")[0] : null),
      url: s.url ?? repo?.html_url ?? "",
      description: repo?.description ?? "",
      summary_es: s.summary_es ?? repo?.description ?? "",
      category: s.category ?? "claude-ai",
      tags: s.tags ?? repo?.topics ?? [],
      language: repo?.language ?? null,
      stars: repo?.stargazers_count ?? null,
      starsDelta: repo ? stars.delta(id, repo.stargazers_count) : 0,
      lastCommit: repo?.pushed_at ?? null,
      license: repo?.license?.spdx_id ?? null,
      source: "seed",
      relevanceScore: 999, // anclas siempre arriba en su categoria
      featured: Boolean(s.featured),
      claudeCompatible: s.claudeCompatible ?? true,
      stale: false,
      addedAt: prev?.addedAt ?? nowISO(),
      updatedAt: nowISO(),
    });
    if (repo) stars.record(id, repo.stargazers_count);
  }

  // ---- 3. Webs de referencia del seed ----
  for (const w of websitesSeed) {
    const id = `website:${w.url}`;
    const prev = previous.get(id);
    byId.set(id, {
      id,
      type: "website",
      name: w.name,
      owner: null,
      url: w.url,
      description: w.summary_es ?? "",
      summary_es: w.summary_es ?? "",
      category: w.category ?? "learning-reference",
      tags: w.tags ?? [],
      language: null,
      stars: null,
      starsDelta: 0,
      lastCommit: null,
      license: null,
      source: "seed",
      relevanceScore: 998,
      featured: Boolean(w.featured),
      claudeCompatible: w.category === "claude-ai",
      stale: false,
      addedAt: prev?.addedAt ?? nowISO(),
      updatedAt: nowISO(),
    });
  }

  // ---- 4. Fail-safe: si la búsqueda falló del todo, conserva repos previos como stale ----
  if (collectError) {
    for (const [id, prevRes] of previous) {
      if (!byId.has(id) && prevRes.source === "search") {
        byId.set(id, { ...prevRes, stale: true });
      }
    }
  }

  const resources = [...byId.values()];
  await writeDataset(P.data, resources);
  await Promise.all([cache.save(), stars.save()]);

  const repos = resources.filter((r) => r.type === "repo").length;
  const skills = resources.filter((r) => r.type === "skill").length;
  const webs = resources.filter((r) => r.type === "website").length;
  console.log(
    `✔ ${resources.length} recursos (repos ${repos}, skills ${skills}, webs ${webs}) · llamadas Claude: ${claudeCalls}`
  );
  if (collectError) console.log("  ⚠ hubo errores de búsqueda: dataset previo preservado (stale).");
}

main().catch((err) => {
  console.error("✖ Ingest falló:", err);
  process.exit(1);
});
