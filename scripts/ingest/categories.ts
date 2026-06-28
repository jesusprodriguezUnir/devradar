import type { Category } from "./types.ts";

// Taxonomia de categorias. El `order` controla el orden en el dashboard.
export const CATEGORIES: Category[] = [
  { slug: "dotnet-backend", label: ".NET / Backend", icon: "🟣", order: 1 },
  { slug: "angular-frontend", label: "Angular / Frontend", icon: "🔴", order: 2 },
  { slug: "architecture-patterns", label: "Arquitectura & Patrones", icon: "🏛️", order: 3 },
  { slug: "claude-ai", label: "Claude & Agentes IA", icon: "🤖", order: 4 },
  { slug: "devops-tooling", label: "DevOps & Tooling", icon: "⚙️", order: 5 },
  { slug: "learning-reference", label: "Aprendizaje & Referencia", icon: "📚", order: 6 },
];

export const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));
export const DEFAULT_CATEGORY = "learning-reference";

// Reglas deterministas: topic/keyword -> categoria. Primer match gana.
// El orden importa: lo mas especifico primero.
const RULES: Array<{ category: string; match: string[] }> = [
  {
    category: "claude-ai",
    match: [
      "claude", "claude-code", "claude-code-plugin", "agent-skills", "agent-skill",
      "mcp", "model-context-protocol", "anthropic", "llm", "ai-agent", "ai-agents",
      "prompt-engineering", "rag",
    ],
  },
  {
    category: "angular-frontend",
    match: ["angular", "ngrx", "rxjs", "angular-cli", "primeng", "angular-material", "signals"],
  },
  {
    category: "dotnet-backend",
    match: [
      "dotnet", "aspnetcore", "asp-net-core", "csharp", "entity-framework", "entity-framework-core",
      "efcore", "blazor", "maui", "nuget", "wpf", "minimal-api",
    ],
  },
  {
    category: "architecture-patterns",
    match: [
      "clean-architecture", "domain-driven-design", "ddd", "hexagonal-architecture",
      "cqrs", "event-sourcing", "microservices", "system-design", "design-patterns",
      "software-architecture",
    ],
  },
  {
    category: "devops-tooling",
    match: ["docker", "kubernetes", "ci-cd", "github-actions", "terraform", "observability", "devops"],
  },
];

/**
 * Categorizacion determinista. Devuelve la categoria si hay match claro,
 * o null si es ambiguo (candidato para Claude / categoria por defecto de la query).
 */
export function categorizeByRules(signals: string[]): string | null {
  const haystack = signals.map((s) => s.toLowerCase());
  for (const rule of RULES) {
    if (rule.match.some((kw) => haystack.includes(kw) || haystack.some((h) => h.includes(kw)))) {
      return rule.category;
    }
  }
  return null;
}
