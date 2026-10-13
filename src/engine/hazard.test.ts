import { describe, expect, it } from 'vitest';
import { ARENAS, CLASSES, ENEMIES, type HazardDef } from '../data';
import { NO_PERKS, createCombat, hasStatus, hazardView, makeFighter, resolveRound, type CombatState } from './combat';

const hero = () => {
  const c = CLASSES.warrior;
  return makeFighter('Herói', 'player', { ...c.stats, crit: 0, maxHp: 500 }, { ...NO_PERKS, ...c.perks }, { ...c.attrs }, [...c.skills]);
};
const foe = (pattern = ['attack']) => {
  const e = ENEMIES.bandit;
  return makeFighter('Alvo', 'enemy', { ...e.stats, crit: 0, maxHp: 9999 }, { ...NO_PERKS }, { ...e.attrs }, [...e.skills], undefined, pattern);
};
const sand: HazardDef = ARENAS[0].hazard;
const fight = (hazard: HazardDef | undefined = sand, pattern?: string[]) => createCombat(hero(), foe(pattern), 1, { hazard });
const run = (s: CombatState, ...acts: string[]) => acts.reduce(resolveRound, s);
const texts = (s: CombatState) => s.log.map((l) => l.text);

describe('perigo da arena', () => {
  it('avisa na rodada anterior, age no fim da rodada marcada e repete a cada `every`', () => {
    let s = fight();
    expect(hazardView(s)).toEqual({ name: sand.name, in: sand.first, warn: sand.warn });
    s = run(s, 'attack');
    expect(hazardView(s)?.in).toBe(2);
    expect(texts(s)).not.toContain(sand.warn);
    s = run(s, 'attack');
    expect(hazardView(s)?.in).toBe(1);
    expect(s.log.filter((l) => l.text === sand.warn).length).toBe(1);
    expect(texts(s)).not.toContain(sand.strike);
    s = run(s, 'attack');
    expect(s.log.find((l) => l.text === sand.strike)?.round).toBe(3);
    expect(hazardView(s)?.in).toBe(sand.every);
    s = run(s, 'attack', 'attack', 'attack');
    expect(s.log.filter((l) => l.text === sand.strike).length).toBe(1);
    expect(hazardView(s)?.in).toBe(1);
    s = run(s, 'attack');
    expect(s.log.filter((l) => l.text === sand.strike).length).toBe(2);
  });

  it('dano no favorito da multidão (flechas pretorianas): favor alto mira o jogador; defender protege', () => {
    const arrows: HazardDef = { id: 'x', name: 'Flechas', every: 3, first: 1, warn: 'aviso', strike: 'golpe', harm: 0.1 };
    const fav = (crowd: number, act: string, foeAct = 'defend') => {
      const s = { ...fight(arrows, [foeAct]), crowd };
      return resolveRound(s, act);
    };
    const hit = fav(80, 'attack');
    expect(hit.log.some((l) => l.text === 'Flechas: Herói -50')).toBe(true);
    expect(fav(80, 'defend').log.some((l) => l.text.startsWith('Flechas: Herói'))).toBe(false);
    expect(hit.log.find((l) => l.hazard)).toMatchObject({ text: 'golpe', hazard: 'x', sfx: 'hazard-x', target: 'player' }); // a UI mira o efeito no favorito
    expect(fav(10, 'attack', 'attack').log.some((l) => l.text === 'Flechas: Alvo -1000')).toBe(true);
    expect(fav(10, 'attack', 'defend').log.some((l) => l.text.startsWith('Flechas: Alvo'))).toBe(false);
  });

  it('quem não defende sofre o status; defender protege', () => {
    let s = run(fight(), 'attack', 'attack', 'attack');
    expect(hasStatus(s.player, 'weaken')).toBe(true);
    expect(hasStatus(s.enemy, 'weaken')).toBe(true);
    s = run(fight(), 'attack', 'attack', 'defend');
    expect(hasStatus(s.player, 'weaken')).toBe(false);
    expect(hasStatus(s.enemy, 'weaken')).toBe(true);
    expect(texts(s)).toContain('Herói se protege.');
  });

  it('Coliseu: a plateia cura o favorito (jogador com ovação, senão o inimigo)', () => {
    const h = ARENAS[1].hazard;
    const mk = (crowd: number) => {
      const s = fight(h, ['defend']);
      s.player.hp = 100; s.enemy.hp = 5000; s.crowd = crowd;
      return s;
    };
    const win = run(mk(100), 'attack', 'attack', 'attack');
    expect(win.log.some((l) => l.text.startsWith(h.name) && l.target === 'player' && l.heal)).toBe(true);
    expect(win.log.some((l) => l.text.startsWith(h.name) && l.target === 'enemy')).toBe(false);
    const lose = run(mk(0), 'attack', 'attack', 'attack');
    expect(lose.log.some((l) => l.text.startsWith(h.name) && l.target === 'enemy' && l.heal)).toBe(true);
    expect(lose.log.some((l) => l.text.startsWith(h.name) && l.target === 'player')).toBe(false);
  });

  it('sem perigo: hazardView nulo; ação inválida devolve o mesmo objeto', () => {
    const s = createCombat(hero(), foe(), 1);
    expect(hazardView(s)).toBeNull();
    expect(resolveRound(s, 'nao-existe')).toBe(s);
    const f = fight();
    expect(resolveRound(f, 'nao-existe')).toBe(f);
  });
});

describe('sons e variedade de texto', () => {
  it('preparo do inimigo = windup', () => {
    const r = resolveRound(fight(undefined, ['smash']), 'attack');
    expect(r.log.find((l) => l.text.includes('se prepara'))?.sfx).toBe('windup');
  });

  it('fuga fracassada = crowd-boo', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = resolveRound(createCombat(hero(), foe(), seed), 'flee');
      const fail = r.log.find((l) => l.text.includes('bloqueia a saída'));
      if (fail) return expect(fail.sfx).toBe('crowd-boo');
    }
    throw new Error('nenhuma fuga falhou nas sementes testadas');
  });

  it('verbo do ataque básico varia, mas é determinístico', () => {
    const verbs = (s: CombatState) => s.log.filter((l) => l.kind === 'player' && l.amount).map((l) => l.text.split(' ')[1]);
    const a = verbs(run(fight(undefined), 'attack', 'attack', 'attack', 'attack'));
    const b = verbs(run(fight(undefined), 'attack', 'attack', 'attack', 'attack'));
    expect(a).toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(1);
  });
});
