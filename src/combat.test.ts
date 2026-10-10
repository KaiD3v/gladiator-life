import { describe, expect, it } from 'vitest';
import { CLASSES, ENEMIES } from './data';
import { NO_PERKS, addStatus, createCombat, makeFighter, resolveRound, type CombatState } from './combat';

const hero = (cls: keyof typeof CLASSES = 'warrior') => {
  const c = CLASSES[cls];
  return makeFighter('Herói', 'player', { ...c.stats }, { ...NO_PERKS, ...c.perks }, { ...c.attrs }, [...c.skills]);
};
const foe = (id = 'bandit') => {
  const e = ENEMIES[id];
  return makeFighter(e.name, 'enemy', { ...e.stats }, { ...NO_PERKS, ...e.perks }, { ...e.attrs }, [...e.skills]);
};
const fight = (p = hero(), e = foe(), seed = 1) => createCombat(p, e, seed);

describe('ações e turnos', () => {
  it('rejeita ação sem energia, de outra classe ou com combate encerrado (mesmo objeto)', () => {
    const s = fight();
    s.player.energy = 0;
    expect(resolveRound(s, 'shieldBash')).toBe(s);
    expect(resolveRound(s, 'fireball')).toBe(s);
    const over = { ...fight(), outcome: 'victory' } as CombatState;
    expect(resolveRound(over, 'attack')).toBe(over);
  });

  it('cada ação válida resolve exatamente uma rodada e não muta o estado anterior', () => {
    const s = fight();
    const next = resolveRound(s, 'attack');
    expect(next.round).toBe(2);
    expect(s.round).toBe(1);
    expect(s.enemy.hp).toBe(s.enemy.stats.maxHp);
    expect(next.enemy.hp).toBeLessThan(next.enemy.stats.maxHp);
  });

  it('consome energia da habilidade e regenera no fim da rodada sem passar do máximo', () => {
    const s = fight();
    const next = resolveRound(s, 'shieldBash'); // custo 4, regen 2
    expect(next.player.energy).toBe(s.player.stats.maxEnergy - 4 + 2);
    const full = resolveRound(fight(), 'attack');
    expect(full.player.energy).toBe(full.player.stats.maxEnergy);
  });

  it('o mais rápido age primeiro; Defender tem prioridade', () => {
    const s = fight(hero('warrior'), foe('wolf')); // lobo velocidade 10 > 4
    const atk = resolveRound(s, 'attack');
    const firstActor = atk.log.find((l) => l.round === 1 && (l.kind === 'player' || l.kind === 'enemy'));
    expect(firstActor?.kind).toBe('enemy');
    const def = resolveRound(s, 'defend');
    expect(def.log.find((l) => l.kind === 'player' || l.kind === 'enemy')?.kind).toBe('player');
  });
});

