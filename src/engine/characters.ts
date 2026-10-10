// Montagem de personagens: um só lugar que diz como estatísticas e vantagens finais são calculadas.
import {
  ATTR_GAIN, CLASSES, ENEMIES, ENEMY_DEF_PER_TIER, ENEMY_DEX_PER_TIER, ENEMY_SCALE_PER_TIER, HP_PER_LEVEL, ITEMS,
  type Attr, type Perks, type Stats,
} from '../data';
import type { RunState } from '../state/types';
import { makeFighter, NO_PERKS, type Fighter } from './combat';

/** Deltas de estatísticas e vantagens, aplicados `times` vezes. */
export interface Modifier {
  stats?: Partial<Stats>;
  perks?: Partial<Perks>;
  times?: number;
}

/** Base + modificadores, aplicados em ordem. Não altera a base. */
export function applyModifiers(base: { stats: Stats; perks: Perks }, mods: Modifier[]): { stats: Stats; perks: Perks } {
  const stats = { ...base.stats };
  const perks = { ...base.perks };
  for (const { stats: s = {}, perks: p = {}, times = 1 } of mods) {
    for (const [k, v] of Object.entries(s)) stats[k as keyof Stats] += v * times;
    for (const [k, v] of Object.entries(p)) perks[k as keyof Perks] += v * times;
  }
  return { stats, perks };
}

type BuildInput = Pick<RunState, 'classId' | 'items' | 'level' | 'attrs'>;

/** Modificadores do jogador: bônus permanente de nível, atributos acima do inicial da classe e itens. */
export function playerModifiers(run: BuildInput): Modifier[] {
  const cls = CLASSES[run.classId];
  return [
    { stats: { maxHp: HP_PER_LEVEL }, times: run.level - 1 },
    ...(Object.keys(ATTR_GAIN) as Attr[]).map((a) => ({ stats: ATTR_GAIN[a], times: run.attrs[a] - cls.attrs[a] })),
    ...run.items.map((id) => ({ stats: ITEMS[id].mods, perks: ITEMS[id].perks })),
  ];
}

export function buildPlayer(run: BuildInput): { stats: Stats; perks: Perks } {
  const cls = CLASSES[run.classId];
  return applyModifiers({ stats: cls.stats, perks: { ...NO_PERKS, ...cls.perks } }, playerModifiers(run));
}

export function createPlayerFighter(run: RunState): Fighter {
  const { stats, perks } = buildPlayer(run);
  return { ...makeFighter(run.name, 'player', stats, perks, { ...run.attrs }, [...run.skills], run.hp), glory: CLASSES[run.classId].glory };
}

/** Inimigo escalado pelo nível de perigo da arena (tier 1 = sem escala). */
export function createEnemyFighter(enemyId: string, tier: number): Fighter {
  const def = ENEMIES[enemyId];
  const t = tier - 1;
  const scale = (n: number) => Math.round(n * (1 + ENEMY_SCALE_PER_TIER * t));
  const stats = { ...def.stats, maxHp: scale(def.stats.maxHp), atk: scale(def.stats.atk), mag: scale(def.stats.mag), def: def.stats.def + ENEMY_DEF_PER_TIER * t };
  const attrs = { ...def.attrs, dex: def.attrs.dex + ENEMY_DEX_PER_TIER * t };
  return makeFighter(def.name, 'enemy', stats, { ...NO_PERKS, ...def.perks }, attrs, [...def.skills], undefined, [...def.pattern]);
}
