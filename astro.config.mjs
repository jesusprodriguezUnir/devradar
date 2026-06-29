import { defineConfig } from "astro/config";

// Despliegue en Cloudflare Pages (raíz del subdominio *.pages.dev).
// `site` y `base` se sobreescriben en CI con las Variables SITE_URL/BASE_PATH.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://devradar-9ns.pages.dev",
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});
