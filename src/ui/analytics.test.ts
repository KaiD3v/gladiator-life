import { describe, expect, it } from 'vitest';
import { defaultSave, initialState, reduce, type GameAction, type GameState } from '../state';
import { gameEvents } from './analytics';

const skip = (g: GameState) => reduce(g, { type: 'skip' });
/** Aplica a ação e devolve o novo estado e os eventos gerados. */
const step = (g: GameState, a: GameAction) => {
  const next = reduce(g, a);
  return { next, events: gameEvents(g, next, a) };
};
const create = skip(reduce(initialState(defaultSave()), { type: 'newGame' }));
const camp = () => skip(reduce(create, { type: 'startRun', name: 'Tito', classId: 'mage', seed: 42 }));

/** Do acampamento: entra na luta atual e força o resultado. */
function fightAs(g: GameState, outcome: 'victory' | 'defeat') {
  g = skip(reduce(g, { type: 'fight' }));
  if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
  return step({ ...g, screen: { name: 'combat', combat: { ...g.screen.combat, outcome } } }, { type: 'continue' });
}

describe('eventos de analytics', () => {
  it('início de campanha, sem o nome do jogador', () => {
    const { events } = step(create, { type: 'startRun', name: 'Tito', classId: 'mage', seed: 42 });
    expect(events).toEqual([['run_start', { class: 'mage', level: 1 }]]);
    expect(JSON.stringify(events)).not.toContain('Tito');
  });

  it('voltar ao início do ato', () => {
    const dead = fightAs(camp(), 'defeat').next;
    expect(step(dead, { type: 'startAct', act: 0, seed: 1 }).events).toEqual([['act_start', { class: 'mage', act: 0, level: 1 }]]);
  });

  it('derrota encerra a campanha', () => {
    expect(fightAs(camp(), 'defeat').events).toEqual([['run_end', expect.objectContaining({ result: 'defeat', class: 'mage', titles: 0 })]]);
  });

  it('vencer o chefe conta a arena; luta comum não gera evento', () => {
    expect(fightAs(camp(), 'victory').events).toEqual([]);
    const g = camp();
    const boss = { ...g, run: { ...g.run!, encounter: g.run!.enemies.length - 1 } };
    expect(fightAs(boss, 'victory').events).toEqual([['arena_won', { class: 'mage', arena: 'pit', day: 1 }]]);
  });

  it('reiniciar não conta como fim de campanha', () => {
    expect(step(camp(), { type: 'restart' }).events).toEqual([['run_restart', { class: 'mage', arena: 'pit', titles: 0 }]]);
  });
});
