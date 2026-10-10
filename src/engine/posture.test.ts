import { describe, expect, it } from 'vitest';
import { CLASSES, CROWD, ENEMIES, POSTURE, type EnemyDef, type WeakTag } from '../data';
import { NO_PERKS, addStatus, createCombat, hasStatus, intentView, makeFighter, postureView, resolveRound, type CombatState } from './combat';
import { createEnemyFighter } from './characters';

const hero = (cls: keyof typeof CLASSES = 'warrior', crit = 0) => {
  const c = CLASSES[cls];
  const p = makeFighter('Herói', 'player', { ...c.stats, crit, speed: 99 }, { ...NO_PERKS, ...c.perks }, { ...c.attrs }, [...c.skills]);
  p.glory = c.glory;
  return p;
};
/** Inimigo de teste: vida enorme, sem crítico, mais lento que o herói. */
const foe = (weak: WeakTag[], posture: number, pattern: string[] = ['attack'], extra: Partial<EnemyDef> = {}) => {
  const e = ENEMIES.brute;
  return makeFighter('Alvo', 'enemy', { ...e.stats, crit: 0, maxHp: 9999, speed: 1 }, { ...NO_PERKS }, { ...e.attrs }, ['attack', 'smash'], undefined, pattern,
    { maxPosture: posture, weak, ...extra });
};
const fight = (p = hero(), e = foe(['physical'], 3), seed = 1) => createCombat(p, e, seed);
const texts = (s: CombatState) => s.log.map((l) => l.text);

describe('postura: perda de pontos', () => {
  it('golpe do tipo fraco -1 e revela; tipo comum não mexe', () => {
    const s = resolveRound(fight(hero(), foe(['physical'], 3, ['defend'])), 'attack');
    expect(s.enemy.posture).toBe(2);
    expect(s.revealed).toEqual(['physical']);
    expect(texts(s)).toContain('Ponto fraco descoberto: Físico!');
    const m = resolveRound(fight(hero(), foe(['magic'], 3, ['defend'])), 'attack');
    expect(m.enemy.posture).toBe(3);
    expect(m.revealed).toEqual([]);
  });

  it('status aplicado que é ponto fraco -1 (efeito comum não conta); veneno do perk também', () => {
    const s = resolveRound(fight(hero('assassin'), foe(['poison'], 3, ['defend'])), 'venomBlade'); // físico não é fraco: só o veneno
    expect(s.enemy.posture).toBe(2);
    expect(s.revealed).toEqual(['poison']);
    const both = resolveRound(fight(hero('assassin'), foe(['physical', 'poison'], 3, ['defend'])), 'venomBlade');
    expect(both.enemy.posture).toBe(1);
    const p = hero(); p.perks.poisonOnHit = 1;
    expect(resolveRound(fight(p, foe(['poison'], 3, ['defend'])), 'attack').enemy.posture).toBe(2);
    expect(resolveRound(fight(hero('mage'), foe(['stun'], 3, ['defend'])), 'fireball').enemy.posture).toBe(3); // queimadura não é fraqueza aqui
  });

  it('crítico do jogador -1 extra em qualquer tipo, sem revelar nada', () => {
    const s = resolveRound(fight(hero('assassin', 1), foe([], 3, ['defend'])), 'attack');
    expect(s.enemy.posture).toBe(2);
    expect(s.revealed).toEqual([]);
    expect(resolveRound(fight(hero('assassin', 1), foe(['physical'], 3, ['defend'])), 'attack').enemy.posture).toBe(1);
  });

  it('Golpe de Glória quebra a postura de uma vez', () => {
    const s = resolveRound({ ...fight(hero(), foe([], 6, ['defend'])), crowd: 100 }, 'pitFury');
    expect(hasStatus(s.enemy, 'broken')).toBe(true);
    expect(s.enemy.posture).toBe(0);
  });

  it('inimigo sem postura (maxPosture 0) nunca quebra', () => {
    const s = resolveRound(fight(hero('assassin', 1), foe(['physical'], 0, ['defend'])), 'attack');
    expect(hasStatus(s.enemy, 'broken')).toBe(false);
  });
});

