import type { Env } from "./types.ts";

/**
 * Valida `Authorization: Bearer <token>` contra `env.WRITE_TOKEN`.
 * Devuelve true si el token coincide. Si no hay WRITE_TOKEN configurado,
 * las escrituras quedan bloqueadas (false) por seguridad.
 */
export function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.WRITE_TOKEN?.trim();
  if (!expected) return false;

  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1].trim();
  // Comparación de tiempo constante para no filtrar el token por timing.
  return timingSafeEqual(token, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
