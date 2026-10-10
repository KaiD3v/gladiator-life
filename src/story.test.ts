import { describe, expect, it } from 'vitest';
import { ARENAS, CLASSES } from './data';
import { defaultSave, initialState, reduce, type GameState } from './run';
import { SCENES, SPEAKERS } from './story';

const ASSETS = new Set(Object.keys(import.meta.glob('../public/assets/*.webp')).map((p) => p.slice('../public/assets/'.length, -'.webp'.length)));
const asset = (name: string) => ASSETS.has(name);

/** Avança fala a fala até sair da fila de cenas; devolve as cenas vistas na ordem. */
function watch(g: GameState): { g: GameState; seen: string[] } {
  const seen: string[] = [];
  while (g.screen.name === 'scene') {
    if (seen.at(-1) !== g.screen.queue[0]) seen.push(g.screen.queue[0]);
    g = reduce(g, { type: 'next' });
  }
  return { g, seen };
}

function forceFight(g: GameState, outcome: 'victory' | 'fled') {
  const r = watch(reduce(g, { type: 'fight' }));
  if (r.g.screen.name !== 'combat') throw new Error('sem combate');
  const after = watch(reduce({ ...r.g, screen: { name: 'combat', combat: { ...r.g.screen.combat, outcome } } }, { type: 'continue' }));
  return { g: after.g, intro: r.seen, after: after.seen };
}

describe('dados da história', () => {
  it('toda fala tem personagem conhecido e todo fundo/retrato existe em public/assets', () => {
    for (const sc of Object.values(SCENES)) {
      expect(sc.beats.length, sc.id).toBeGreaterThan(0);
      expect(asset(sc.bg), `${sc.id}: ${sc.bg}`).toBe(true);
      for (const b of sc.beats) {
        expect(SPEAKERS[b.who], `${sc.id}: ${b.who}`).toBeDefined();
        if (b.bg) expect(asset(b.bg), b.bg).toBe(true);
      }
    }
    for (const sp of Object.values(SPEAKERS)) if (sp.art) expect(asset(sp.art), sp.art).toBe(true);
    for (const c of Object.keys(CLASSES)) expect(asset(c)).toBe(true); // retrato do herói
  });

  it('cada arena tem chegada e derrota do chefe; cada arena depois da primeira tem transferência', () => {
    ARENAS.forEach((a, i) => {
      expect(SCENES[`boss-intro-${a.boss}`], a.boss).toBeDefined();
      expect(SCENES[`boss-defeat-${a.boss}`], a.boss).toBeDefined();
      if (i > 0) expect(SCENES[`transfer-${a.id}`], a.id).toBeDefined();
    });
  });
});

describe('ordem das cenas', () => {
  it('Nova campanha: vila atacada -> registro (criação) -> chegada ao ludus -> acampamento', () => {
    let r = watch(reduce(initialState(defaultSave()), { type: 'newGame' }));
    expect(r.seen).toEqual(['prologue-village']);
    expect(r.g.screen.name).toBe('create');
    r = watch(reduce(r.g, { type: 'startRun', name: 'Ana', classId: 'mage', seed: 3 }));
    expect(r.seen).toEqual(['prologue-ludus']);
    expect(r.g.screen.name).toBe('camp');
  });

  it('pular encerra a fila inteira; ações de jogo são ignoradas durante a cena', () => {
    const g = reduce(initialState(defaultSave()), { type: 'newGame' });
    expect(g.screen.name).toBe('scene');
    expect(reduce(g, { type: 'fight' })).toBe(g);
    expect(reduce(g, { type: 'startRun', name: 'Ana', classId: 'mage', seed: 3 })).toBe(g);
    expect(reduce(g, { type: 'skip' }).screen.name).toBe('create');
  });

  it('campanha completa: chegada/derrota de cada chefe, transferências e epílogo antes do resumo', () => {
    let g = watch(reduce(watch(reduce(initialState(defaultSave()), { type: 'newGame' })).g, { type: 'startRun', name: 'Ana', classId: 'warrior', seed: 3 })).g;
    const story: string[] = [];
    for (const arena of ARENAS) {
      for (let i = 0; i < arena.fights; i++) g = forceFight(g, 'victory').g;
      // Fugir do chefe e voltar: a chegada só toca uma vez
      const fled = forceFight(g, 'fled');
      story.push(...fled.intro);
      const win = forceFight(fled.g, 'victory');
      expect(win.intro).toEqual([]);
      story.push(...win.after);
      g = win.g;
    }
    expect(story).toEqual([
      'boss-intro-tauros', 'boss-defeat-tauros', 'transfer-colosseum',
      'boss-intro-serpent', 'boss-defeat-serpent', 'transfer-crimson',
      'boss-intro-emperor', 'boss-defeat-emperor', 'epilogue',
    ]);
    expect(g.screen.name === 'summary' && g.screen.summary.result).toBe('victory');
    expect(g.save.wins).toBe(1);
  });
});
