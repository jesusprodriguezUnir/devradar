-- Esquema D1 de DevRadar: capa dinámica sobre el catálogo estático (data/resources.json).
-- Aplicar una vez:  npx wrangler d1 execute devradar --file=schema.sql

-- Repos añadidos a mano por el usuario (sobreviven a la ingesta).
CREATE TABLE IF NOT EXISTS manual_repos (
  id          TEXT PRIMARY KEY,            -- "repo:owner/name"
  type        TEXT NOT NULL DEFAULT 'repo',
  name        TEXT,
  owner       TEXT,
  url         TEXT NOT NULL,
  description TEXT,
  summary_es  TEXT,
  category    TEXT,
  tags        TEXT,                         -- JSON array serializado
  language    TEXT,
  stars       INTEGER,
  license     TEXT,
  last_commit TEXT,                         -- ISO
  added_at    TEXT NOT NULL                 -- ISO
);

-- IDs ocultados (para "eliminar" filas del catálogo estático sin borrar la fuente).
CREATE TABLE IF NOT EXISTS removed_ids (
  id         TEXT PRIMARY KEY,
  removed_at TEXT NOT NULL
);

-- IDs guardados (espeja/sincroniza el localStorage del cliente).
CREATE TABLE IF NOT EXISTS saved (
  id       TEXT PRIMARY KEY,
  saved_at TEXT NOT NULL
);
