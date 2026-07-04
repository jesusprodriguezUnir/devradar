// Validadores para las Pages Functions. Espejo mínimo de la taxonomía de
// scripts/ingest/categories.ts (functions/ es una unidad de despliegue aparte).

export const CATEGORY_SLUGS = new Set([
  "dotnet-backend",
  "angular-frontend",
  "architecture-patterns",
  "claude-ai",
  "devops-tooling",
  "learning-reference",
]);

/** Normaliza una categoría de entrada: devuelve el slug si es válido, o null. */
export function validCategory(input: string | null | undefined): string | null {
  const c = input?.trim();
  return c && CATEGORY_SLUGS.has(c) ? c : null;
}

// Un id de recurso es "<tipo>:<algo>" acotado en longitud. Frena ids vacíos,
// enormes o con formato basura antes de que lleguen a D1.
const ID_RE = /^(repo|skill|website):.{1,200}$/;

export function isValidId(id: string | null | undefined): id is string {
  return typeof id === "string" && ID_RE.test(id);
}
