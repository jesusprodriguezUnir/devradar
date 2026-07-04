import type { Env } from "./types.ts";

/**
 * Valida `Authorization: Bearer <token>` contra `env.WRITE_TOKEN`.
 * Devuelve true si el token coincide. Si no hay WRITE_TOKEN configurado,
 * las escrituras quedan bloqueadas (false) por seguridad.
 *
 * Compara los SHA-256 (siempre 32 bytes) de ambos valores, así el chequeo de
 * longitud no filtra la longitud del token por timing.
 */
export async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const expected = env.WRITE_TOKEN?.trim();
  if (!expected) return false;

  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1].trim();
  const [a, b] = await Promise.all([sha256(token), sha256(expected)]);
  return timingSafeEqual(a, b);
}

async function sha256(s: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return new Uint8Array(digest);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false; // los digests siempre miden 32 bytes
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
