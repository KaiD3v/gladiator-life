import type { Stats } from './types';

/** Estatísticas padrão; cada classe/inimigo sobrescreve só o que difere. */

export const base = (s: Partial<Stats>): Stats => ({
  maxHp: 60, maxEnergy: 10, regen: 2, atk: 8, mag: 2, def: 3, speed: 5, crit: 0.05, critMult: 1.75, block: 0.5, ...s,
});
