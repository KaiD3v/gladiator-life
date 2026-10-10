// Progressão permanente salva no navegador: XP (nível) e estatísticas. Sem DOM.
import { ARENAS, XP_PER_LEVEL } from '../data';

/** Progressão permanente: só XP (nível) e estatísticas. Arenas não se desbloqueiam: cada personagem recomeça da fase 1. */
export interface SaveData { version: 2; xp: number; runs: number; wins: number; best: number }

export const SAVE_KEY = 'arena-dos-gladiadores:save';
export const defaultSave = (): SaveData => ({ version: 2, xp: 0, runs: 0, wins: 0, best: 0 });

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/** Valida o save bruto do navegador. Qualquer coisa fora do formato volta ao padrão com aviso. */
export function parseSave(raw: string | null): { save: SaveData; error?: string } {
  if (raw === null) return { save: defaultSave() };
  try {
    const d = JSON.parse(raw);
    if (d?.version === 2 && isCount(d.xp) && isCount(d.runs) && isCount(d.wins) && isCount(d.best) && d.best <= ARENAS.length) {
      return { save: { version: 2, xp: d.xp, runs: d.runs, wins: d.wins, best: d.best } };
    }
    // v1 (arenas desbloqueáveis): mantém XP e runs; "vitórias" mudaram de sentido (campanha completa), então zeram.
    if (d?.version === 1 && isCount(d.xp) && isCount(d.runs) && Array.isArray(d.unlocked)) {
      return { save: { version: 2, xp: d.xp, runs: d.runs, wins: 0, best: Math.min(ARENAS.length, Math.max(0, d.unlocked.length - 1)) } };
    }
  } catch { /* cai no padrão abaixo */ }
  return { save: defaultSave(), error: 'O save encontrado estava inválido e foi reiniciado.' };
}

/** XP total para alcançar o nível L (curva crescente: cada nível custa 100 × o nível atual). */
export const xpForLevel = (level: number) => (XP_PER_LEVEL / 2) * level * (level - 1);
export function levelOf(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}
