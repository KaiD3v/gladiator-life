// Aleatoriedade determinística: a semente vive no próprio estado (combate ou run), então tudo é reproduzível e testável.

/** mulberry32: RNG determinístico guardado no próprio estado (testável e reproduzível). */
export function rand(s: { seed: number }): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Sorteia um elemento da lista usando a semente do estado. */
export const pick = <T>(s: { seed: number }, list: T[]): T => list[Math.floor(rand(s) * list.length)];
