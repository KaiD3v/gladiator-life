// Regras da run: montagem do personagem, arena atual, loja e preços. Funções puras sobre RunState.
import { rand } from '../core/rng';
import { createCombat, type CombatState } from '../engine/combat';
import { buildPlayer, createEnemyFighter, createPlayerFighter } from '../engine/characters';
import { actOf, rollLoot, rollShop } from '../engine/items';
import { ACTS, ARENAS, CHARACTERS, ENEMIES, MAX_SKILLS, NPCS, REST_PRICE, SKILLS, TRAIN_BASE, TRAIN_STEP, type ArenaDef, type Attr, type CampDef, type CharacterDef, type NpcDef } from '../data';
import type { RunState } from './types';

export { actOf, rollShop };
export const arenaById = (id: string): ArenaDef => ARENAS.find((a) => a.id === id)!;
/** Índice da fase atual (0 = primeira arena). */
export const stageOf = (run: Pick<RunState, 'arenaId'>) => ARENAS.findIndex((a) => a.id === run.arenaId);
/** Próxima arena da campanha (undefined na última). */
export const nextArena = (run: Pick<RunState, 'arenaId'>): ArenaDef | undefined => ARENAS[stageOf(run) + 1];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
/** Nome do ato para o jogador, em algarismos romanos (o índice segue numérico no motor). */
export const actName = (act: number) => `Ato ${ROMAN[act] ?? act + 1}`;
/** Posição da arena na história: ato e arena dentro dele (índices a partir de 0). */
export function stageInAct(arenaId: string) {
  const act = actOf(arenaId), arenas = ACTS[act].arenas;
  return { act, arena: arenas.findIndex((a) => a.id === arenaId), arenas: arenas.length };
}
/** Acampamento do ato em que a run está. */
export const campOf = (run: Pick<RunState, 'arenaId'>): CampDef => ACTS[actOf(run.arenaId)].camp;
/** NPC com a pessoa resolvida (nome e retrato de CHARACTERS). */
export const npcOf = (id: string): NpcDef & CharacterDef => ({ ...NPCS[id], ...CHARACTERS[NPCS[id].who] });
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

export type UseBlock = 'missing' | 'combat' | 'full' | null;
/** Usar consumível no acampamento: só os de cura, e só com a vida abaixo do máximo. */
export function useBlock(run: RunState, itemId: string): UseBlock {
  if (!run.bag.includes(itemId)) return 'missing';
  if (!SKILLS[itemId].heal) return 'combat';
  if (run.hp >= maxHp(run)) return 'full';
  return null;
}

export function startFight(run: RunState): CombatState {
  const enemyId = run.enemies[run.encounter];
  const seed = Math.floor(rand(run) * 2 ** 32);
  const enemy = { ...createEnemyFighter(enemyId, arenaById(run.arenaId).tier), bag: rollLoot(enemyId, seed) };
  const boss = isBossFight(run);
  return createCombat(createPlayerFighter(run), enemy, seed, { boss, trial: boss && !!ENEMIES[enemyId].trial, hazard: arenaById(run.arenaId).hazard, known: run.bestiary[enemyId] });
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