describe('postura: Desequilibrado', () => {
  const broke = () => resolveRound(fight(hero(), foe(['physical'], 1)), 'attack'); // herói age primeiro e quebra

  it('quebrar: status, +CROWD.broken, e o inimigo perde a vez nessa mesma rodada', () => {
    const s = broke();
    expect(hasStatus(s.enemy, 'broken')).toBe(true);
    expect(s.crowd).toBe(CROWD.start + CROWD.broken);
    expect(s.player.hp).toBe(s.player.stats.maxHp);
    expect(texts(s)).toContain('Alvo perde o equilíbrio!');
    expect(texts(s)).toContain('Alvo está desequilibrado e perde a vez.');
    expect(texts(s).some((t) => t.startsWith('Herói ataca Alvo')) && texts(s).some((t) => t.startsWith('Alvo ataca'))).toBe(false);
  });

  it('+50% de dano enquanto desequilibrado', () => {
    const h = hero(); h.stats.atk = 300; // dano alto: o arredondamento não atrapalha a razão
    const base = fight(h, foe([], 3, ['defend']));
    const broken = structuredClone(base);
    addStatus(broken.enemy, 'broken', 2, 1); // power 1: a vez perdida já consumida, só o bônus vale
    const a = resolveRound(base, 'attack').dealt, b = resolveRound(broken, 'attack').dealt;
    expect(b / a).toBeCloseTo(1 + POSTURE.brokenBonus, 1);
  });

  it('cancela o preparo como o atordoamento e o padrão avança', () => {
    const s0 = fight(hero(), foe([], 3, ['smash', 'attack']));
    expect(s0.intent).toEqual({ action: 'smash', prep: true });
    addStatus(s0.enemy, 'broken', 2, 0);
    expect(intentView(s0).lost).toBeTruthy();
    const s = resolveRound(s0, 'attack');
    expect(texts(s)).toContain('Alvo perde a concentração.');
    expect(s.intent).toEqual({ action: 'attack' }); // não bate com Pancada: o padrão seguiu
  });

  it('volta cheia sem encadear: pontos extras são ignorados e a postura reabastece ao fim', () => {
    let s = broke();
    expect(s.enemy.posture).toBe(0);
    s = resolveRound(s, 'attack'); // desequilibrado: golpes no ponto fraco não contam
    expect(hasStatus(s.enemy, 'broken')).toBe(false);
    expect(s.enemy.posture).toBe(s.enemy.maxPosture);
    expect(texts(s)).toContain('Alvo recupera o equilíbrio.');
    expect(texts(s).filter((t) => t.startsWith('Alvo ataca')).length).toBe(1); // a vez só é tirada uma vez: na rodada 2 ele agiu
  });

  it('se o inimigo já agiu quando quebra, perde a vez na rodada seguinte', () => {
    const e = foe(['physical'], 1);
    e.stats.speed = 200; // inimigo age antes do herói
    let s = resolveRound(fight(hero(), e), 'attack');
    expect(texts(s).some((t) => t.startsWith('Alvo ataca'))).toBe(true);
    expect(hasStatus(s.enemy, 'broken')).toBe(true);
    const hp = s.player.hp;
    s = resolveRound(s, 'attack');
    expect(s.player.hp).toBe(hp);
    expect(texts(s)).toContain('Alvo está desequilibrado e perde a vez.');
  });

  it('postureView: pontos fracos desconhecidos são null até revelados', () => {
    let s = fight(hero(), foe(['physical', 'poison'], 3, ['defend']));
    expect(postureView(s)).toEqual({ value: 3, max: 3, broken: false, weak: [null, null] });
    s = resolveRound(s, 'attack');
    expect(postureView(s)).toEqual({ value: 2, max: 3, broken: false, weak: ['physical', null] });
  });

  it('conhecimento prévio (known) já aparece na abertura', () => {
    const s = createCombat(hero(), foe(['physical', 'poison'], 3), 1, { known: ['poison'] });
    expect(postureView(s).weak).toEqual([null, 'poison']);
  });

  it('ação inválida devolve o mesmo objeto', () => {
    const s = fight();
    expect(resolveRound(s, 'lightning')).toBe(s);
  });
});

