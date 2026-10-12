// Progressão permanente salva no navegador: XP (nível), estatísticas e a história (checkpoints por ato). Sem DOM.
import { ACTS, ARENAS, XP_PER_LEVEL } from '../data';
import { validRun } from './resume';
import type { RunState } from './types';

/**
 * Progressão permanente: XP (nível), estatísticas e `story`, o herói da história no início de cada ato já liberado
 * (`story[i]` = como estava ao entrar no ato i; atos liberados = `story.length`). Morrer volta ao checkpoint do ato.
 */
export interface SaveData { version: 3; xp: number; runs: number; wins: number; best: number; story: RunState[] }

export const SAVE_KEY = 'arena-dos-gladiadores:save';
export const defaultSave = (): SaveData => ({ version: 3, xp: 0, runs: 0, wins: 0, best: 0, story: [] });

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const validStory = (v: unknown): v is RunState[] =>
  Array.isArray(v) && v.length <= ACTS.length && v.every((r, i) => validRun(r) && r.arenaId === ACTS[i].arenas[0].id);

/** Valida o save bruto do navegador. Qualquer coisa fora do formato volta ao padrão com aviso. */
export function parseSave(raw: string | null): { save: SaveData; error?: string } {
  if (raw === null) return { save: defaultSave() };
  try {
    const d = JSON.parse(raw);
    const stats = isCount(d?.xp) && isCount(d.runs) && isCount(d.wins) && isCount(d.best) && d.best <= ARENAS.length;
    if (d?.version === 3 && stats) {
      const save: SaveData = { version: 3, xp: d.xp, runs: d.runs, wins: d.wins, best: d.best, story: [] };
      // História corrompida (ou de conteúdo que mudou) não leva o XP junto.
      if (validStory(d.story)) return { save: { ...save, story: d.story } };
      return { save, error: 'A história salva não pôde ser carregada e foi descartada. Seu nível foi mantido.' };
    }
    // v2 (antes dos atos): mantém tudo; ainda não havia herói da história.
    if (d?.version === 2 && stats) return { save: { version: 3, xp: d.xp, runs: d.runs, wins: d.wins, best: d.best, story: [] } };
    // v1 (arenas desbloqueáveis): mantém XP e runs; "vitórias" mudaram de sentido (campanha completa), então zeram.
    if (d?.version === 1 && isCount(d.xp) && isCount(d.runs) && Array.isArray(d.unlocked)) {
      return { save: { ...defaultSave(), xp: d.xp, runs: d.runs, best: Math.min(ARENAS.length, Math.max(0, d.unlocked.length - 1)) } };
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
