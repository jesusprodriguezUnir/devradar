import { defineConfig } from "astro/config";

// Ajusta `site` y `base` a tu usuario/repo de GitHub Pages.
// Para un repo project-page: https://<usuario>.github.io/<repo>
// Si usas dominio propio o user-page, deja base en "/".
export default defineConfig({
  site: process.env.SITE_URL ?? "https://jesusprodriguez.github.io",
  base: process.env.BASE_PATH ?? "/devradar",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});
