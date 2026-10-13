import type { BetDef, GoalDef, GoalId } from './types';

/** Objetivos de luta (conferidos em engine/combat.ts, `goalMet`): Exigências da Plebe e apostas usam os mesmos. */
export const GOALS: Record<GoalId, GoalDef> = {
  win: { id: 'win', text: 'Vença a luta' },
  noItems: { id: 'noItems', text: 'Vença sem usar itens da bolsa' },
  broke: { id: 'broke', text: 'Desequilibre o adversário' },
  quick: { id: 'quick', text: 'Vença em até 5 rodadas' },
  execute: { id: 'execute', text: 'Execute o adversário' },
  perfectBlock: { id: 'perfectBlock', text: 'Bloqueie um golpe pesado' },
  healthy: { id: 'healthy', text: 'Vença com metade da vida ou mais' },
};

/** O que a multidão pode exigir numa luta comum (golpe pesado só contra quem tem golpe pesado). */
export const DEMAND_GOALS: GoalId[] = ['noItems', 'broke', 'quick', 'execute', 'perfectBlock', 'healthy'];

/** Apostas da Sabina, na ordem da vitrine. */
export const BETS: BetDef[] = [
  { id: 'win', goal: 'win', odds: 1.5 },
  { id: 'healthy', goal: 'healthy', odds: 2 },
  { id: 'quick', goal: 'quick', odds: 2.5 },
];
