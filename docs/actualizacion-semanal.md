# Actualizacion semanal de DevRadar

Este runbook actualiza de forma completa el catalogo estatico y deja verificada la calidad minima de datos.

## 1) Precondiciones

- Tener Node 20+ y dependencias instaladas.
- Tener `.env` opcional con `GITHUB_TOKEN` y `ANTHROPIC_API_KEY` si quieres mejor cobertura/rate limit.
- Tener acceso al proyecto Cloudflare si vas a validar capa dinamica o desplegar.

## 2) Actualizacion estandar (local)

```bash
npm install
npm run refresh:all
```

Este comando ejecuta:
1. Ingesta de repos/webs/skills.
2. Validacion de taxonomia compartida.
3. Auditoria de `data/resources.json`.
4. Typecheck Astro.
5. Build de produccion.

## 3) Validaciones manuales recomendadas

### 3.1 Catalogo estatico

- Revisar en `data/resources.json`:
  - `generatedAt` actualizado.
  - `count` coherente.
  - Sin `id` duplicados.
  - Sin categorias fuera del set oficial.

### 3.2 Capa dinamica (D1 + Functions)

Auditoria automatizada del estado dinamico:

```bash
# usando API local/shared
npm run audit:dynamic

# usando snapshot local exportado de /api/state
npm run audit:dynamic -- --state-file=tmp/state.json

# generar SQL de limpieza para huérfanos/ids inválidos
npm run audit:dynamic -- --write-cleanup
```

Si generas SQL de limpieza, se escribe en `scripts/ops/out/cleanup-d1.sql`.

Diagnostico rapido del endpoint (debe devolver `application/json`):

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://TU_HOST/api/state" | Select-Object StatusCode, Headers
```

Si el `Content-Type` es `text/html`, la API no esta activa en ese host y `audit:dynamic` fallara por diseno.

1. `GET /api/state` debe devolver `{ manualRepos, removedIds, saved }`.
2. `POST /api/repos` con token valido debe insertar o restaurar un repo.
3. `DELETE /api/repos` con token valido debe ocultar o borrar.
4. `POST/DELETE /api/saved` debe reflejar cambios sin romper UI.
5. Repetir pruebas con token invalido y verificar `401`.

## 4) Checklist de smoke UI

- Busqueda libre.
- Filtro por categoria.
- Orden (relevancia, estrellas, recientes, nombre).
- Guardar y des-guardar recursos.
- Anadir y eliminar fuente manual.
- Recarga de pagina y persistencia esperada.

## 5) Flujo CI

El workflow `build.yml` ya ejecuta:
1. `npm run ingest`
2. `npm run validate:taxonomy`
3. `npm run audit:data`
4. Commit de `data/` y `.cache/` si hay cambios
5. Build y deploy

## 6) Troubleshooting rapido

- Error de taxonomia: revisar sincronia de slugs en:
  - `scripts/ingest/categories.ts`
  - `src/lib/categories.ts`
  - `functions/_lib/validate.ts`
- Error de dataset: ejecutar `npm run audit:data` y corregir campos invalidos en pipeline o seeds.
- Estado dinamico inconsistente: ejecutar `npm run audit:dynamic` y revisar warnings/errores.
- `audit:dynamic` falla porque `state-url` devuelve HTML: revisar que Pages Functions estén desplegadas, que exista binding `DB` en Cloudflare Pages y que la ruta pública correcta de estado responda JSON.
- Verificacion minima post-deploy: `GET /api/state` devuelve JSON con `manualRepos`, `removedIds`, `saved`.
- Fallos de GitHub API: revisar token/rate limit y relanzar ingesta.
