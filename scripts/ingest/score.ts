// Modelo de relevancia. Pesos ajustables sin tocar el resto del pipeline.
const W = { stars: 0.45, recency: 0.25, topicMatch: 0.2, momentum: 0.1 };

const MS_PER_DAY = 86_400_000;

/** Normaliza estrellas en [0,1] con escala logaritmica (10k estrellas ~ tope). */
function normStars(stars: number): number {
  if (stars <= 0) return 0;
  return Math.min(1, Math.log10(stars + 1) / 4); // log10(10000)=4
}

/** Decae con los dias desde el ultimo push. ~0 si lleva mas de un ano parado. */
function recency(pushedAt: string | null): number {
  if (!pushedAt) return 0.3;
  const days = (Date.now() - new Date(pushedAt).getTime()) / MS_PER_DAY;
  return Math.max(0, 1 - days / 365);
}

/** Momentum (trending aproximado) a partir del delta de estrellas entre runs. */
function momentum(starsDelta: number): number {
  return Math.min(1, starsDelta / 200);
}

export function relevanceScore(input: {
  stars: number | null;
  pushedAt: string | null;
  starsDelta: number;
  queryWeight: number;
  ruleMatched: boolean;
}): number {
  const s = input.stars ?? 0;
  const topicMatch = input.ruleMatched ? 1 : 0.4;
  const raw =
    W.stars * normStars(s) +
    W.recency * recency(input.pushedAt) +
    W.topicMatch * topicMatch +
    W.momentum * momentum(input.starsDelta);
  return Math.round(raw * input.queryWeight * 1000) / 1000;
}
