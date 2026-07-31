# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

DevRadar es un panel estático auto-actualizado que cura y categoriza repos de GitHub (.NET, Angular, arquitectura), webs de referencia y skills de Claude/agentes IA. El sitio se genera con Astro (SSG), se refresca por cron con GitHub Actions y se despliega en Cloudflare Pages. Encima del catálogo estático hay una capa dinámica servida por Pages Functions + D1 para añadir/ocultar/guardar recursos sin rebuild.

## Comandos

```bash
npm install
npm run ingest    # genera data/resources.json (pipeline TS con tsx)
npm run dev       # astro dev en http://localhost:4321
npm run build     # build de producción (valida data/ con Zod; falla si es inválido)
npm run preview   # sirve dist/
npm run check      # astro check (typecheck de .astro)
```

No hay suite de tests ni linter configurados. El "gate" de calidad es `npm run build`: valida `data/resources.json` contra el schema Zod de [src/lib/resources.ts](src/lib/resources.ts) y falla si la ingesta produjo datos inválidos.

Variables de entorno (copia `.env.example` a `.env`, ambas opcionales):
- `GITHUB_TOKEN` — sube el rate limit de la Search API (sin él funciona, más lento).
- `ANTHROPIC_API_KEY` — activa la categorización semántica con Claude (sin clave, solo reglas).

## Arquitectura

Dos mundos separados que comparten el modelo `Resource`:

**1. Pipeline de ingesta** (`scripts/ingest/`, Node vía tsx) → produce `data/resources.json`.
El orquestador es [scripts/ingest/index.ts](scripts/ingest/index.ts). Fusiona en un `Map<id, Resource>` (id = `"<type>:<full_name|url>"`):
- Repos/skills desde la GitHub Search API según [config/queries.yaml](config/queries.yaml).
- Skills "ancla" y webs curadas desde [seed/skills.yaml](seed/skills.yaml) y [seed/websites.yaml](seed/websites.yaml). **El seed es canónico**: reemplaza al repo equivalente que trajo la búsqueda y recibe `relevanceScore` fijo (998/999) para quedar siempre arriba.

Categorización en cascada (por coste): **reglas deterministas → caché por content-hash → Claude** solo para lo ambiguo, y como último recurso `query.defaultCategory`. La caché de clasificaciones y el histórico de estrellas viven en `.cache/` (versionados) — ver [scripts/ingest/cache.ts](scripts/ingest/cache.ts).

Fail-safe: si la Search API falla del todo, se conservan los recursos previos marcados `stale: true` en vez de vaciar el dataset.

**2. Sitio Astro** (`src/`) → SSG puro. [src/lib/resources.ts](src/lib/resources.ts) carga y valida el JSON; las páginas (`src/pages/`) generan HTML estático. La búsqueda y los filtros corren en el navegador (script inline en `index.astro`).

**3. Capa dinámica** (`functions/api/`, Pages Functions + D1). Tres tablas (ver [schema.sql](schema.sql)): `manual_repos` (añadidos a mano, sobreviven a la ingesta), `removed_ids` (ocultados), `saved` (guardados sincronizados). Al cargar, el cliente hace `GET /api/state` y sobre el HTML estático oculta `removed_ids`, inyecta `manual_repos` y fusiona `saved` — ver [src/lib/dynamicCard.ts](src/lib/dynamicCard.ts). Las escrituras (`POST/DELETE /api/repos`) requieren `Authorization: Bearer <WRITE_TOKEN>`; la UI guarda ese token en `localStorage` (`devradar:token`). Sin token, la interfaz es de solo lectura.

## Convenciones importantes

- **Taxonomía de categorías duplicada**: [scripts/ingest/categories.ts](scripts/ingest/categories.ts) (con reglas de matching, lado ingesta) y [src/lib/categories.ts](src/lib/categories.ts) (espejo para el sitio/cliente). El array `CATEGORIES` debe mantenerse idéntico en ambos; si cambias una categoría, actualiza los dos.
- **Imports con extensión `.ts` explícita** en todo el proyecto (`./github.ts`, `./categories.ts`) — requerido por la config de módulos.
- El modelo `Resource` está definido dos veces por la separación de mundos: como interface TS en [scripts/ingest/types.ts](scripts/ingest/types.ts) y como schema Zod en [src/lib/resources.ts](src/lib/resources.ts). Al añadir un campo, cámbialo en ambos o el build fallará.
- `functions/_lib/` contiene helpers compartidos de las Functions (auth con comparación timing-safe de SHA-256, db, github, http, validate).

## Despliegue

El workflow [.github/workflows/build.yml](.github/workflows/build.yml) corre cada 12 h (05:00/17:00 UTC) y bajo demanda: ingesta → commit de `data/`+`.cache/` si cambiaron (`[skip ci]`) → build → `wrangler pages deploy dist`. Los commits `push` a `data/**` y `.cache/**` se ignoran para no encadenar builds.

`astro.config.mjs` lee `SITE_URL`/`BASE_PATH` de variables de CI (en Cloudflare, `BASE_PATH=/`). Secretos de CI: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`. El binding D1 (`DB`) y los secretos de las Functions (`WRITE_TOKEN`, `GITHUB_TOKEN`) se configuran en el panel de Cloudflare Pages, no en `wrangler.toml`.
