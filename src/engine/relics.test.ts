import { describe, expect, it } from 'vitest';
import { ALLY, ARENAS, CLASSES, CROWD, ENEMIES, RELIC, type Perks } from '../data';
import { NO_PERKS, actionsFor, addStatus, canUse, createCombat, demandView, goalMet, hasStatus, makeFighter, resolveRound, type CombatState } from './combat';

const hero = (perks: Partial<Perks> = {}, extra: { crit?: number; ally?: string } = {}) => {
  const c = CLASSES.warrior;
  const f = makeFighter('Herói', 'player', { ...c.stats, crit: extra.crit ?? 0, maxHp: 200 }, { ...NO_PERKS, ...c.perks, ...perks }, { ...c.attrs }, [...c.skills]);
  return { ...f, glory: c.glory, ...(extra.ally ? { ally: extra.ally } : {}) };
};
const foe = (pattern = ['attack'], id = 'bandit') => {
  const e = ENEMIES[id];
  return makeFighter('Alvo', 'enemy', { ...e.stats, crit: 0, maxHp: 500 }, { ...NO_PERKS }, { ...e.attrs }, [...e.skills], undefined, pattern, { maxPosture: e.posture, weak: [...e.weak] });
};
const run = (s: CombatState, ...acts: string[]) => acts.reduce(resolveRound, s);
const texts = (s: CombatState) => s.log.map((l) => l.text);

describe('relíquias (gatilhos)', () => {
  it('sem relíquia o início da luta não sorteia nada (mesma sequência de antes)', () => {
    expect(createCombat(hero(), foe(), 77).seed).toBe(77);
  });

  it('Rede do Retiário: atordoa no início (com chance 1); o inimigo perde a primeira vez', () => {
    const s = createCombat(hero({ openingStun: 1 }), foe(), 1);
    expect(hasStatus(s.enemy, 'stun')).toBe(true);
    expect(run(s, 'defend').log.some((l) => l.text === 'Alvo está atordoado e perde a vez.')).toBe(true);
  });

  it('Olho do Áugure: todos os pontos fracos começam revelados', () => {
    const s = createCombat(hero({ insight: 1 }), foe(), 1);
    expect(s.revealed).toEqual(ENEMIES.bandit.weak);
  });

  it('Dente de Crocodilo e Gládio Pretoriano: dano extra contra envenenado e Desequilibrado', () => {
    const dealt = (perks: Partial<Perks>, status: 'poison' | 'broken') => {
      const s = createCombat(hero(perks), foe(['attack']), 5);
      s.player.stats.atk = 200; // dano grande: o arredondamento não atrapalha a proporção
      addStatus(s.enemy, status, 3, status === 'poison' ? 1 : 0);
      return run(s, 'attack').dealt - (status === 'poison' ? 1 : 0); // tira o tique do veneno
    };
    expect(dealt({ dotHunter: 0.3 }, 'poison') / dealt({}, 'poison')).toBeCloseTo(1.3, 1);
    expect(dealt({ brokenHunter: 0.3 }, 'broken') / dealt({}, 'broken')).toBeCloseTo(1.8 / 1.5, 1);
  });

  it('Coroa de Louros: cada crítico rende favor extra', () => {
    const crowd = (perks: Partial<Perks>) => run(createCombat(hero(perks, { crit: 1 }), foe(['defend']), 3), 'attack').crowd;
    expect(crowd({ critCrowd: 5 }) - crowd({})).toBe(5);
    expect(crowd({}) - CROWD.start).toBe(CROWD.crit);
  });

  it('Juba de Leão: abaixo do limite entra em guarda e regenera, uma vez por luta', () => {
    const s = createCombat(hero({ rally: 1 }), foe(['defend']), 2);
    s.player.hp = Math.floor(s.player.stats.maxHp * RELIC.rallyAt) - 1;
    const r = run(s, 'attack');
    expect(r.rallied).toBe(true);
    expect(hasStatus(r.player, 'guard') || r.log.some((l) => l.text.startsWith('Juba de Leão'))).toBe(true);
    expect(r.log.filter((l) => l.text.startsWith('Juba de Leão')).length).toBe(1);
    expect(run(r, 'attack', 'attack').log.filter((l) => l.text.startsWith('Juba de Leão')).length).toBe(1);
  });

  it('Escudo Pretoriano: defender o golpe pesado devolve parte do golpe', () => {
    const strike = (perks: Partial<Perks>) => run(createCombat(hero(perks), foe(['smash'], 'brute'), 4), 'attack', 'defend');
    expect(strike({ blockReflect: 0.5 }).log.some((l) => l.text.startsWith('Herói devolve o golpe com o escudo'))).toBe(true);
    expect(strike({}).log.some((l) => l.text.startsWith('Herói devolve'))).toBe(false);
  });

  it('Âncora das Marés: imune ao perigo da arena', () => {
    const sand = ARENAS[0].hazard;
    const s = run(createCombat(hero({ anchor: 1 }), foe(), 1, { hazard: sand }), 'attack', 'attack', 'attack');
    expect(hasStatus(s.player, 'weaken')).toBe(false);
    expect(hasStatus(s.enemy, 'weaken')).toBe(true);
    expect(texts(s)).toContain('Herói segue firme (Âncora).');
  });
});

