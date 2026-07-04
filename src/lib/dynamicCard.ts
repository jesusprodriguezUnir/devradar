// Capa dinámica para las páginas basadas en tarjetas (/categoria, /tipo).
// Espeja lo que hace el <script> inline de index.astro, pero sobre <article.card>
// (mismo markup que ResourceCard.astro) en vez de las filas del dashboard.
//
// Se carga como <script> *bundleado* (no is:inline) para poder importar esto.
import { CATEGORY_BY_SLUG, TYPE_LABELS } from "./categories.ts";

const API = "/api";

interface ManualRepo {
  id: string;
  type: string;
  name: string | null;
  owner: string | null;
  url: string;
  description: string | null;
  summary_es: string | null;
  category: string | null;
  tags: string[] | null;
  language: string | null;
  stars: number | null;
  license: string | null;
  lastCommit: string | null;
  addedAt: string;
}

interface State {
  manualRepos: ManualRepo[];
  removedIds: string[];
  saved: string[];
}

const formatStars = (n: number | null): string => {
  if (n === null || n === undefined) return "";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
};

const categoryLabel = (slug: string | null): string =>
  (slug && CATEGORY_BY_SLUG.get(slug)?.label) || slug || "";

/** Construye una <article.card> equivalente a ResourceCard.astro (solo lectura). */
function renderCard(r: ManualRepo): HTMLElement {
  const article = document.createElement("article");
  article.className = "card js-card";
  article.dataset.id = r.id;
  article.dataset.type = r.type || "repo";
  article.dataset.category = r.category || "";
  article.dataset.language = r.language || "";

  const top = document.createElement("div");
  top.className = "card-top";
  const badge = document.createElement("span");
  badge.className = `badge ${r.type || "repo"}`;
  badge.textContent = TYPE_LABELS[r.type || "repo"] || (r.type ?? "");
  top.append(badge);

  const h3 = document.createElement("h3");
  const link = document.createElement("a");
  link.href = r.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = r.name || r.id;
  h3.append(link);

  const desc = document.createElement("p");
  desc.textContent = r.summary_es || r.description || "";

  article.append(top, h3, desc);

  const tags = (r.tags || []).slice(0, 4);
  if (tags.length) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "tags";
    for (const t of tags) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagWrap.append(span);
    }
    article.append(tagWrap);
  }

  const foot = document.createElement("div");
  foot.className = "card-foot";
  const cat = document.createElement("span");
  cat.textContent = categoryLabel(r.category);
  foot.append(cat);
  if (r.language) {
    const lang = document.createElement("span");
    lang.textContent = `· ${r.language}`;
    foot.append(lang);
  }
  if (r.stars !== null && r.stars !== undefined) {
    const star = document.createElement("span");
    star.className = "star";
    star.textContent = `· ★ ${formatStars(r.stars)}`;
    foot.append(star);
  }
  if (r.license) {
    const lic = document.createElement("span");
    lic.textContent = `· ${r.license}`;
    foot.append(lic);
  }
  article.append(foot);
  return article;
}

async function fetchState(): Promise<State | null> {
  try {
    const res = await fetch(`${API}/state`);
    if (!res.ok) return null;
    return (await res.json()) as State;
  } catch {
    return null;
  }
}

/**
 * Aplica la capa dinámica sobre una página de tarjetas:
 * 1. Oculta las tarjetas cuyo id esté en removedIds.
 * 2. Inyecta los repos manuales que pasen `filter` (y no estén ya presentes/removidos).
 * 3. Actualiza el contador y el estado "vacío".
 */
export async function applyDynamicLayer(opts: {
  filter: (r: ManualRepo) => boolean;
  grid: HTMLElement;
  empty: HTMLElement | null;
  count: HTMLElement | null;
}): Promise<void> {
  const state = await fetchState();
  if (!state) return;

  const removed = new Set(state.removedIds || []);
  const present = new Set<string>();
  opts.grid.querySelectorAll<HTMLElement>(".js-card").forEach((card) => {
    const id = card.dataset.id || "";
    if (removed.has(id)) {
      card.remove();
      return;
    }
    present.add(id);
  });

  for (const r of state.manualRepos || []) {
    if (removed.has(r.id) || present.has(r.id) || !opts.filter(r)) continue;
    present.add(r.id);
    opts.grid.append(renderCard(r));
  }

  const visible = opts.grid.querySelectorAll(".js-card").length;
  if (opts.count) opts.count.textContent = String(visible);
  if (opts.empty) opts.empty.hidden = visible !== 0;
  opts.grid.hidden = visible === 0;
}
