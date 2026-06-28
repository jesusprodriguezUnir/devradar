import { CATEGORIES, CATEGORY_SLUGS } from "./categories.ts";

export interface ClaudeResult {
  category: string;
  tags: string[];
  summary_es: string;
}

const ENDPOINT = "https://api.anthropic.com/v1/messages";

/** ¿Está Claude disponible? (hay API key). Si no, el pipeline usa solo reglas. */
export function claudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const CATALOG = CATEGORIES.map((c) => `${c.slug} (${c.label})`).join(", ");

/**
 * Clasifica y resume un recurso ambiguo. Salida JSON estricta.
 * Solo se llama para recursos sin match de reglas y sin cache.
 */
export async function classifyWithClaude(input: {
  name: string;
  description: string;
  topics: string[];
  language: string | null;
}): Promise<ClaudeResult | null> {
  const model = process.env.CLAUDE_MODEL?.trim() || "claude-haiku-4-5-20251001";
  const prompt = `Eres un asistente que clasifica repositorios de software para un panel de un arquitecto .NET/Angular.
Categorias validas (usa el slug exacto): ${CATALOG}.

Recurso:
- Nombre: ${input.name}
- Descripcion: ${input.description || "(sin descripcion)"}
- Topics: ${input.topics.join(", ") || "(ninguno)"}
- Lenguaje: ${input.language ?? "(desconocido)"}

Devuelve SOLO un objeto JSON valido, sin texto adicional, con esta forma exacta:
{"category":"<slug>","tags":["..","..",".."],"summary_es":"<una frase en espanol explicando por que es util>"}`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`  Claude ${res.status}: omito clasificacion semantica de "${input.name}"`);
      return null;
    }

    const json = (await res.json()) as { content: Array<{ text?: string }> };
    const text = json.content?.map((b) => b.text ?? "").join("").trim() ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as ClaudeResult;
    if (!CATEGORY_SLUGS.has(parsed.category)) return null;
    return {
      category: parsed.category,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
      summary_es: String(parsed.summary_es ?? "").slice(0, 240),
    };
  } catch (err) {
    console.warn(`  Error llamando a Claude para "${input.name}": ${(err as Error).message}`);
    return null;
  }
}
