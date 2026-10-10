import { describe, expect, it } from 'vitest';
import { ARENAS, SCENES, type SceneEvent } from '../data';
import { beatView, sceneAssets, sceneTrack, scenesFor } from './scenes';

describe('scenesFor', () => {
  it('cada gatilho resolve para a cena esperada', () => {
    const cases: [SceneEvent, string[]][] = [
      [{ on: 'campaign-start' }, ['prologue-village']],
      [{ on: 'run-start' }, ['prologue-ludus']],
      [{ on: 'boss-intro', boss: 'tauros' }, ['boss-intro-tauros']],
      [{ on: 'boss-defeat', boss: 'serpent' }, ['boss-defeat-serpent']],
      [{ on: 'arena-enter', arena: 'crimson' }, ['transfer-crimson']],
      [{ on: 'campaign-won' }, ['epilogue']],
      [{ on: 'boss-intro', boss: 'ninguem' }, []],
    ];
    for (const [event, ids] of cases) expect(scenesFor(event), JSON.stringify(event)).toEqual(ids);
  });

  it('cena once já vista não toca de novo; as demais ignoram seen', () => {
    expect(scenesFor({ on: 'boss-intro', boss: 'tauros' }, ['boss-intro-tauros'])).toEqual([]);
    expect(scenesFor({ on: 'boss-defeat', boss: 'tauros' }, ['boss-defeat-tauros'])).toEqual(['boss-defeat-tauros']);
  });

  it('cada cena tem um gatilho único e a campanha inteira tem cena para os seus eventos', () => {
    const keys = Object.values(SCENES).map((s) => JSON.stringify(s.trigger));
    expect(new Set(keys).size).toBe(keys.length);
    expect(scenesFor({ on: 'campaign-start' })).toHaveLength(1);
    expect(scenesFor({ on: 'run-start' })).toHaveLength(1);
    expect(scenesFor({ on: 'campaign-won' })).toHaveLength(1);
    ARENAS.forEach((a, i) => {
      expect(scenesFor({ on: 'boss-intro', boss: a.boss }), a.boss).toHaveLength(1);
      expect(scenesFor({ on: 'boss-defeat', boss: a.boss }), a.boss).toHaveLength(1);
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
});
