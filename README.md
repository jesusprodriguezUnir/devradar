# DevRadar

Panel estático y auto-actualizado que cura y categoriza los recursos más relevantes para mi día a día: **repositorios** de GitHub (.NET, Angular, arquitectura), **webs de referencia** y **skills** para Claude / agentes IA.

Arquitectura completa y diagramas en [`../Arquitectura-DevRadar.md`](../Arquitectura-DevRadar.md).

## Stack
Astro (SSG) · TypeScript · GitHub Actions (cron) · GitHub Pages · categorización híbrida (reglas + Claude).

## Cómo funciona
1. **Ingesta** (`scripts/ingest/`): consulta la GitHub Search API según `config/queries.yaml`, añade el *seed* curado (`seed/websites.yaml`, `seed/skills.yaml`), puntúa por relevancia y categoriza (reglas → caché → Claude para lo ambiguo).
2. Escribe `data/resources.json` (validado con Zod en build).
3. **Astro** genera el sitio estático; búsqueda y filtros corren en el navegador.
4. **GitHub Actions** lo ejecuta por cron, commitea los datos y publica en Pages.

## Desarrollo local

```bash
npm install

# 1. Genera el catálogo (usa GITHUB_TOKEN y ANTHROPIC_API_KEY si los defines en .env)
npm run ingest

# 2. Levanta el sitio
npm run dev        # http://localhost:4321

# Build de producción
npm run build && npm run preview
```

Copia `.env.example` a `.env` y rellena lo que quieras:
- **`GITHUB_TOKEN`** (opcional): sube el rate limit de la Search API. Sin token funciona, más lento.
- **`ANTHROPIC_API_KEY`** (opcional): activa la categorización semántica con Claude. Sin clave, solo reglas.

## Personalización
- **Qué se descubre**: edita `config/queries.yaml` (topics, estrellas mínimas, pesos).
- **Webs y skills fijos**: edita `seed/websites.yaml` y `seed/skills.yaml`.
- **Categorías y reglas**: `scripts/ingest/categories.ts` (y su espejo en `src/lib/categories.ts`).
- **Relevancia**: pesos en `scripts/ingest/score.ts`.

## Despliegue (GitHub Pages)
1. Sube el repo a GitHub. En *Settings → Pages*, fuente: **GitHub Actions**.
2. En *Settings → Secrets and variables → Actions*:
   - *Secrets*: `ANTHROPIC_API_KEY` (si usas Claude).
   - *Variables*: `SITE_URL` (p. ej. `https://<usuario>.github.io`) y `BASE_PATH` (p. ej. `/devradar`).
3. El workflow `.github/workflows/build.yml` ya hace ingesta + build + deploy cada 12 h y bajo demanda (`workflow_dispatch`).

> Ajusta `site`/`base` en `astro.config.mjs` si usas dominio propio o *user page* (en ese caso `BASE_PATH=/`).

## Estructura
```
config/queries.yaml        # consultas a la GitHub Search API
seed/                      # webs y skills curados a mano
scripts/ingest/            # pipeline de ingesta (TS)
data/resources.json        # catálogo generado (versionado)
.cache/                    # caché de clasificaciones + histórico de estrellas
src/                       # sitio Astro (componentes, páginas, lib)
.github/workflows/         # CI: cron + deploy
```

## Notas de diseño
- **Sin backend**: todo es estático; los filtros/búsqueda son client-side sobre `data-*`.
- **Fail-safe**: si la búsqueda falla, se conserva el último catálogo bueno marcado como `stale`.
- **Coste ~0**: Claude solo se invoca sobre recursos ambiguos sin caché (Haiku); en estado estacionario tiende a cero llamadas.
- **Evolución**: búsqueda en vivo (Astro SSR en Vercel), favoritos con `localStorage`, alertas. Ver el documento de arquitectura.
