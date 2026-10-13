// Acampamento (vida fora das batalhas): conversar com os NPCs do ato e usar os seus serviços (state/services.ts).
import { pick } from '../core/rng';
import { ITEMS, NPCS, SKILLS, type NpcDef, type NpcReaction } from '../data';
import { meets } from '../engine/scenes';
import { campOf, maxHp, useBlock } from './run';
import { provide } from './services';
import type { ActionOf, GameState, RunState } from './types';

/** NPC `id` se ele está no acampamento do ato atual. */
const present = (run: RunState, id: string): NpcDef | undefined => (campOf(run).npcs.includes(id) ? NPCS[id] : undefined);

/** Sorteia a fala da reação entre as que valem para a história da run (falas com `when` só se a condição vale). */
export function say(run: RunState, npc: NpcDef, reaction: NpcReaction): string {
  const lines = npc.lines[reaction].flatMap((l) => (typeof l === 'string' ? [l] : meets(l.when, run.verdicts) ? [l.text] : []));
  return pick(run, lines);
}

export function talk(g: GameState, a: ActionOf<'talk'>): GameState {
  const scr = g.screen;
  if (scr.name !== 'camp' || !g.run) return g;
  if (a.npc === null) return { ...g, screen: { ...scr, npc: null, line: '' } };
  const npc = present(g.run, a.npc);
  if (!npc) return g;
  const run = structuredClone(g.run);
  return { ...g, run, screen: { ...scr, npc: npc.id, line: say(run, npc, 'greet') } };
}

/** Usa um serviço do NPC (comprar, descansar, treinar, aprender): valida, clona a run, aplica e devolve a fala da reação. */
export function serve(g: GameState, a: ActionOf<'service'>): GameState {
  const scr = g.screen;
  const npc = scr.name === 'camp' && g.run ? present(g.run, a.npc) : undefined;
  if (scr.name !== 'camp' || !g.run || !npc) return g;
  const run = structuredClone(g.run);
  const reaction = provide(run, npc.services, a.value);
  if (reaction === 'skip') return g;
  return { ...g, run, screen: { ...scr, npc: npc.id, line: say(run, npc, reaction) } };
}

/** Bebe um consumível de cura fora da luta: não gasta dia. */
export function useItem(g: GameState, a: ActionOf<'use'>): GameState {
  const scr = g.screen;
  if (scr.name !== 'camp' || !g.run || useBlock(g.run, a.itemId)) return g;
  const run = structuredClone(g.run);
  const before = run.hp;
  run.hp = Math.min(maxHp(run), run.hp + SKILLS[a.itemId].heal!);
  run.bag.splice(run.bag.indexOf(a.itemId), 1);
  return { ...g, run, screen: { ...scr, news: `Você usa ${ITEMS[a.itemId].name}: +${run.hp - before} de vida.` } };
}
