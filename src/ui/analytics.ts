// Vercel Web Analytics: visitas (inject) e eventos da campanha, derivados da diferença de estado em `dispatch`.
// Só mede: nenhuma regra de jogo aqui. O nome do gladiador (texto do jogador) nunca é enviado.
import { inject, track } from '@vercel/analytics';
import type { GameAction, GameState, Screen } from '../state';

type Props = Record<string, string | number>;

/** Em dev o script só registra no console; nada é enviado. */
export const mountAnalytics = () => inject({ mode: import.meta.env.DEV ? 'development' : 'production' });

/** O resumo da campanha, mesmo quando vem depois de uma fila de cenas (vitória final). */
function summaryOf(s: Screen) {
  const t = s.name === 'scene' ? s.next : s;
  return t.name === 'summary' ? t.summary : null;
}

/** Eventos que a transição `prev → next` (causada por `a`) gerou. Função pura. */
export function gameEvents(prev: GameState, next: GameState, a: GameAction): [string, Props][] {
  const was = prev.run, run = next.run;
  if (a.type === 'startRun' && run) return [['run_start', { class: run.classId, level: run.level }]];
  if (a.type === 'startAct' && run) return [['act_start', { class: run.classId, act: a.act, level: run.level }]];
  if ((a.type === 'restartAct' || a.type === 'abandon') && was) {
    return [['run_restart', { class: was.classId, arena: was.arenaId, titles: was.titles.length, to: a.type === 'abandon' ? 'title' : 'act' }]];
  }
  const summary = was ? summaryOf(next.screen) : null;
  if (summary) {
    const r = summary.run;
    return [['run_end', { result: summary.result, class: r.classId, arena: r.arenaId, titles: r.titles.length, days: r.daysSpent, level: summary.levelAfter }]];
  }
  if (was && run && run.titles.length > was.titles.length) return [['arena_won', { class: run.classId, arena: run.titles.at(-1)!, day: was.day }]];
  return [];
}

/** Chamado por `dispatch` a cada transição que mudou o estado. */
export const trackTransition = (prev: GameState, next: GameState, a: GameAction) => {
  for (const [name, props] of gameEvents(prev, next, a)) track(name, props);
};
