// Espejo de la taxonomia del pipeline de ingesta (scripts/ingest/categories.ts).
export interface Category {
  slug: string;
  label: string;
  icon: string;
  order: number;
}

export const CATEGORIES: Category[] = [
  { slug: "dotnet-backend", label: ".NET / Backend", icon: "🟣", order: 1 },
  { slug: "angular-frontend", label: "Angular / Frontend", icon: "🔴", order: 2 },
  { slug: "architecture-patterns", label: "Arquitectura & Patrones", icon: "🏛️", order: 3 },
  { slug: "claude-ai", label: "Claude & Agentes IA", icon: "🤖", order: 4 },
  { slug: "devops-tooling", label: "DevOps & Tooling", icon: "⚙️", order: 5 },
  { slug: "learning-reference", label: "Aprendizaje & Referencia", icon: "📚", order: 6 },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export const TYPE_LABELS: Record<string, string> = {
  repo: "Repositorio",
  website: "Web",
  skill: "Skill",
};
