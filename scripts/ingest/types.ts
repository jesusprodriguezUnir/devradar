export type ResourceType = "repo" | "website" | "skill";

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  owner: string | null;
  url: string;
  description: string;
  summary_es: string;
  category: string;
  tags: string[];
  language: string | null;
  stars: number | null;
  starsDelta: number;
  lastCommit: string | null; // ISO
  license: string | null;
  source: "search" | "seed";
  relevanceScore: number;
  featured: boolean;
  claudeCompatible: boolean;
  stale: boolean;
  addedAt: string; // ISO
  updatedAt: string; // ISO
}

export interface Category {
  slug: string;
  label: string;
  icon: string;
  order: number;
}

export interface QueryDef {
  id: string;
  type: ResourceType;
  q: string;
  defaultCategory: string;
  weight: number;
}

export interface IngestConfig {
  defaults: { minStars: number; perQuery: number; pushedSinceDays: number };
  queries: QueryDef[];
}

// Forma cruda relevante de la GitHub Search API.
export interface GithubRepo {
  id: number;
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
