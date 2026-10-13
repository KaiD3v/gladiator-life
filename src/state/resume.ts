// Campanha em andamento salva no navegador: a run e a tela atual, para continuar do mesmo ponto ao recarregar a página.
// Fica separada do SaveData (progressão permanente): some quando a run acaba (morte, prazo ou campanha vencida). Sem DOM.
import { ARENAS, BET, BETS, CLASSES, ENEMIES, ITEMS, NPCS, SCENES, SKILLS } from '../data';
import type { SaveData } from './save';
import type { GameState, RunState, Screen } from './types';

export const RUN_KEY = 'arena-dos-gladiadores:run';
/** Suba ao mudar o formato de RunState/Screen: snapshot de outra versão é descartado (com aviso), nunca quebra o jogo. */
export const RUN_VERSION = 1;

export interface Resume { run: RunState; screen: Screen }

/** O que gravar para esta transição: o snapshot, ou null quando não há campanha em andamento (apaga o salvo). */
export const resumeSnapshot = (g: GameState): string | null =>
  g.run ? JSON.stringify({ version: RUN_VERSION, run: g.run, screen: g.screen }) : null;

/** Estado inicial continuando a campanha salva. */
export const resumeState = (save: SaveData, r: Resume, notice?: string): GameState => ({ save, run: r.run, screen: r.screen, notice });

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isStr = (s: unknown): s is string => typeof s === 'string';
const ids = (v: unknown, table: Record<string, unknown>) => Array.isArray(v) && v.every((id) => isStr(id) && id in table);
const isAttrs = (v: unknown) => isObj(v) && isCount(v.str) && isCount(v.dex) && isCount(v.wis);
const ARENA_IDS = Object.fromEntries(ARENAS.map((a) => [a.id, a]));

/** Run válida para o conteúdo atual (também valida os checkpoints da história no save). */
export function validRun(r: unknown): r is RunState {
  if (!isObj(r)) return false;
  const counts = ['daysSpent', 'level', 'gold', 'day', 'hp', 'encounter', 'xp', 'goldEarned', 'rounds', 'dealt', 'taken'];
  return isStr(r.name) && !!r.name && isStr(r.classId) && r.classId in CLASSES && isStr(r.arenaId) && r.arenaId in ARENA_IDS
    && counts.every((k) => isCount(r[k])) && (r.level as number) >= 1 && isNum(r.seed) && isAttrs(r.attrs) && isAttrs(r.trained)
    && ids(r.titles, ARENA_IDS) && ids(r.skills, SKILLS) && ids(r.items, ITEMS) && ids(r.bag, ITEMS) && ids(r.shop, ITEMS)
    && ids(r.enemies, ENEMIES) && (r.enemies as string[]).length > 0 && (r.encounter as number) < (r.enemies as string[]).length
    && ids(r.kills, ENEMIES) && ids(r.fled, ENEMIES) && ids(r.seen, SCENES) && isObj(r.bestiary)
    && isObj(r.verdicts) && Object.entries(r.verdicts).every(([id, v]) => id in ENEMIES && (v === 'executed' || v === 'spared'))
    && (r.bet === undefined || (isObj(r.bet) && BETS.some((b) => b.id === (r.bet as Obj).id) && isCount(r.bet.stake) && r.bet.stake < BET.stakes.length))
    && (r.rival === undefined || (isObj(r.rival) && isStr(r.rival.enemy) && r.rival.enemy in ENEMIES && isStr(r.rival.name) && isCount(r.rival.rank) && isCount(r.rival.at)));
}

/** Tela gravada quando a conversa era por papel ('merchant', 'str'...): fecha a conversa em vez de descartar a campanha. */
function upgradeScreen(s: unknown): unknown {
  if (!isObj(s)) return s;
  if (s.name === 'scene') return { ...s, next: upgradeScreen(s.next) };
  return s.name === 'camp' && isStr(s.npc) && !(s.npc in NPCS) ? { ...s, npc: null, line: '' } : s;
}

/** Run gravada antes de existir `verdicts` (veredito em chefe): completa com o padrão. */
export const upgradeRun = (r: unknown): unknown => (isObj(r) && !('verdicts' in r) ? { ...r, verdicts: {} } : r);

function validFighter(f: unknown): boolean {
  return isObj(f) && isStr(f.name) && isNum(f.hp) && isNum(f.energy) && isObj(f.stats) && ids(f.skills, SKILLS) && ids(f.bag, ITEMS)
    && Array.isArray(f.statuses) && Array.isArray(f.pattern) && Array.isArray(f.weak);
}

/** Telas possíveis com uma run em andamento (título, criação e resumo só existem sem run). */
function validScreen(s: unknown, depth = 0): s is Screen {
  if (!isObj(s) || depth > 1) return false;
  switch (s.name) {
    case 'camp':
      return (s.npc === null || (isStr(s.npc) && s.npc in NPCS)) && isStr(s.line) && isStr(s.news) && (s.loot === undefined || ids(s.loot, ITEMS));
    case 'combat': {
      const c = s.combat;
      return isObj(c) && isCount(c.round) && isNum(c.crowd) && isObj(c.intent) && validFighter(c.player) && validFighter(c.enemy)
        && Array.isArray(c.log) && c.log.length > 0 && c.log.every((e) => isObj(e) && Array.isArray(e.hp));
    }
    case 'scene': {
      const q = s.queue;
      return ids(q, SCENES) && (q as string[]).length > 0 && isCount(s.beat)
        && (s.beat as number) < SCENES[(q as string[])[0]].beats.length && validScreen(s.next, depth + 1);
    }
    default:
      return false;
  }
}

/** Lê o snapshot do navegador. Sem nada salvo: `{}`. Fora do formato (ou de outra versão/conteúdo): descarta com aviso. */
export function parseResume(raw: string | null): { resume?: Resume; error?: string } {
  if (raw === null) return {};
  try {
    const d = JSON.parse(raw);
    const run = upgradeRun(d?.run), screen = upgradeScreen(d?.screen);
    if (d?.version === RUN_VERSION && validRun(run) && validScreen(screen)) return { resume: { run, screen } };
  } catch { /* cai no aviso abaixo */ }
  return { error: 'A campanha salva não pôde ser carregada e foi descartada.' };
}
