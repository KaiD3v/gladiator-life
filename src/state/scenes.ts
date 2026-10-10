// Fila de cenas de história: avançar fala a fala ou pular tudo.
import { SCENES } from '../data';
import type { GameState, Screen } from './types';

export const scene = (queue: string[], next: Screen): Screen => ({ name: 'scene', queue, beat: 0, next });

export function nextBeat(g: GameState): GameState {
  const scr = g.screen;
  if (scr.name !== 'scene') return g;
  if (scr.beat + 1 < SCENES[scr.queue[0]].beats.length) return { ...g, screen: { ...scr, beat: scr.beat + 1 } };
  const queue = scr.queue.slice(1);
  return { ...g, screen: queue.length ? { ...scr, queue, beat: 0 } : scr.next };
}

export function skipScenes(g: GameState): GameState {
  return g.screen.name === 'scene' ? { ...g, screen: g.screen.next } : g;
}
