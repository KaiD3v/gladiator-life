// Acampamento (vida fora das batalhas): conversar, comprar, treinar, aprender e descansar.
import { pick } from '../core/rng';
import { ITEMS, NPCS, REST_FREE, REST_PAID, SKILLS, type NpcDef, type NpcId } from '../data';
import { freeDays, learnBlock, maxHp, restPrice, trainPrice } from './run';
import type { ActionOf, GameState, RunState } from './types';

type NpcReaction = keyof Pick<NpcDef, 'greet' | 'deal' | 'poor' | 'denied'>;

/** Atividade do acampamento que gasta um dia. Bloqueada no último dia: nele só se luta. */
function spendDay(run: RunState): boolean {
  if (freeDays(run) <= 0) return false;
  run.day++;
  return true;
}

/** Ações do acampamento: valida a tela, clona a run e devolve a fala do NPC (ou o estado intacto se nada mudou). */
function campAction(g: GameState, npc: NpcId, fn: (run: RunState) => NpcReaction | 'skip'): GameState {
  const scr = g.screen;
  if (scr.name !== 'camp' || !g.run) return g;
  const run = structuredClone(g.run);
  const outcome = fn(run);
  if (outcome === 'skip') return g;
  return { ...g, run, screen: { ...scr, npc, line: pick(run, NPCS[npc][outcome]) } };
}

export function talk(g: GameState, a: ActionOf<'talk'>): GameState {
  const scr = g.screen;
  if (scr.name !== 'camp' || !g.run) return g;
  if (a.npc === null) return { ...g, screen: { ...scr, npc: null, line: '' } };
  const run = structuredClone(g.run);
  return { ...g, run, screen: { ...scr, npc: a.npc, line: pick(run, NPCS[a.npc].greet) } };
}

export const buy = (g: GameState, a: ActionOf<'buy'>): GameState =>
  campAction(g, 'merchant', (run) => {
    if (!run.shop.includes(a.itemId)) return 'skip';
    const item = ITEMS[a.itemId];
    if (run.gold < item.price) return 'poor';
    run.gold -= item.price;
    run.items.push(a.itemId);
    run.hp += item.mods?.maxHp ?? 0;
    run.shop = run.shop.filter((id) => id !== a.itemId);
    return 'deal';
  });

export const train = (g: GameState, a: ActionOf<'train'>): GameState =>
  campAction(g, a.attr, (run) => {
    if (!(a.attr in run.attrs) || freeDays(run) <= 0) return 'skip';
    const price = trainPrice(run, a.attr);
    if (run.gold < price) return 'poor';
    const before = maxHp(run);
    run.gold -= price;
    run.attrs[a.attr]++;
    run.trained[a.attr]++;
    run.hp += maxHp(run) - before; // treinar Força também enche a vida nova
    spendDay(run);
    return 'deal';
  });

export function learn(g: GameState, a: ActionOf<'learn'>): GameState {
  const sk = SKILLS[a.skill];
  if (!sk?.attr || !sk.price) return g;
  return campAction(g, sk.attr, (run) => {
    const block = learnBlock(run, a.skill);
    if (block === 'known' || block === 'days') return 'skip';
    if (block === 'req' || block === 'slots') return 'denied';
    if (block === 'gold') return 'poor';
    run.gold -= sk.price!;
    run.skills.push(a.skill);
    spendDay(run);
    return 'deal';
  });
}

export const rest = (g: GameState): GameState =>
  campAction(g, 'inn', (run) => {
    const max = maxHp(run);
    if (run.hp >= max) return 'denied';
    if (!spendDay(run)) return 'skip';
    const paid = run.gold >= restPrice(run);
    if (paid) run.gold -= restPrice(run);
    run.hp = Math.min(max, run.hp + Math.round(max * (paid ? REST_PAID : REST_FREE)));
    return paid ? 'deal' : 'poor';
  });
