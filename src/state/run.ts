// Regras da run: montagem do personagem, arena atual, loja e preços. Funções puras sobre RunState.
import { fork, pick, rand } from '../core/rng';
import { createCombat, type CombatState } from '../engine/combat';
import { actOf, buildPlayer, createEnemyFighter, createPlayerFighter } from '../engine/characters';
import { rollLoot, rollShop } from '../engine/items';
import { ACTS, ARENAS, BET, CHARACTERS, DEMAND_GOALS, ENEMIES, MAX_SKILLS, NPCS, REST_PRICE, SKILLS, TRAIN_BASE, TRAIN_STEP, type ArenaDef, type Attr, type CampDef, type CharacterDef, type NpcDef } from '../data';
import type { SavedRival } from './save';
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

/** A luta atual (ou a próxima, no acampamento) é contra o Rival da arena. */
export const rivalFight = (run: Pick<RunState, 'encounter' | 'rival'>) => run.rival?.at === run.encounter;
/** Nome de quem o herói enfrenta na luta atual (o Rival tem nome próprio). */
export const foeName = (run: RunState) => (rivalFight(run) ? run.rival!.name : ENEMIES[run.enemies[run.encounter]].name);

/**
 * Exigência da Plebe de uma luta comum (ActFeatures.demands), sorteada pela semente do combate com RNG derivado: não muda
 * nenhum outro sorteio. "Bloqueie um golpe pesado" só contra quem tem golpe pesado.
 */
function drawDemand(enemyId: string, seed: number) {
  const heavy = ENEMIES[enemyId].pattern.some((id) => SKILLS[id]?.windup);
  return pick(fork({ seed }, 0x2f6b1d3), DEMAND_GOALS.filter((g) => g !== 'perfectBlock' || heavy));
}

export function startFight(run: RunState): CombatState {
  const enemyId = run.enemies[run.encounter];
  const seed = Math.floor(rand(run) * 2 ** 32);
  const rival = rivalFight(run) ? run.rival! : undefined;
  const mark = rival && { name: rival.name, rank: rival.rank, taunt: `Você de novo, ${run.name}? Da última vez a areia bebeu o seu sangue.` };
  const boost = betBoost(run);
  const enemy = { ...createEnemyFighter(enemyId, arenaById(run.arenaId).tier, mark, boost), bag: rollLoot(enemyId, seed) };
  const boss = isBossFight(run);
  const demand = !boss && ACTS[actOf(run.arenaId)].features?.demands ? drawDemand(enemyId, seed) : undefined;
  return createCombat(createPlayerFighter(run), enemy, seed, {
    boss, trial: boss && !!ENEMIES[enemyId].trial, hazard: arenaById(run.arenaId).hazard, known: run.bestiary[enemyId], demand,
    note: boost ? `A aposta alta atraiu um adversário mais forte: +${Math.round(boost * 100)}% de vida e ataque.` : undefined,
  });
}

/** Quanto a aposta da run fortalece o adversário da próxima luta (0 sem aposta). */
export const betBoost = (run: Pick<RunState, 'bet'>) => (run.bet ? BET.stakes[run.bet.stake].boost : 0);

/** O Rival guardado para esta arena (SaveData.rivals, por ato) entra no lugar da última luta antes do chefe. */
export function placeRival(run: RunState, rivals: Record<string, SavedRival>) {
  delete run.rival;
  const r = rivals[ACTS[actOf(run.arenaId)].id];
  const at = run.enemies.length - 2;
  if (!r || r.arena !== run.arenaId || at < 0) return;
  run.enemies[at] = r.enemy;
  run.rival = { enemy: r.enemy, name: r.name, rank: r.rank, at };
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
