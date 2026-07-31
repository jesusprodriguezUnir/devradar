import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "../ingest/categories.ts";

type ResourceType = "repo" | "website" | "skill";

interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  owner: string | null;
  url: string;
  summary_es: string;
  category: string;
  tags: string[];
  stale: boolean;
  stars: number | null;
  addedAt: string;
  updatedAt: string;
}

interface Dataset {
  generatedAt: string;
  count: number;
  resources: Resource[];
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const datasetPath = resolve(__dirname, "../../data/resources.json");
const validCategories = new Set(CATEGORIES.map((category) => category.slug));

function isIsoDate(value: string): boolean {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function normalizeRepoName(id: string): string {
  const parts = id.split(":");
  return parts.length === 2 ? parts[1].toLowerCase() : "";
}

async function main() {
  const raw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(raw) as Dataset;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(dataset.resources)) {
    errors.push("resources no es un array");
  }

  if (dataset.count !== dataset.resources.length) {
    errors.push(`count (${dataset.count}) no coincide con resources.length (${dataset.resources.length})`);
  }

  if (!isIsoDate(dataset.generatedAt)) {
    errors.push("generatedAt no tiene formato de fecha valido");
  }

  const ids = new Set<string>();
  const byRepoName = new Map<string, string[]>();
  const byUrl = new Map<string, string[]>();

  let staleCount = 0;
  for (const resource of dataset.resources) {
    if (ids.has(resource.id)) {
      errors.push(`id duplicado: ${resource.id}`);
    }
    ids.add(resource.id);

    if (!resource.id || !resource.name || !resource.url) {
      errors.push(`recurso incompleto: ${resource.id || "<sin-id>"}`);
    }

    if (!["repo", "website", "skill"].includes(resource.type)) {
      errors.push(`type invalido en ${resource.id}: ${String(resource.type)}`);
    }

    if (!validCategories.has(resource.category)) {
      errors.push(`categoria invalida en ${resource.id}: ${resource.category}`);
    }

    if (!Array.isArray(resource.tags)) {
      errors.push(`tags invalido en ${resource.id}: no es array`);
    }

    if (!isIsoDate(resource.addedAt) || !isIsoDate(resource.updatedAt)) {
      errors.push(`fechas invalidas en ${resource.id}`);
    }

    try {
      new URL(resource.url);
    } catch {
      errors.push(`url invalida en ${resource.id}: ${resource.url}`);
    }

    if (resource.stale) staleCount += 1;

    const repoName = normalizeRepoName(resource.id);
    if (repoName) {
      byRepoName.set(repoName, [...(byRepoName.get(repoName) ?? []), resource.id]);
    }

    const urlKey = resource.url.toLowerCase();
    byUrl.set(urlKey, [...(byUrl.get(urlKey) ?? []), resource.id]);
  }

  for (const [repoName, idsForRepo] of byRepoName.entries()) {
    if (idsForRepo.length > 1) {
      warnings.push(`repo repetido por nombre (${repoName}) en ids: ${idsForRepo.join(", ")}`);
    }
  }

  for (const [url, idsForUrl] of byUrl.entries()) {
    if (idsForUrl.length > 1) {
      warnings.push(`url repetida (${url}) en ids: ${idsForUrl.join(", ")}`);
    }
  }

  const staleRatio = dataset.resources.length === 0 ? 0 : staleCount / dataset.resources.length;
  if (staleRatio > 0.2) {
    warnings.push(`alto porcentaje stale: ${(staleRatio * 100).toFixed(1)}%`);
  }

  if (warnings.length > 0) {
    console.warn("\n[audit:data] WARNINGS");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (errors.length > 0) {
    console.error("\n[audit:data] ERRORS");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("[audit:data] OK - dataset consistente.");
  console.log(`[audit:data] Recursos: ${dataset.resources.length} | stale: ${staleCount}`);
}

main().catch((err) => {
  console.error(`[audit:data] ERROR: ${(err as Error).message}`);
  process.exit(1);
});
