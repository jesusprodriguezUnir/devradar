# DevRadar

> **Producción:** **[devradar-9ns.pages.dev](https://devradar-9ns.pages.dev/)**

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

## Despliegue (Cloudflare Pages)
Producción: **https://devradar-9ns.pages.dev**

1. En *Settings → Secrets and variables → Actions* del repo:
   - *Secrets*: `CLOUDFLARE_API_TOKEN` (permiso *Account → Cloudflare Pages → Edit*),
     `CLOUDFLARE_ACCOUNT_ID` y, opcional, `ANTHROPIC_API_KEY` (si usas Claude).
   - *Variables*: `SITE_URL` (p. ej. `https://devradar-9ns.pages.dev`) y `BASE_PATH=/`.
2. El proyecto Cloudflare Pages debe existir con el nombre `devradar` (el primer deploy no lo crea solo).
3. El workflow `.github/workflows/build.yml` hace ingesta + build + `wrangler pages deploy` cada 12 h
   y bajo demanda (`workflow_dispatch`).

> Para GitHub Pages (project page) usarías `BASE_PATH=/devradar`; en Cloudflare el sitio va en la raíz, por eso `BASE_PATH=/`.

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
