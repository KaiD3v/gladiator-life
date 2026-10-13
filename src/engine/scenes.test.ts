import { describe, expect, it } from 'vitest';
import { ACTS, ARENAS, ENEMIES, SCENES, type SceneEvent } from '../data';
import { beatView, sameEvent, sceneAmbience, sceneAssets, sceneTrack, scenesFor } from './scenes';

describe('scenesFor', () => {
  it('cada gatilho resolve para a cena esperada', () => {
    const cases: [SceneEvent, string[]][] = [
      [{ on: 'campaign-start' }, ['prologue-village']],
      [{ on: 'run-start' }, ['prologue-ludus']],
      [{ on: 'boss-intro', boss: 'tauros' }, ['boss-intro-tauros']],
      [{ on: 'boss-defeat', boss: 'serpent' }, ['boss-defeat-serpent']],
      [{ on: 'arena-enter', arena: 'crimson' }, ['transfer-crimson']],
      [{ on: 'act-won', act: 'chains' }, ['epilogue']],
      [{ on: 'arena-enter', arena: 'naumachia' }, ['act2-opening']],
      [{ on: 'act-won', act: 'oath' }, ['act2-finale']],
      [{ on: 'boss-intro', boss: 'ninguem' }, []],
    ];
    for (const [event, ids] of cases) expect(scenesFor(event), JSON.stringify(event)).toEqual(ids);
  });

  it('cena once já vista não toca de novo; as demais ignoram seen', () => {
    expect(scenesFor({ on: 'boss-intro', boss: 'tauros' }, ['boss-intro-tauros'])).toEqual([]);
    expect(scenesFor({ on: 'boss-defeat', boss: 'tauros' }, ['boss-defeat-tauros'])).toEqual(['boss-defeat-tauros']);
  });

  it('derrota de chefe julgável toca a cena do veredito; sem veredito na run, nenhuma', () => {
    const ev = { on: 'boss-defeat', boss: 'draco' } as const;
    expect(scenesFor(ev, [], { draco: 'spared' })).toEqual(['boss-spared-draco']);
    expect(scenesFor(ev, [], { draco: 'executed' })).toEqual(['boss-executed-draco']);
    expect(scenesFor(ev)).toEqual([]);
  });

  it('cada cena tem um gatilho único e a campanha inteira tem cena para os seus eventos', () => {
    const keys = Object.values(SCENES).map((s) => JSON.stringify([s.trigger, s.when]));
    expect(new Set(keys).size).toBe(keys.length);
    expect(scenesFor({ on: 'campaign-start' })).toHaveLength(1);
    expect(scenesFor({ on: 'run-start' })).toHaveLength(1);
    for (const act of ACTS) expect(scenesFor({ on: 'act-won', act: act.id }), act.id).toHaveLength(1);
    ARENAS.forEach((a, i) => {
      expect(scenesFor({ on: 'boss-intro', boss: a.boss }), a.boss).toHaveLength(1);
      if (ENEMIES[a.boss].trial) {
        for (const v of ['spared', 'executed'] as const) expect(scenesFor({ on: 'boss-defeat', boss: a.boss }, [], { [a.boss]: v }), `${a.boss} ${v}`).toHaveLength(1);
      } else expect(scenesFor({ on: 'boss-defeat', boss: a.boss }), a.boss).toHaveLength(1);
      expect(scenesFor({ on: 'arena-enter', arena: a.id }), a.id).toHaveLength(i > 0 ? 1 : 0);
    });
  });
});

describe('beatView', () => {
  const hero = { name: 'Ana <b>', classId: 'mage' as const };

  it('interpola {nome} e {classe} sem escapar HTML; o herói fala com nome e retrato da classe', () => {
    const queue = ['prologue-ludus'];
    const beats = SCENES[queue[0]].beats;
    const views = beats.map((_, i) => beatView(queue, i, hero));
    const heroView = views[beats.findIndex((b) => b.who === 'hero')];
    expect(heroView.speaker).toBe('Ana <b>');
    expect(heroView.portrait).toBe('mage');
    expect(views.every((v) => !/\{(nome|classe)\}/.test(v.text))).toBe(true);
    expect(views.some((v) => v.text.includes('Ana <b>'))).toBe(true);
  });

  it('sem herói o nome é "Você"', () => {
    const queue = ['prologue-village'];
    const i = SCENES[queue[0]].beats.findIndex((b) => b.who === 'hero');
    expect(beatView(queue, i, null).speaker).toBe('Você');
  });

  it('fundo troca a partir da fala com bg; falas restantes contam a fila toda', () => {
    const q = ['prologue-village'];
    const beats = SCENES[q[0]].beats;
    const k = beats.findIndex((b) => b.bg);
    expect(beatView(q, 0, null).bg).toBe(SCENES[q[0]].bg);
    expect(beatView(q, k, null).bg).toBe(beats[k].bg);
    expect(beatView(q, beats.length - 1, null).remaining).toBe(0);
    expect(beatView([...q, 'prologue-ludus'], 0, null).remaining).toBe(beats.length + SCENES['prologue-ludus'].beats.length - 1);
  });
});

describe('assets e música', () => {
  it('sceneAssets lista fundos e retratos sem repetição', () => {
    const a = sceneAssets(['prologue-village', 'prologue-ludus']);
    expect(new Set(a).size).toBe(a.length);
    expect(a).toContain(SCENES['prologue-village'].bg);
  });

  it('sceneTrack usa a música da cena ou menu', () => {
    expect(sceneTrack(['boss-intro-tauros'])).toBe('boss');
    expect(sceneTrack(['epilogue'])).toBe('menu');
  });

  it('sceneAmbience segue a cena e as trocas por fala; cena sem ambiente fica em silêncio', () => {
    const last = SCENES['prologue-village'].beats.length - 1;
    expect(sceneAmbience(['prologue-village'], 0)).toBe('village-raid');
    expect(sceneAmbience(['prologue-village'], last)).toBeNull(); // estrada: o ataque ficou para trás
    expect(sceneAmbience(['boss-intro-tauros'], 2)).toBe('arena-crowd');
    expect(sceneAmbience(['prologue-ludus'], 0)).toBeNull();
    expect(sceneAmbience(['boss-defeat-emperor'], 0)).toBeNull(); // a Arena Rubra fica em silêncio
  });
});

describe('sameEvent', () => {
  it('compara campo a campo: a ordem das chaves nos dados não importa', () => {
    const reordered = { boss: 'tauros', on: 'boss-intro' } as SceneEvent;
    expect(sameEvent(reordered, { on: 'boss-intro', boss: 'tauros' })).toBe(true);
    expect(sameEvent({ on: 'boss-intro', boss: 'tauros' }, { on: 'boss-intro', boss: 'serpent' })).toBe(false);
    expect(sameEvent({ on: 'boss-defeat', boss: 'tauros' }, { on: 'boss-intro', boss: 'tauros' })).toBe(false);
    expect(sameEvent({ on: 'campaign-won' }, { on: 'campaign-start' })).toBe(false);
  });
});
