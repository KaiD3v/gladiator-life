import { describe, expect, it } from 'vitest';
import { CLASSES, CROWD, ENEMIES } from '../data';
import { NO_PERKS, actionsFor, addStatus, canUse, createCombat, crowdView, makeFighter, resolveRound, verdictAvailable, type CombatState } from './combat';

const hero = (cls: keyof typeof CLASSES = 'warrior') => {
  const c = CLASSES[cls];
  const p = makeFighter('Herói', 'player', { ...c.stats, crit: 0 }, { ...NO_PERKS, ...c.perks }, { ...c.attrs }, [...c.skills]);
  p.glory = c.glory;
  return p;
};
const foe = (id = 'bandit', pattern?: string[]) => {
  const e = ENEMIES[id];
  const f = makeFighter(e.name, 'enemy', { ...e.stats, crit: 0, maxHp: 9999 }, { ...NO_PERKS, ...e.perks }, { ...e.attrs }, [...e.skills], undefined, pattern ?? [...e.pattern]);
  return f;
};
const fight = (p = hero(), e = foe(), seed = 1, boss = false) => createCombat(p, e, seed, { boss });
const withCrowd = (s: CombatState, crowd: number) => ({ ...s, crowd });

describe('torcida: ganhos e perdas', () => {
  it('começa em CROWD.start e todo evento do log carrega um instantâneo', () => {
    const s = resolveRound(fight(), 'attack');
    expect(s.crowd).toBe(CROWD.start);
    expect(s.log.every((l) => typeof l.crowd === 'number')).toBe(true);
  });

  it('crítico do jogador +10 (registrado no evento), limitado a 100', () => {
    const p = hero('assassin');
    p.stats.crit = 1;
    const s = resolveRound(fight(p), 'attack');
    expect(s.crowd).toBe(CROWD.start + CROWD.crit);
    expect(s.log.find((l) => l.crit)?.crowdDelta).toBe(CROWD.crit);
    expect(resolveRound(withCrowd(fight(p), 95), 'attack').crowd).toBe(100);
  });

  it('crítico sofrido −5; fuga fracassada −15; piso em 0', () => {
    const e = foe('bandit', ['attack']);
    e.stats.crit = 1;
    const s = resolveRound(fight(hero(), e), 'attack');
    expect(s.crowd).toBe(CROWD.start + CROWD.critTaken);
    const p = hero();
    p.attrs.dex = -50;
    const f = resolveRound(fight(p, foe('bandit', ['defend'])), 'flee');
    expect(f.crowd).toBe(CROWD.start + CROWD.failedFlee);
    expect(resolveRound(withCrowd(fight(p, foe('bandit', ['defend'])), 5), 'flee').crowd).toBe(0);
  });

  it('atordoar o inimigo +8; atordoar quem prepara golpe pesado soma +10', () => {
    let plain = 0, prep = 0;
    for (let seed = 1; seed < 40; seed++) {
      const a = resolveRound(fight(hero(), foe('bandit', ['attack']), seed), 'shieldBash');
      if (a.enemy.statuses.some((x) => x.id === 'stun')) { plain++; expect(a.log.find((l) => l.text.includes('Atordoado'))?.crowdDelta).toBe(CROWD.stun); }
      const b = resolveRound(fight(hero(), foe('brute', ['smash']), seed), 'shieldBash');
      if (b.log.some((l) => l.text.includes('Atordoado') && l.kind === 'status' && l.crowdDelta)) { prep++; expect(b.crowd).toBe(CROWD.start + CROWD.stun + CROWD.interrupt); }
    }
    expect(plain).toBeGreaterThan(0);
    expect(prep).toBeGreaterThan(0);
  });

  it('contra-ataque do jogador +6', () => {
    let n = 0;
    for (let seed = 1; seed < 40; seed++) {
      const s = resolveRound(fight(hero(), foe('bandit', ['attack']), seed), 'defend');
      const c = s.log.find((l) => l.text.includes('contra-ataca'));
      if (!c) continue;
      n++;
      expect(c.crowdDelta).toBe(CROWD.counter);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('defesa perfeita: defender na rodada em que o golpe pesado acerta +12', () => {
    let s = fight(hero('assassin'), foe('brute', ['smash']));
    s = resolveRound(s, 'attack'); // rodada de preparo
    expect(s.intent.prep).toBeFalsy();
    expect(s.crowd).toBe(CROWD.start);
    s = resolveRound(s, 'defend');
    expect(s.crowd).toBe(CROWD.start + CROWD.perfectBlock);
  });

  it('ação diferente da anterior +3 (só ataque/habilidade); repetir 3+ vezes −6 a cada rodada', () => {
    let s = resolveRound(fight(hero('mage'), foe('bandit', ['defend'])), 'attack');
    expect(s.crowd).toBe(CROWD.start); // primeira ação: sem bônus
    s = resolveRound(s, 'fireball');
    expect(s.crowd).toBe(CROWD.start + CROWD.variety);
    const base = s.crowd;
    s = resolveRound(s, 'attack');
    expect(s.crowd).toBe(base + CROWD.variety);
    s = resolveRound(s, 'attack'); // repetição 2: sem efeito
    expect(s.crowd).toBe(base + CROWD.variety);
    s = resolveRound(s, 'attack'); // repetição 3
    expect(s.crowd).toBe(base + CROWD.variety + CROWD.repeat);
    s = resolveRound(s, 'attack'); // repetição 4
    expect(s.crowd).toBe(base + CROWD.variety + 2 * CROWD.repeat);
  });

  it('defender quando o inimigo só defende/prepara é covardia −5; contra dano real não', () => {
    expect(resolveRound(fight(hero(), foe('bandit', ['defend'])), 'defend').crowd).toBe(CROWD.start + CROWD.coward);
    expect(resolveRound(fight(hero(), foe('brute', ['smash'])), 'defend').crowd).toBe(CROWD.start + CROWD.coward);
    const s = resolveRound(fight(hero(), foe('bandit', ['attack']), 3), 'defend');
    expect(s.crowd).toBeGreaterThanOrEqual(CROWD.start); // pode ganhar contra-ataque, nunca perde
  });

  it('só avisa ao cruzar marcos', () => {
    const p = hero('assassin');
    p.stats.crit = 1;
    const up = resolveRound(withCrowd(fight(p), 45), 'attack');
    expect(up.log.filter((l) => l.text === 'A multidão está com você!')).toHaveLength(1);
    const quiet = resolveRound(withCrowd(fight(p), 60), 'attack');
    expect(quiet.log.some((l) => l.text.startsWith('A multidão'))).toBe(false);
    expect(crowdView(up).label).toBe('Animada');
  });
});

describe('ovação', () => {
  it('com favor ≥ 50 o jogador causa +10% de dano', () => {
    const dmg = (crowd: number) => {
      const p = hero();
      p.stats.atk = 200;
      return resolveRound(withCrowd(fight(p), crowd), 'attack').log.find((l) => l.kind === 'player' && l.amount)!.amount!;
    };
    const lo = dmg(CROWD.ovationAt - 1), hi = dmg(CROWD.ovationAt);
    expect(hi / lo).toBeCloseTo(1 + CROWD.ovationBonus, 1);
    expect(crowdView(withCrowd(fight(), 50)).ovation).toBe(true);
    expect(crowdView(withCrowd(fight(), 49)).ovation).toBe(false);
  });
});

describe('Golpe de Glória', () => {
  it('ordem estável das ações e disponibilidade só com a torcida em 100', () => {
    const s = fight();
    expect(actionsFor(s.player, s)).toEqual(['attack', 'shieldBash', 'ironStance', 'pitFury', 'defend', 'flee']);
    expect(actionsFor(makeFighter('x', 'player', s.player.stats, NO_PERKS, s.player.attrs, ['a']))).toEqual(['attack', 'a', 'defend', 'flee']);
    const low = withCrowd(s, 99);
    expect(canUse(low, 'pitFury')).toBe(false);
    expect(resolveRound(low, 'pitFury')).toBe(low);
    expect(canUse(withCrowd(s, 100), 'pitFury')).toBe(true);
    expect(crowdView(withCrowd(s, 100)).gloryReady).toBe(true);
  });

  it('usar consome o favor (cai para 40) e tem o efeito da classe', () => {
    const w = resolveRound(withCrowd(fight(hero('warrior'), foe('bandit', ['attack'])), 100), 'pitFury');
    expect(w.crowd).toBe(CROWD.gloryDrop);
    expect(w.log.some((l) => l.text.includes('Atordoado'))).toBe(true);
    expect(canUse(w, 'pitFury')).toBe(false);
    const m = resolveRound(withCrowd(fight(hero('mage'), foe('bandit', ['attack'])), 100), 'arenaInferno');
    expect(m.enemy.statuses.some((x) => x.id === 'burn')).toBe(true);
    const a = resolveRound(withCrowd(fight(hero('assassin'), foe('bandit', ['attack'])), 100), 'thousandCuts');
    expect(a.log.filter((l) => l.kind === 'player' && l.amount)).toHaveLength(4);
  });
});

describe('"A multidão exige mais!"', () => {
  const lethal = (crowd: number, hp = 1) => {
    const p = hero();
    p.hp = hp;
    return resolveRound(withCrowd(fight(p, foe('bandit', ['attack'])), crowd), 'attack');
  };

  it('salva com 1 de vida, custa 40 de favor e só acontece uma vez por luta', () => {
    const s = lethal(80);
    expect(s.outcome).toBeNull();
    expect(s.player.hp).toBe(1);
    expect(s.crowd).toBe(80 - CROWD.lastStandCost);
    expect(s.lastStandUsed).toBe(true);
    expect(s.log.some((l) => l.text.startsWith('A multidão exige mais!'))).toBe(true);
    expect(crowdView(s).lastStandReady).toBe(false);
    const again = resolveRound({ ...s, crowd: 100 }, 'attack');
    expect(again.outcome).toBe('defeat');
  });

  it('sem favor suficiente a morte vale; veneno também é salvo; empate continua empate', () => {
    expect(lethal(69).outcome).toBe('defeat');
    const p = hero();
    p.hp = 2;
    addStatus(p, 'poison', 2, 5);
    const s = fight(p, foe('bandit', ['defend']));
    const dot = resolveRound(withCrowd(s, 90), 'defend');
    expect(dot.outcome).toBeNull();
    expect(dot.player.hp).toBe(1);
    const q = hero();
    q.hp = 3;
    addStatus(q, 'poison', 2, 5);
    const e = foe('bandit', ['defend']);
    e.hp = 3;
    addStatus(e, 'poison', 2, 5);
    expect(resolveRound(withCrowd(fight(q, e), 10), 'defend').outcome).toBe('draw');
  });
});

describe('veredito (polegar)', () => {
  const low = (boss = false, hp = 0.15) => {
    const e = foe('bandit', ['attack']);
    e.stats.maxHp = 100;
    e.hp = Math.round(100 * hp);
    return fight(hero(), e, 1, boss);
  };

  it('só em luta comum com o inimigo em ≤ 15% da vida; ordem estável no fim', () => {
    expect(verdictAvailable(low())).toBe(true);
    expect(actionsFor(low().player, low())).toEqual(['attack', 'shieldBash', 'ironStance', 'pitFury', 'defend', 'flee', 'execute', 'spare']);
    expect(verdictAvailable(low(false, 0.16))).toBe(false);
    const boss = low(true);
    expect(verdictAvailable(boss)).toBe(false);
    expect(resolveRound(boss, 'execute')).toBe(boss);
    const mid = low(false, 0.5);
    expect(resolveRound(mid, 'spare')).toBe(mid);
  });

  it('chefe julgável (trial) aceita veredito; os outros chefes não', () => {
    const e = foe('bandit', ['attack']);
    e.stats.maxHp = 100;
    e.hp = 10;
    const trial = createCombat(hero(), e, 1, { boss: true, trial: true });
    expect(verdictAvailable(trial)).toBe(true);
    expect(resolveRound(trial, 'spare')).toMatchObject({ outcome: 'victory', verdict: 'spared' });
  });

  it('executar: vitória imediata, inimigo morto, +15 de favor, sem o inimigo agir', () => {
    const s = resolveRound(low(), 'execute');
    expect(s).toMatchObject({ outcome: 'victory', verdict: 'executed', round: 1 });
    expect(s.enemy.hp).toBe(0);
    expect(s.crowd).toBe(CROWD.start + CROWD.execute);
    expect(s.log.some((l) => l.kind === 'enemy')).toBe(false);
    expect(resolveRound(s, 'attack')).toBe(s);
  });

  it('poupar: vitória imediata, inimigo continua vivo', () => {
    const before = low();
    const s = resolveRound(before, 'spare');
    expect(s).toMatchObject({ outcome: 'victory', verdict: 'spared' });
    expect(s.enemy.hp).toBe(before.enemy.hp);
    expect(s.crowd).toBe(CROWD.start);
    expect(s.log.some((l) => l.kind === 'enemy')).toBe(false);
  });
});