describe('fase 2 do chefe', () => {
  const phase2 = { at: 0.5, pattern: ['defend', 'attack'], line: 'Chega!', effects: [{ status: 'guard' as const, target: 'self' as const, turns: 2 }] };
  const boss = (pattern = ['attack', 'attack', 'attack']) => {
    const e = foe([], 0, pattern, { phase2 });
    e.stats.maxHp = e.hp = 100;
    return e;
  };

  it('dispara uma vez ao cair a 50%: fala, efeito, padrão novo a partir do passo 0', () => {
    let s = fight(hero(), boss());
    s.enemy.hp = 60;
    s = resolveRound(s, 'attack'); // dano pequeno: ainda sem fase
    expect(s.phased).toBe(false);
    s.enemy.hp = 49;
    s = resolveRound(s, 'attack');
    expect(s.phased).toBe(true);
    expect(s.log.find((l) => l.text === 'Chega!')).toMatchObject({ kind: 'enemy', bark: true });
    expect(s.enemy.pattern).toEqual(['defend', 'attack']);
    expect(s.step).toBe(0);
    expect(s.intent).toEqual({ action: 'defend' });
    expect(hasStatus(s.enemy, 'guard')).toBe(true);
    s = resolveRound(s, 'defend');
    expect(s.log.filter((l) => l.text === 'Chega!')).toHaveLength(1);
  });

  it('preparo já anunciado ainda acontece; o padrão novo vem depois', () => {
    let s = fight(hero(), boss(['smash', 'attack']));
    s.enemy.hp = 49;
    s = resolveRound(s, 'attack'); // inimigo prepara; a fase 2 dispara
    expect(s.phased).toBe(true);
    expect(s.intent).toEqual({ action: 'smash' }); // o golpe pesado cai agora
    s = resolveRound(s, 'defend');
    expect(s.intent).toEqual({ action: 'defend' }); // passo 0 do padrão novo
  });

  it('as 3 fases dos chefes existem nos dados', () => {
    for (const id of ['tauros', 'serpent', 'emperor']) {
      expect(ENEMIES[id].phase2?.line).toBeTruthy();
      expect(createEnemyFighter(id, 1).phase2).toEqual(ENEMIES[id].phase2);
    }
  });
});

describe('falas (barks)', () => {
  const talker = () => {
    const e = foe([], 0, ['defend'], { barks: { start: 'Oi', hurt: 'Ai', low: 'Socorro', playerCrit: 'Ui' } });
    e.stats.maxHp = e.hp = 100;
    return e;
  };
  const barks = (s: CombatState) => s.log.filter((l) => l.bark).map((l) => l.text);

  it('start no início, com a marca bark', () => {
    const s = fight(hero(), talker());
    expect(s.log.find((l) => l.text === 'Oi')).toMatchObject({ kind: 'enemy', bark: true });
  });

  it('hurt abaixo de 50%, low até 20% e cada uma só uma vez', () => {
    let s = fight(hero(), talker());
    s.enemy.hp = 48;
    s = resolveRound(s, 'attack');
    s = resolveRound(s, 'attack');
    expect(barks(s)).toEqual(['Oi', 'Ai']);
    s.enemy.hp = 15;
    s = resolveRound(s, 'attack');
    s = resolveRound(s, 'attack');
    expect(barks(s)).toEqual(['Oi', 'Ai', 'Socorro']);
  });

  it('cair direto a 20% fala só a low', () => {
    let s = fight(hero(), talker());
    s.enemy.hp = 15;
    s = resolveRound(s, 'attack');
    expect(barks(s)).toEqual(['Oi', 'Socorro']);
  });

  it('crítico do jogador provoca playerCrit uma vez', () => {
    let s = fight(hero('assassin', 1), talker());
    s = resolveRound(s, 'attack');
    s = resolveRound(s, 'attack');
    expect(barks(s)).toEqual(['Oi', 'Ui']);
  });

  it('chefe com fase 2 não usa hurt (a linha da fase faz esse papel)', () => {
    const e = talker();
    e.phase2 = { at: 0.5, pattern: ['attack'], line: 'Fase!' };
    let s = fight(hero(), e);
    s.enemy.hp = 48;
    s = resolveRound(s, 'attack');
    expect(barks(s)).toEqual(['Oi', 'Fase!']);
  });

  it('todos os inimigos têm start; os chefes têm low e playerCrit', () => {
    for (const e of Object.values(ENEMIES)) expect(e.barks?.start).toBeTruthy();
    for (const id of ['tauros', 'serpent', 'emperor']) expect(ENEMIES[id].barks?.low && ENEMIES[id].barks?.playerCrit).toBeTruthy();
  });
});
