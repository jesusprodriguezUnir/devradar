import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Resource } from "./types.ts";

export interface Dataset {
  generatedAt: string;
  count: number;
  resources: Resource[];
}

/** Carga el dataset anterior (para preservar addedAt y fail-safe). */
export async function loadPrevious(path: string): Promise<Map<string, Resource>> {
  const map = new Map<string, Resource>();
  if (existsSync(path)) {
    try {
      const prev = JSON.parse(await readFile(path, "utf8")) as Dataset;
      for (const r of prev.resources) map.set(r.id, r);
    } catch {
      /* dataset corrupto: empezamos limpio */
    }
  }
  return map;
}

export async function writeDataset(path: string, resources: Resource[]): Promise<void> {
  // orden estable: relevancia desc, luego nombre
  resources.sort((a, b) => b.relevanceScore - a.relevanceScore || a.name.localeCompare(b.name));
  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    count: resources.length,
    resources,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(dataset, null, 2));
}
