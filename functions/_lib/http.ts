// Helpers HTTP comunes para las Pages Functions.

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export const error = (message: string, status = 400): Response =>
  json({ error: message }, status);

/** Lee y parsea el body JSON; devuelve null si está vacío o es inválido. */
export async function readJson<T = Record<string, unknown>>(
  request: Request
): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