describe('classes', () => {
  it('Guerreiro defendendo recebe menos dano e contra-ataca', () => {
    let hits = 0;
    for (let seed = 1; seed < 40; seed++) {
      const s = resolveRound(fight(hero('warrior'), foe('bandit'), seed), 'defend');
      const enemyHit = s.log.find((l) => l.kind === 'enemy' && l.target === 'player' && l.amount);
      if (!enemyHit) continue;
      hits++;
      expect(enemyHit.text).toContain('bloqueado');
      expect(enemyHit.amount!).toBeLessThanOrEqual(6); // até ~17 bruto (com crítico) * armadura * 0.35
      expect(s.log.some((l) => l.text.includes('contra-ataca'))).toBe(true);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('Assassino: Golpe Sombrio é crítico garantido em alvo envenenado', () => {
    const s = fight(hero('assassin'));
    addStatus(s.enemy, 'poison', 3, 3);
    const next = resolveRound(s, 'shadowStrike');
    expect(next.log.find((l) => l.kind === 'player')?.crit).toBe(true);
  });

  it('Mago: Bola de Fogo aplica queimadura que causa dano por rodada', () => {
    const s = resolveRound(fight(hero('mage'), foe('brute')), 'fireball');
    expect(s.enemy.statuses.find((x) => x.id === 'burn')?.turns).toBe(2);
    expect(s.log.some((l) => l.text.startsWith('Queimadura causa 4'))).toBe(true);
  });
});

describe('efeitos', () => {
  it('veneno acumula potência e efeitos expiram após a duração', () => {
    const f = hero();
    addStatus(f, 'poison', 3, 3);
    addStatus(f, 'poison', 2, 3);
    expect(f.statuses).toEqual([{ id: 'poison', turns: 3, power: 6 }]);

    let s = fight();
    addStatus(s.player, 'weaken', 2, 0);
    s = resolveRound(s, 'defend');
    expect(s.player.statuses.some((x) => x.id === 'weaken')).toBe(true);
    s = resolveRound(s, 'defend');
    expect(s.player.statuses.some((x) => x.id === 'weaken')).toBe(false);
  });

  it('atordoamento faz perder uma ação e é consumido', () => {
    let s = fight();
    addStatus(s.enemy, 'stun', 1, 0);
    s = resolveRound(s, 'defend');
    expect(s.log.some((l) => l.text === 'Bandido está atordoado e perde a vez.')).toBe(true);
    expect(s.enemy.statuses.some((x) => x.id === 'stun')).toBe(false);
  });

  it('cura não revive quem caiu no mesmo fim de rodada', () => {
    const s = fight();
    s.player.hp = 2;
    s.player.perks.hpRegen = 10;
    addStatus(s.player, 'poison', 3, 5);
    addStatus(s.enemy, 'stun', 1, 0);
    const next = resolveRound(s, 'defend');
    expect(next.player.hp).toBe(0);
    expect(next.outcome).toBe('defeat');
  });
});

describe('fim de combate', () => {
  it('derrota simultânea por efeitos resulta em empate', () => {
    const s = fight();
    s.player.hp = 3;
    s.enemy.hp = 3;
    addStatus(s.player, 'poison', 2, 5);
    addStatus(s.enemy, 'poison', 2, 5);
    addStatus(s.enemy, 'stun', 1, 0);
    const next = resolveRound(s, 'defend');
    expect(next.outcome).toBe('draw');
    expect(resolveRound(next, 'attack')).toBe(next);
  });

  it('espinhos que matam o atacante no mesmo golpe também empatam', () => {
    const p = hero('assassin');
    p.hp = 1;
    const e = foe('bandit');
    e.hp = 1;
    e.perks.thorns = 1;
    const next = resolveRound(fight(p, e), 'attack');
    expect(next.outcome).toBe('draw');
  });

  it('vitória interrompe a rodada: o inimigo morto não age', () => {
    const e = foe('brute'); // lento: o jogador age primeiro
    e.hp = 1;
    const next = resolveRound(fight(hero('assassin'), e), 'attack');
    expect(next.outcome).toBe('victory');
    expect(next.log.some((l) => l.kind === 'enemy')).toBe(false);
    expect(next.round).toBe(1);
  });
});

describe('atributos e fuga', () => {
  it('habilidade ganha dano extra pelo atributo atrelado', () => {
    const dmg = (str: number) => {
      const p = hero('warrior');
      p.attrs.str = str;
      const e = foe('brute');
      e.stats.maxHp = e.hp = 999;
      return resolveRound(fight(p, e, 7), 'shieldBash').log.find((l) => l.kind === 'player')!.amount!;
    };
    expect(dmg(16)).toBeGreaterThan(dmg(0));
  });

  it('Lâmina Dupla acerta duas vezes; Prece cura com base na Sabedoria', () => {
    const p = hero('assassin');
    p.skills = ['twinStrike', 'mend'];
    p.attrs.wis = 5;
    const e = foe('brute');
    e.stats.maxHp = e.hp = 999;
    const twin = resolveRound(fight(p, e), 'twinStrike');
    expect(twin.log.filter((l) => l.kind === 'player' && l.target === 'enemy' && l.amount).length).toBe(2);

    p.hp = 10;
    addStatus(e, 'stun', 1, 0);
    const healed = resolveRound(fight(p, e), 'mend');
    expect(healed.player.hp).toBe(10 + 10 + 5 * 3);
  });

  it('fuga bem-sucedida encerra o combate sem o inimigo agir', () => {
    const p = hero('assassin');
    p.attrs.dex = 50;
    const s = resolveRound(fight(p, foe('brute')), 'flee');
    expect(s.outcome).toBe('fled');
    expect(s.log.some((l) => l.kind === 'enemy')).toBe(false);
    expect(s.player.hp).toBe(p.hp);
  });

  it('fuga fracassada gera golpe de oportunidade (e o inimigo ainda age)', () => {
    const p = hero('warrior');
    p.attrs.dex = -50;
    const s = resolveRound(fight(p, foe('bandit')), 'flee');
    expect(s.outcome).toBeNull();
    const enemyHits = s.log.filter((l) => l.kind === 'enemy' && l.target === 'player' && l.amount);
    expect(enemyHits[0].text).toContain('aproveita e golpeia');
    expect(enemyHits.length).toBeGreaterThanOrEqual(1);
    expect(s.player.hp).toBeLessThan(p.hp);
  });

  it('atordoado não consegue fugir', () => {
    const p = hero('assassin');
    p.attrs.dex = 50;
    const s = fight(p, foe('bandit'));
    addStatus(s.player, 'stun', 1, 0);
    expect(resolveRound(s, 'flee').outcome).not.toBe('fled');
  });
});

describe('efeitos sonoros', () => {
  it('todo dano, cura e desfecho do log tem efeito sonoro; magia soa diferente de golpe', () => {
    let s = fight(hero('mage'));
    while (!s.outcome) s = resolveRound(s, s.player.energy >= 6 ? 'fireball' : 'attack');
    for (const l of s.log) if (l.amount) expect(l.sfx, l.text).toBeTruthy();
    expect(s.log.some((l) => l.kind === 'player' && l.sfx === 'magic')).toBe(true);
    expect(s.log.at(-1)!.sfx).toBe(s.outcome === 'victory' ? 'victory' : 'defeat');
  });
});
