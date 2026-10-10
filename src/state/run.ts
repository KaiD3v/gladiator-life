// Regras da run: montagem do personagem, arena atual, loja e preços. Funções puras sobre RunState.
import { rand } from '../core/rng';
import { createCombat, type CombatState } from '../engine/combat';
import { buildPlayer, createEnemyFighter, createPlayerFighter } from '../engine/characters';
import { rollShop } from '../engine/items';
import { ARENAS, MAX_SKILLS, REST_PRICE, SKILLS, TRAIN_BASE, TRAIN_STEP, type ArenaDef, type Attr } from '../data';
import type { RunState } from './types';

export { rollShop };
export const arenaById = (id: string): ArenaDef => ARENAS.find((a) => a.id === id)!;
/** Índice da fase atual (0 = primeira arena). */
export const stageOf = (run: Pick<RunState, 'arenaId'>) => ARENAS.findIndex((a) => a.id === run.arenaId);
/** Próxima arena da campanha (undefined na última). */
export const nextArena = (run: Pick<RunState, 'arenaId'>): ArenaDef | undefined => ARENAS[stageOf(run) + 1];
/** A luta atual (ou a próxima, no acampamento) é contra o chefe da arena. */
export const isBossFight = (run: Pick<RunState, 'encounter' | 'enemies'>) => run.encounter === run.enemies.length - 1;

export const playerBuild = buildPlayer;

// ---------- Regras do acampamento (exportadas para a UI mostrar preços e bloqueios) ----------

export const trainPrice = (run: RunState, a: Attr) => TRAIN_BASE + TRAIN_STEP * run.trained[a];
export const restPrice = (run: RunState) => REST_PRICE * arenaById(run.arenaId).tier;
export const maxHp = (run: RunState) => buildPlayer(run).stats.maxHp;
/** Dias livres antes do prazo. 0 = hoje só dá para lutar. */
export const freeDays = (run: RunState) => arenaById(run.arenaId).days - run.day;

export type LearnBlock = 'known' | 'slots' | 'req' | 'gold' | 'days' | null;
export function learnBlock(run: RunState, id: string): LearnBlock {
  const sk = SKILLS[id];
  if (run.skills.includes(id)) return 'known';
  if (run.skills.length >= MAX_SKILLS) return 'slots';
  if (run.attrs[sk.attr!] < sk.req!) return 'req';
  if (freeDays(run) <= 0) return 'days';
  if (run.gold < sk.price!) return 'gold';
  return null;
}

export function startFight(run: RunState): CombatState {
  const enemy = createEnemyFighter(run.enemies[run.encounter], arenaById(run.arenaId).tier);
  return createCombat(createPlayerFighter(run), enemy, Math.floor(rand(run) * 2 ** 32), { boss: isBossFight(run), known: run.bestiary[run.enemies[run.encounter]] });
}

/** Prepara a temporada da arena atual: adversários sorteados + chefe, dia 1, loja nova. */
export function enterArena(run: RunState) {
  const arena = arenaById(run.arenaId);
  run.encounter = 0;
  run.day = 1;
  run.enemies = [];
  for (let i = 0; i < arena.fights; i++) run.enemies.push(arena.pool[Math.floor(rand(run) * arena.pool.length)]);
  run.enemies.push(arena.boss);
  rollShop(run);
}
