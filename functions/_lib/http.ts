// Helpers HTTP comunes para las Pages Functions.

export interface ReadJsonOptions {
  maxBytes?: number;
  requireObject?: boolean;
}

export type ReadJsonResult<T> =
  | { ok: true; data: T | null }
  | { ok: false; status: number; message: string };

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

/** Lee y parsea el body JSON con validaciones básicas de tamaño y forma. */
export async function readJson<T = Record<string, unknown>>(
  request: Request,
  options: ReadJsonOptions = {}
): Promise<ReadJsonResult<T>> {
  const maxBytes = options.maxBytes ?? 4096;
  const requireObject = options.requireObject ?? true;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `Body demasiado grande (máximo ${maxBytes} bytes)` ,
    };
  }

  try {
    const raw = await request.text();
    if (!raw.trim()) return { ok: true, data: null };
    if (raw.length > maxBytes) {
      return {
        ok: false,
        status: 413,
        message: `Body demasiado grande (máximo ${maxBytes} bytes)`,
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (requireObject && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) {
      return {
        ok: false,
        status: 400,
        message: "Body JSON inválido: se esperaba un objeto",
      };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Body JSON inválido",
    };
  }
}
