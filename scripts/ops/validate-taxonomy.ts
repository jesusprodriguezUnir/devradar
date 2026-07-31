import { CATEGORIES as ingestCategories, DEFAULT_CATEGORY } from "../ingest/categories.ts";
import { CATEGORIES as siteCategories } from "../../src/lib/categories.ts";
import { CATEGORY_SLUGS as functionCategorySlugs } from "../../functions/_lib/validate.ts";

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function fail(message: string): never {
  console.error(`\n[validate:taxonomy] ERROR: ${message}`);
  process.exit(1);
}

const ingestSlugsByOrder = ingestCategories.map((category) => category.slug);
const siteSlugsByOrder = siteCategories.map((category) => category.slug);
const functionSlugs = sortStrings([...functionCategorySlugs]);
const ingestSlugsSorted = sortStrings([...new Set(ingestSlugsByOrder)]);

if (!sameStringArray(ingestSlugsByOrder, siteSlugsByOrder)) {
  fail([
    "La taxonomia entre ingest y frontend no coincide en orden/slug.",
    `ingest: ${ingestSlugsByOrder.join(", ")}`,
    `site:   ${siteSlugsByOrder.join(", ")}`,
  ].join("\n"));
}

if (!sameStringArray(ingestSlugsSorted, functionSlugs)) {
  fail([
    "La taxonomia entre ingest y functions no coincide.",
    `ingest:    ${ingestSlugsSorted.join(", ")}`,
    `functions: ${functionSlugs.join(", ")}`,
  ].join("\n"));
}

if (!ingestSlugsSorted.includes(DEFAULT_CATEGORY)) {
  fail(`DEFAULT_CATEGORY (${DEFAULT_CATEGORY}) no existe en la taxonomia de ingest.`);
}

console.log("[validate:taxonomy] OK - taxonomia sincronizada entre ingest, frontend y functions.");
