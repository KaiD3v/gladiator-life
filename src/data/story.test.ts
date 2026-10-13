import { describe, expect, it } from 'vitest';
import { ACTS, ARENAS, CHARACTERS, CLASSES, ENEMIES, ITEMS, NPCS, SKILLS, type ServiceDef } from '.';
import { defaultSave, initialState, reduce, type GameState } from '../state';
import { SCENES, SPEAKERS } from './story';

const ASSETS = new Set(Object.keys(import.meta.glob('../../public/assets/*.webp')).map((p) => p.slice('../../public/assets/'.length, -'.webp'.length)));
const asset = (name: string) => ASSETS.has(name);
const SFX = new Set(Object.keys(import.meta.glob('../../public/audio/sfx/*.mp3')).map((p) => p.slice('../../public/audio/sfx/'.length, -'.mp3'.length)));

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
  it('toda faixa de música usada por cena existe em public/audio; o prólogo usa first-scene', () => {
    const tracks = new Set(Object.keys(import.meta.glob('../../public/audio/*.mp3')).map((p) => p.slice('../../public/audio/'.length, -'.mp3'.length)));
    for (const sc of Object.values(SCENES)) if (sc.music) expect(tracks.has(sc.music), `${sc.id}: ${sc.music}`).toBe(true);
    expect(SCENES['prologue-village'].music).toBe('first-scene');
    expect(SCENES['prologue-ludus'].music).toBe('first-scene');
  });

  it('todo som ambiente usado por cena existe em public/audio/amb', () => {
    const amb = new Set(Object.keys(import.meta.glob('../../public/audio/amb/*.mp3')).map((p) => p.slice('../../public/audio/amb/'.length, -'.mp3'.length)));
    for (const sc of Object.values(SCENES)) {
      for (const a of [sc.ambience, ...sc.beats.map((b) => b.ambience)]) if (a) expect(amb.has(a), `${sc.id}: ${a}`).toBe(true);
    }
  });

  it('todo perigo de arena tem efeito visual (fx-<id>) e som (sfx/hazard-<id>.mp3)', () => {
    for (const a of ARENAS) {
      expect(asset(`fx-${a.hazard.id}`), `fx-${a.hazard.id}`).toBe(true);
      expect(SFX.has(`hazard-${a.hazard.id}`), `hazard-${a.hazard.id}`).toBe(true);
    }
  });

  it('todo aliado de ato tem sprite em public/assets', () => {
    for (const act of ACTS) if (act.features?.ally) expect(asset(SKILLS[act.features.ally].art ?? ''), act.features.ally).toBe(true);
  });

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

  it('todo equipamento tem ícone; todo acampamento tem fundo e NPCs existentes, com retrato', () => {
    for (const it of Object.values(ITEMS)) if (!it.use) expect(asset(it.id), `ícone ${it.id}`).toBe(true);
    for (const act of ACTS) {
      expect(asset(act.camp.bg), `${act.id}: ${act.camp.bg}`).toBe(true);
      expect(new Set(act.camp.npcs).size, act.id).toBe(act.camp.npcs.length);
      for (const id of act.camp.npcs) expect(NPCS[id], `${act.id}: ${id}`).toBeDefined();
      // Com o balanceamento atual, todo acampamento tem loja, estalagem e um treinador por atributo.
      const has = (s: ServiceDef) => act.camp.npcs.some((id) => NPCS[id].services.some((x) => JSON.stringify(x) === JSON.stringify(s)));
      for (const s of [{ kind: 'shop' }, { kind: 'inn' }, ...(['str', 'dex', 'wis'] as const).map((attr) => ({ kind: 'trainer', attr }))] as ServiceDef[]) {
        expect(has(s), `${act.id}: ${JSON.stringify(s)}`).toBe(true);
      }
    }
    for (const c of Object.values(CHARACTERS)) expect(asset(c.art), c.art).toBe(true);
  });

  it('NPCs: pessoa conhecida, toda reação com fala sem condição, condições só sobre chefes julgáveis', () => {
    for (const [id, npc] of Object.entries(NPCS)) {
      expect(npc.id, id).toBe(id);
      expect(CHARACTERS[npc.who], `${id}: ${npc.who}`).toBeDefined();
      expect(npc.services.length, id).toBeGreaterThan(0);
      for (const [reaction, lines] of Object.entries(npc.lines)) {
        expect(lines.some((l) => typeof l === 'string'), `${id}.${reaction}`).toBe(true);
        for (const l of lines) if (typeof l !== 'string') expect(ENEMIES[l.when.boss]?.trial, `${id}: ${l.when.boss}`).toBe(true);
      }
    }
  });

  it('todo inimigo tem sprite, habilidades conhecidas e padrão feito só delas; toda arena só usa inimigos existentes', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(asset(e.id), `sprite ${e.id}`).toBe(true);
      for (const sk of e.skills) expect(SKILLS[sk], `${e.id}: ${sk}`).toBeDefined();
      for (const a of [...e.pattern, ...(e.phase2?.pattern ?? [])]) expect(a === 'defend' || e.skills.includes(a), `${e.id}: ${a}`).toBe(true);
    }
    for (const a of ARENAS) for (const id of [...a.pool, a.boss]) expect(ENEMIES[id], `${a.id}: ${id}`).toBeDefined();
  });

  it('todo gatilho de chefe/arena aponta para um chefe/arena que existe', () => {
    for (const sc of Object.values(SCENES)) {
      const t = sc.trigger;
      if ('boss' in t) expect(ARENAS.some((a) => a.boss === t.boss), sc.id).toBe(true);
      if ('arena' in t) expect(ARENAS.some((a) => a.id === t.arena), sc.id).toBe(true);
    }
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
    // Fim do Ato I emenda no Ato II; chefes julgáveis vencidos sem veredito contam como executados.
    expect(story).toEqual([
      'boss-intro-tauros', 'boss-defeat-tauros', 'transfer-colosseum',
      'boss-intro-serpent', 'boss-defeat-serpent', 'transfer-crimson',
      'boss-intro-emperor', 'boss-defeat-emperor', 'epilogue', 'act2-opening',
      'boss-intro-nerissa', 'boss-executed-nerissa', 'transfer-venatio',
      'boss-intro-hannibal', 'boss-defeat-hannibal', 'transfer-coronation',
      'boss-intro-draco', 'boss-executed-draco', 'act2-finale',
    ]);
    expect(g.screen.name === 'summary' && g.screen.summary.result).toBe('victory');
    expect(g.save.wins).toBe(1);
  });
});