describe('Chamado de Tauros (aliado)', () => {
  it('fica depois da Glória na ordem fixa; exige multidão e vale uma vez por luta; abala a postura', () => {
    const s = createCombat(hero({}, { ally: 'taurosCharge' }), foe(['defend']), 9);
    expect(actionsFor(s.player, s)).toEqual(['attack', 'shieldBash', 'ironStance', 'pitFury', 'taurosCharge', 'defend', 'flee']);
    expect(canUse(s, 'taurosCharge')).toBe(false);
    const hot = { ...s, crowd: ALLY.crowdAt };
    expect(canUse(hot, 'taurosCharge')).toBe(true);
    const r = resolveRound(hot, 'taurosCharge');
    expect(r.allyUsed).toBe(true);
    expect(r.log.some((l) => l.text.startsWith('Herói chama Tauros, que investe contra Alvo'))).toBe(true);
    expect(r.enemy.posture).toBeLessThan(s.enemy.posture);
    expect(canUse({ ...r, crowd: 100 }, 'taurosCharge')).toBe(false);
    expect(actionsFor(hero(), s)).not.toContain('taurosCharge'); // sem aliado no ato, sem botão
  });
});

describe('objetivos de luta (Exigências e apostas)', () => {
  const win = (s: CombatState, patch: Partial<CombatState> = {}) => ({ ...s, outcome: 'victory' as const, ...patch });

  it('goalMet confere cada objetivo só na vitória', () => {
    const s = createCombat(hero(), foe(), 1);
    expect(goalMet('win', s)).toBe(false);
    expect(goalMet('win', win(s))).toBe(true);
    expect(goalMet('noItems', win(s, { feats: ['item'] }))).toBe(false);
    expect(goalMet('broke', win(s, { feats: ['broken'] }))).toBe(true);
    expect(goalMet('quick', win(s, { round: 6 }))).toBe(false);
    expect(goalMet('execute', win(s, { verdict: 'executed' }))).toBe(true);
    expect(goalMet('perfectBlock', win(s, { feats: ['perfectBlock'] }))).toBe(true);
    expect(goalMet('healthy', win({ ...s, player: { ...s.player, hp: 50 } }))).toBe(false);
  });

  it('a Exigência é anunciada, acompanha a luta e é conferida na vitória', () => {
    let s = createCombat(hero(), foe(), 1, { demand: 'noItems' });
    expect(texts(s)).toContain('A multidão exige: Vença sem usar itens da bolsa.');
    expect(demandView(s)).toEqual({ goal: 'noItems', state: 'open' });
    s = { ...s, player: { ...s.player, bag: ['potion'] } };
    s = run(s, 'potion');
    expect(demandView(s)?.state).toBe('failed');
    s.enemy.hp = 1;
    s = run(s, 'attack');
    expect(s.outcome).toBe('victory');
    expect(s.demandMet).toBe(false);
    expect(texts(s)).toContain('A multidão não teve o que exigiu.');
    expect(createCombat(hero(), foe(), 1).demand).toBeUndefined();
  });
});
