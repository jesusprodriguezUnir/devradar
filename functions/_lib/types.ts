// Tipos mínimos para las Pages Functions (evita depender de @cloudflare/workers-types).

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB: D1Database;
  WRITE_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

// Firma equivalente a PagesFunction<Env> de Cloudflare.
export type PagesFunction = (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}) => Response | Promise<Response>;

// Forma de un repo manual servido por la API (alineado con Resource del frontend).
export interface ManualRepo {
  id: string;
  type: string;
  name: string | null;
  owner: string | null;
  url: string;
  description: string | null;
  summary_es: string | null;
  category: string | null;
  tags: string[];
  language: string | null;
  stars: number | null;
  license: string | null;
  lastCommit: string | null;
  addedAt: string;
}
