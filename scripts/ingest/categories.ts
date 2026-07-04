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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * ¿La keyword aparece en las señales como *palabra/topic completo*, no como substring?
 * - keyword con guion (topic tipo "clean-architecture"): match exacto de topic o frase
 *   con límites de palabra en texto libre.
 * - keyword de un token ("dotnet", "rag"): debe ser un token completo de alguna señal.
 * Esto evita falsos positivos como "rag" ⊂ "storage" o "ddd" ⊂ "adddress".
 */
function keywordMatches(kw: string, signals: string[], tokenSets: Set<string>[]): boolean {
  if (kw.includes("-")) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}([^a-z0-9]|$)`, "i");
    return signals.some((s) => s === kw || re.test(s));
  }
  return tokenSets.some((set) => set.has(kw));
}

/**
 * Categorizacion determinista por *scoring*: cuenta cuántas keywords de cada regla
 * matchean (como palabra completa) y elige la categoría con más aciertos. Empates a
 * favor del orden de RULES (más específico primero). Devuelve null si nadie matchea
 * (candidato para Claude / categoria por defecto de la query).
 */
export function categorizeByRules(signals: string[]): string | null {
  const norm = signals.map((s) => (s ?? "").toLowerCase());
  const tokenSets = norm.map((s) => new Set(s.split(/[^a-z0-9]+/).filter(Boolean)));

  let best: string | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = rule.match.filter((kw) => keywordMatches(kw, norm, tokenSets)).length;
    // `>` (no `>=`) => en empate gana la regla anterior (orden = prioridad).
    if (score > bestScore) {
      bestScore = score;
      best = rule.category;
    }
  }
  return best;
}
