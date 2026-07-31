import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES } from "../ingest/categories.ts";

interface Resource {
  id: string;
}

interface Dataset {
  resources: Resource[];
}

interface ManualRepo {
  id: string;
  url: string;
  category: string | null;
}

interface DynamicState {
  manualRepos: ManualRepo[];
  removedIds: string[];
  saved: string[];
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../..");
const DATASET_PATH = resolve(ROOT, "data/resources.json");
const CLEANUP_SQL_PATH = resolve(ROOT, "scripts/ops/out/cleanup-d1.sql");

const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));
const ID_RE = /^(repo|skill|website):.{1,200}$/;

function readArg(name: string): string | null {
  const match = process.argv.slice(2).find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function buildDeleteSql(table: "saved" | "removed_ids", ids: string[]): string {
  if (ids.length === 0) return "";
  const inClause = ids.map(sqlString).join(", ");
  return `DELETE FROM ${table} WHERE id IN (${inClause});`;
}

async function loadState(): Promise<DynamicState> {
  const stateFile = readArg("--state-file");
  const stateUrl =
    readArg("--state-url") ?? process.env.DEVRADAR_STATE_URL ?? "http://localhost:4321/api/state";

  if (stateFile) {
    const raw = await readFile(resolve(ROOT, stateFile), "utf8");
    try {
      return JSON.parse(raw) as DynamicState;
    } catch {
      throw new Error(`El archivo de estado no contiene JSON válido: ${stateFile}`);
    }
  }

  const res = await fetch(stateUrl);
  if (!res.ok) throw new Error(`No se pudo leer ${stateUrl} (${res.status})`);
  const raw = await res.text();
  try {
    return JSON.parse(raw) as DynamicState;
  } catch {
    const preview = raw.slice(0, 140).replace(/\s+/g, " ");
    throw new Error(
      `La URL respondió contenido no JSON (posible ruta incorrecta o Functions no desplegadas): ${stateUrl} :: ${preview}`
    );
  }
}

async function main() {
  const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8")) as Dataset;
  const state = await loadState();

  const staticIds = new Set(dataset.resources.map((r) => r.id));
  const manualIds = new Set((state.manualRepos ?? []).map((r) => r.id));

  const errors: string[] = [];
  const warnings: string[] = [];

  const invalidManualIds = (state.manualRepos ?? [])
    .filter((r) => !ID_RE.test(r.id))
    .map((r) => r.id);

  const invalidManualCategories = (state.manualRepos ?? [])
    .filter((r) => r.category !== null && !CATEGORY_SLUGS.has(r.category))
    .map((r) => `${r.id}:${r.category}`);

  const duplicateManualUrls = new Map<string, string[]>();
  for (const repo of state.manualRepos ?? []) {
    const key = (repo.url ?? "").toLowerCase();
    duplicateManualUrls.set(key, [...(duplicateManualUrls.get(key) ?? []), repo.id]);
  }
  for (const [url, ids] of duplicateManualUrls.entries()) {
    if (url && ids.length > 1) warnings.push(`manual_repos con URL repetida (${url}): ${ids.join(", ")}`);
  }

  const invalidRemoved = unique((state.removedIds ?? []).filter((id) => !ID_RE.test(id)));
  const invalidSaved = unique((state.saved ?? []).filter((id) => !ID_RE.test(id)));

  const orphanRemoved = unique(
    (state.removedIds ?? []).filter((id) => ID_RE.test(id) && !staticIds.has(id) && !manualIds.has(id))
  );
  const orphanSaved = unique(
    (state.saved ?? []).filter((id) => ID_RE.test(id) && !staticIds.has(id) && !manualIds.has(id))
  );

  if (invalidManualIds.length > 0) {
    errors.push(`manual_repos con id inválido: ${invalidManualIds.join(", ")}`);
  }
  if (invalidManualCategories.length > 0) {
    errors.push(`manual_repos con categoría inválida: ${invalidManualCategories.join(", ")}`);
  }

  if (invalidRemoved.length > 0) {
    warnings.push(`removed_ids inválidos: ${invalidRemoved.join(", ")}`);
  }
  if (invalidSaved.length > 0) {
    warnings.push(`saved inválidos: ${invalidSaved.join(", ")}`);
  }
  if (orphanRemoved.length > 0) {
    warnings.push(`removed_ids huérfanos: ${orphanRemoved.join(", ")}`);
  }
  if (orphanSaved.length > 0) {
    warnings.push(`saved huérfanos: ${orphanSaved.join(", ")}`);
  }

  const cleanupRemoved = unique([...invalidRemoved, ...orphanRemoved]);
  const cleanupSaved = unique([...invalidSaved, ...orphanSaved]);

  if (hasFlag("--write-cleanup") && (cleanupRemoved.length > 0 || cleanupSaved.length > 0)) {
    await mkdir(resolve(ROOT, "scripts/ops/out"), { recursive: true });
    const sql = [
      "-- SQL generado por scripts/ops/audit-dynamic-state.ts",
      "BEGIN TRANSACTION;",
      buildDeleteSql("removed_ids", cleanupRemoved),
      buildDeleteSql("saved", cleanupSaved),
      "COMMIT;",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    await writeFile(CLEANUP_SQL_PATH, sql);
    console.log(`[audit:dynamic] SQL de limpieza generado en ${CLEANUP_SQL_PATH}`);
  }

  console.log("[audit:dynamic] Resumen");
  console.log(`- manual_repos: ${(state.manualRepos ?? []).length}`);
  console.log(`- removed_ids: ${(state.removedIds ?? []).length}`);
  console.log(`- saved: ${(state.saved ?? []).length}`);

  if (warnings.length > 0) {
    console.warn("\n[audit:dynamic] WARNINGS");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (errors.length > 0) {
    console.error("\n[audit:dynamic] ERRORS");
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log("\n[audit:dynamic] OK - sin errores bloqueantes.");
}

main().catch((err) => {
  console.error(`[audit:dynamic] ERROR: ${(err as Error).message}`);
  process.exit(1);
});
