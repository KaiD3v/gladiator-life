import { describe, expect, it } from 'vitest';
import { defaultSave, initialState, reduce, type GameState } from '.';
import { postureView } from '../engine/combat';

const skip = (g: GameState) => reduce(g, { type: 'skip' });
const start = () => skip(reduce(skip(reduce(initialState(defaultSave()), { type: 'newGame' })), { type: 'startRun', name: 'Teste', classId: 'warrior', seed: 7 }));

describe('bestiário da run', () => {
  it('pontos fracos descobertos voltam na próxima luta contra o mesmo inimigo', () => {
    let g = start();
    expect(g.run!.bestiary).toEqual({});
    const id = g.run!.enemies[0];
    g.run!.enemies[1] = id; // mesmo inimigo duas vezes
    g = skip(reduce(g, { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('sem combate');
    const weak = g.screen.combat.enemy.weak[0];
    expect(postureView(g.screen.combat).weak[0]).toBeNull();
    g = skip(reduce({ ...g, screen: { name: 'combat', combat: { ...g.screen.combat, outcome: 'victory', revealed: [weak] } } }, { type: 'continue' }));
    expect(g.run!.bestiary[id]).toEqual([weak]);
    g = skip(reduce(g, { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('sem combate');
    expect(postureView(g.screen.combat).weak[0]).toBe(weak);
    expect(Object.keys(g.run!.bestiary)).toEqual([id]); // outro inimigo não herda
  });
});
