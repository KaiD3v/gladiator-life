import { describe, expect, it } from 'vitest';
import { actionsFor } from '../engine/combat';
import { RUN_VERSION, defaultSave, initialState, parseResume, reduce, resumeSnapshot, resumeState, type GameState } from '.';

const skip = (g: GameState) => reduce(g, { type: 'skip' });
const start = () =>
  skip(reduce(skip(reduce(initialState(defaultSave()), { type: 'newGame' })), { type: 'startRun', name: 'Spartacus', classId: 'warrior', seed: 42 }));

/** Simula recarregar a página: grava, lê de volta e monta o estado inicial. */
function reload(g: GameState): GameState {
  const { resume, error } = parseResume(resumeSnapshot(g));
  expect(error).toBeUndefined();
  return resumeState(g.save, resume!);
}

describe('campanha salva entre sessões', () => {
  it('sem run não há o que salvar (título, criação, resumo)', () => {
    expect(resumeSnapshot(initialState(defaultSave()))).toBeNull();
    expect(parseResume(null)).toEqual({});
  });

  it('acampamento volta igual, inclusive a conversa aberta', () => {
    const g = reduce(start(), { type: 'talk', npc: 'merchant' });
    const r = reload(g);
    expect(r.screen).toEqual(g.screen);
    expect(r.run).toEqual(g.run);
  });

  it('combate no meio volta na mesma rodada e continua igual (mesma semente)', () => {
    let g = skip(reduce(start(), { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('sem combate');
    g = reduce(g, { type: 'act', action: 'attack' });
    const r = reload(g);
    expect(r.screen).toEqual(g.screen);
    // a mesma sequência de ações dá o mesmo resultado na sessão original e na restaurada (recarregar não muda sorteios)
    let a = g, b = r;
    for (let i = 0; i < 30 && a.screen.name === 'combat' && !a.screen.combat.outcome; i++) {
      const id = actionsFor(a.screen.combat.player, a.screen.combat)[0];
      a = reduce(a, { type: 'act', action: id });
      b = reduce(b, { type: 'act', action: id });
    }
    expect(b.screen).toEqual(a.screen);
  });

  it('cena de história volta na mesma fala', () => {
    // cena de início da run (a run já existe), uma fala adiante
    const g = reduce(reduce(skip(reduce(initialState(defaultSave()), { type: 'newGame' })), { type: 'startRun', name: 'Spartacus', classId: 'warrior', seed: 42 }), { type: 'next' });
    expect(g.screen.name).toBe('scene');
    expect(reload(g).screen).toEqual(g.screen);
  });

  it('a derrota encerra a run: não sobra campanha para continuar', () => {
    const g = skip(reduce(start(), { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('sem combate');
    const dead = reduce({ ...g, screen: { name: 'combat', combat: { ...g.screen.combat, outcome: 'defeat' } } }, { type: 'continue' });
    expect(dead.run).toBeNull();
    expect(resumeSnapshot(dead)).toBeNull();
  });

  it.each([
    ['lixo', '{lixo'],
    ['outra versão', (s: string) => s.replace(`"version":${RUN_VERSION}`, '"version":999')],
    ['item que não existe mais', (s: string) => s.replace('"items":[]', '"items":["sumiu"]')],
    ['encontro fora da lista', (s: string) => s.replace('"encounter":0', '"encounter":99')],
    ['tela sem run possível', (s: string) => s.replace(/"screen":\{.*\}\}$/, '"screen":{"name":"title"}}')],
  ])('snapshot inválido (%s) é descartado com aviso', (_, change) => {
    const raw = resumeSnapshot(start())!;
    const r = parseResume(typeof change === 'string' ? change : change(raw));
    expect(r.resume).toBeUndefined();
    expect(r.error).toBeTruthy();
  });
});
