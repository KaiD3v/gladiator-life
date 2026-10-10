// Regras da run: montagem do personagem, arena atual, loja e preços. Funções puras sobre RunState.
import { rand } from '../core/rng';
import { createCombat, makeFighter, NO_PERKS, type CombatState } from '../engine/combat';
import {
  ARENAS, ATTR_GAIN, CLASSES, ENEMIES, HP_PER_LEVEL, ITEMS, MAX_SKILLS, REST_PRICE, SHOP_SIZE, SKILLS, TRAIN_BASE, TRAIN_STEP,
  type ArenaDef, type Attr, type Perks, type Stats,
} from '../data';
import type { RunState } from './types';

export const arenaById = (id: string): ArenaDef => ARENAS.find((a) => a.id === id)!;
/** Índice da fase atual (0 = primeira arena). */
export const stageOf = (run: Pick<RunState, 'arenaId'>) => ARENAS.findIndex((a) => a.id === run.arenaId);

export function playerBuild(run: Pick<RunState, 'classId' | 'items' | 'level' | 'attrs'>): { stats: Stats; perks: Perks } {
  const cls = CLASSES[run.classId];
  const stats = { ...cls.stats, maxHp: cls.stats.maxHp + HP_PER_LEVEL * (run.level - 1) };
  const perks = { ...NO_PERKS, ...cls.perks };
  const add = (mods: Partial<Stats>, times = 1) => {
    for (const [k, v] of Object.entries(mods)) stats[k as keyof Stats] += v * times;
  };
  for (const a of Object.keys(ATTR_GAIN) as Attr[]) add(ATTR_GAIN[a], run.attrs[a] - cls.attrs[a]);
  for (const item of run.items.map((id) => ITEMS[id])) {
    add(item.mods ?? {});
    for (const [k, v] of Object.entries(item.perks ?? {})) perks[k as keyof Perks] += v;
  }
  return { stats, perks };
}

// ---------- Regras do acampamento (exportadas para a UI mostrar preços e bloqueios) ----------

export const trainPrice = (run: RunState, a: Attr) => TRAIN_BASE + TRAIN_STEP * run.trained[a];
export const restPrice = (run: RunState) => REST_PRICE * arenaById(run.arenaId).tier;
export const maxHp = (run: RunState) => playerBuild(run).stats.maxHp;
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

export function rollShop(run: RunState) {
  const pool = Object.keys(ITEMS).filter((id) => !run.items.includes(id));
  run.shop = [];
  while (run.shop.length < SHOP_SIZE && pool.length) run.shop.push(pool.splice(Math.floor(rand(run) * pool.length), 1)[0]);
}

export function startFight(run: RunState): CombatState {
  const { stats, perks } = playerBuild(run);
  const player = makeFighter(run.name, 'player', stats, perks, { ...run.attrs }, [...run.skills], run.hp);
  const def = ENEMIES[run.enemies[run.encounter]];
  const t = arenaById(run.arenaId).tier - 1;
  const scale = (n: number) => Math.round(n * (1 + 0.2 * t));
  const eStats = { ...def.stats, maxHp: scale(def.stats.maxHp), atk: scale(def.stats.atk), mag: scale(def.stats.mag), def: def.stats.def + t };
  const enemy = makeFighter(def.name, 'enemy', eStats, { ...NO_PERKS, ...def.perks }, { ...def.attrs, dex: def.attrs.dex + t }, [...def.skills]);
  return createCombat(player, enemy, Math.floor(rand(run) * 2 ** 32));
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
