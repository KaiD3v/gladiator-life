import { describe, expect, it, vi } from 'vitest';
import type { ActDef } from '../data';

// Hoje só existe o Ato I: aqui as mesmas arenas viram dois atos (Fosso | Coliseu + Arena Rubra) para testar a passagem.
vi.mock('../data/arenas', async (orig) => {
  const { ARENAS } = await orig<typeof import('../data/arenas')>();
  const ACTS: ActDef[] = [{ id: 'one', name: 'Um', arenas: ARENAS.slice(0, 1) }, { id: 'two', name: 'Dois', arenas: ARENAS.slice(1) }];
  return { ACTS, ARENAS };
});

const { defaultSave, initialState, maxHp, parseSave, reduce } = await import('.');
type GameState = import('.').GameState;

const skip = (g: GameState) => reduce(g, { type: 'skip' });
const start = () =>
  skip(reduce(skip(reduce(initialState(defaultSave()), { type: 'newGame' })), { type: 'startRun', name: 'Spartacus', classId: 'warrior', seed: 42 }));

function fightAs(g: GameState, outcome: 'victory' | 'defeat'): GameState {
  g = skip(reduce(g, { type: 'fight' }));
  if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
  return skip(reduce({ ...g, screen: { name: 'combat', combat: { ...g.screen.combat, outcome } } }, { type: 'continue' }));
}

describe('atos', () => {
  it('vencer o último chefe do ato libera o próximo e grava o herói como entrou nele; morrer volta a esse ponto', () => {
    let g = start();
    for (let i = 0; i < 3; i++) g = fightAs(g, 'victory');
    g = { ...g, run: { ...g.run!, items: ['chippedSword'], skills: ['shieldBash', 'ironStance', 'warCry'] } };
    g = fightAs(g, 'victory'); // chefe do Fosso: fim do ato 1, segue direto para o ato 2
    expect(g.screen.name).toBe('camp');
    expect(g.run!.arenaId).toBe('colosseum');
    expect(g.save.story).toHaveLength(2);
    const checkpoint = g.save.story[1];
    expect(checkpoint).toEqual(g.run);
    expect(parseSave(JSON.stringify(g.save)).save).toEqual(g.save);

    // Passar de arena dentro do ato não mexe nos checkpoints.
    for (let i = 0; i < 5; i++) g = fightAs(g, 'victory');
    expect(g.run!.arenaId).toBe('crimson');
    expect(g.save.story[1]).toBe(checkpoint);

    g = fightAs({ ...g, run: { ...g.run!, gold: 999 } }, 'defeat');
    expect(g.screen.name).toBe('summary');
    const retry = reduce(g, { type: 'startAct', act: 1, seed: 7 });
    expect(retry.run).toMatchObject({
      arenaId: 'colosseum', titles: ['pit'], items: ['chippedSword'], skills: ['shieldBash', 'ironStance', 'warCry'], gold: checkpoint.gold, encounter: 0, day: 1,
    });
    expect(retry.run!.hp).toBe(maxHp(retry.run!));
    expect(retry.run!.enemies.at(-1)).toBe('serpent');
  });

  it('rejogar um ato anterior e vencer substitui só o checkpoint seguinte', () => {
    let g = start();
    for (let i = 0; i < 4; i++) g = fightAs(g, 'victory');
    const first = g.save.story;
    g = fightAs(g, 'defeat');
    g = reduce(g, { type: 'startAct', act: 0, seed: 9 }); // volta ao ato 1 com o mesmo herói
    expect(g.run!.arenaId).toBe('pit');
    for (let i = 0; i < 4; i++) g = fightAs(g, 'victory');
    expect(g.save.story[0]).toBe(first[0]);
    expect(g.save.story[1]).not.toBe(first[1]);
    expect(g.save.story[1]).toEqual(g.run);
  });

  it('vencer o último ato completa a história e mantém os checkpoints', () => {
    let g = start();
    for (let i = 0; i < 4 + 5 + 5; i++) g = fightAs(g, 'victory');
    if (g.screen.name !== 'summary') throw new Error();
    expect(g.screen.summary.result).toBe('victory');
    expect(g.save).toMatchObject({ wins: 1, best: 3 });
    expect(g.save.story).toHaveLength(2);
  });
});
