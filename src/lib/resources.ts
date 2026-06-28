import { z } from "zod";
import rawData from "../../data/resources.json";
import { CATEGORIES, CATEGORY_BY_SLUG } from "./categories.ts";

// Validacion en build: si la ingesta produce datos invalidos, el build falla.
const ResourceSchema = z.object({
  id: z.string(),
  type: z.enum(["repo", "website", "skill"]),
  name: z.string(),
  owner: z.string().nullable(),
  url: z.string().url(),
  description: z.string(),
  summary_es: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  language: z.string().nullable(),
  stars: z.number().nullable(),
  starsDelta: z.number(),
  lastCommit: z.string().nullable(),
  license: z.string().nullable(),
  source: z.enum(["search", "seed"]),
  relevanceScore: z.number(),
  featured: z.boolean(),
  claudeCompatible: z.boolean(),
  stale: z.boolean(),
  addedAt: z.string(),
  updatedAt: z.string(),
});

const DatasetSchema = z.object({
  generatedAt: z.string(),
  count: z.number(),
  resources: z.array(ResourceSchema),
});

const dataset = DatasetSchema.parse(rawData);
export type Resource = z.infer<typeof ResourceSchema>;

export const generatedAt = dataset.generatedAt;
export const allResources: Resource[] = dataset.resources;

const SEVEN_DAYS = 7 * 86_400_000;

export const featured = allResources.filter((r) => r.featured);

export const newThisWeek = allResources.filter(
  (r) => Date.now() - new Date(r.addedAt).getTime() < SEVEN_DAYS
);

export function byCategory(slug: string): Resource[] {
  return allResources.filter((r) => r.category === slug);
}

export function byType(type: Resource["type"]): Resource[] {
  return allResources.filter((r) => r.type === type);
}

export function categoriesWithCounts() {
  return CATEGORIES.map((c) => ({
    ...c,
    items: byCategory(c.slug),
  })).filter((c) => c.items.length > 0);
}

export function languages(): string[] {
  return [...new Set(allResources.map((r) => r.language).filter(Boolean) as string[])].sort();
}

export function categoryLabel(slug: string): string {
  return CATEGORY_BY_SLUG.get(slug)?.label ?? slug;
}

export function formatStars(n: number | null): string {
  if (n === null) return "";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
