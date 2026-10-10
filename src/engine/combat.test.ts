import { describe, expect, it } from 'vitest';
import { CLASSES, ENEMIES } from '../data';
import { NO_PERKS, addStatus, createCombat, intentView, makeFighter, resolveRound, type CombatState } from './combat';

const hero = (cls: keyof typeof CLASSES = 'warrior') => {
  const c = CLASSES[cls];
  return makeFighter('Herói', 'player', { ...c.stats }, { ...NO_PERKS, ...c.perks }, { ...c.attrs }, [...c.skills]);
};
const foe = (id = 'bandit') => {
  const e = ENEMIES[id];
  return makeFighter(e.name, 'enemy', { ...e.stats }, { ...NO_PERKS, ...e.perks }, { ...e.attrs }, [...e.skills], undefined, [...e.pattern]);
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

  it('o log guarda a energia por evento: o custo cheio aparece no golpe, a regeneração só depois', () => {
    const s = fight();
    const next = resolveRound(s, 'shieldBash'); // custo 4
    const used = next.log.find((l) => l.kind === 'player' && l.text.includes('Golpe de Escudo'))!;
    expect(used.en[0]).toBe(s.player.stats.maxEnergy - 4);
    expect(next.player.energy).toBe(used.en[0] + s.player.stats.regen);
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

// ---------- Intenções do inimigo (padrões, preparo, Firme) ----------

/** Herói resistente: os testes de padrão não dependem de quem morre primeiro. */
const tank = () => {
  const p = hero('warrior');
  p.stats.maxHp = p.hp = 999;
  return p;
};
const sturdy = (id: string) => {
  const e = foe(id);
  e.stats.maxHp = e.hp = 9999;
  return e;
};
const rounds = (s: CombatState, n: number, action = 'defend') => {
  for (let i = 0; i < n; i++) s = resolveRound(s, action);
  return s;
};

describe('padrão e intenção', () => {
  it('a intenção já existe no início e o padrão cicla a cada rodada', () => {
    let s = fight(tank(), foe('bandit')); // [attack, dirtyCut, attack, defend]
    const seen = [s.intent.action];
    for (let i = 0; i < 5; i++) {
      s = resolveRound(s, 'defend');
      seen.push(s.intent.action);
    }
    expect(seen).toEqual(['attack', 'dirtyCut', 'attack', 'defend', 'attack', 'dirtyCut']);
  });

  it('a ação executada é a anunciada', () => {
    const s = rounds(fight(tank(), foe('bandit')), 1); // anuncia Corte Sujo
    const next = resolveRound(s, 'defend');
    expect(next.log.some((l) => l.round === 2 && l.kind === 'enemy' && l.text.includes('Corte Sujo'))).toBe(true);
  });

  it('sem energia para a ação do padrão, cai para o ataque básico e o padrão segue', () => {
    const s = fight(tank(), foe('bandit'));
    s.enemy.energy = 0; // rodada 1 (attack, custo 0) e regen 2 < 4 do Corte Sujo
    const next = resolveRound(s, 'defend');
    expect(next.intent).toEqual({ action: 'attack' });
    expect(next.step).toBe(1);
    expect(resolveRound(next, 'defend').intent.action).toBe('attack'); // passo 2 do padrão; energia já voltou
  });

  it('o inimigo não sorteia a ação: resolveRound usa s.intent', () => {
    const s = fight(tank(), foe('wolf'));
    s.intent = { action: 'bite' };
    const next = resolveRound(s, 'defend');
    expect(next.log.some((l) => l.kind === 'enemy' && l.text.includes('Mordida'))).toBe(true);
  });

  it('ação inválida devolve o mesmo objeto', () => {
    const s = fight();
    expect(resolveRound(s, 'inexistente')).toBe(s);
  });
});

describe('golpe pesado (preparo)', () => {
  const brute = () => rounds(fight(tank(), sturdy('brute')), 2, 'attack'); // [attack, attack, smash]

  it('é anunciado como preparo, sem dano, e acerta na rodada seguinte', () => {
    const s = brute();
    expect(s.intent).toEqual({ action: 'smash', prep: true });
    const hpBefore = s.player.hp;
    const prep = resolveRound(s, 'attack');
    expect(prep.player.hp).toBe(hpBefore);
    expect(prep.log.some((l) => l.round === s.round && l.text.includes('se prepara para Pancada'))).toBe(true);
    expect(prep.intent).toEqual({ action: 'smash' });
    expect(prep.step).toBe(s.step); // o passo só avança quando o golpe sai
    const hit = resolveRound(prep, 'attack');
    expect(hit.player.hp).toBeLessThan(hpBefore);
    expect(hit.log.some((l) => l.round === prep.round && l.kind === 'enemy' && l.text.includes('usa Pancada'))).toBe(true);
    expect(hit.intent).toEqual({ action: 'attack' });
    expect(hit.step).toBe(s.step + 1);
  });

  it('atordoar durante o preparo cancela o golpe e avança o padrão', () => {
    const s = brute();
    addStatus(s.enemy, 'stun', 1, 0);
    const next = resolveRound(s, 'attack');
    expect(next.log.some((l) => l.text.includes('perde a concentração'))).toBe(true);
    expect(next.log.some((l) => l.text.includes('se prepara'))).toBe(false);
    expect(next.intent).toEqual({ action: 'attack' }); // voltou ao início do ciclo, sem golpe pendente
    expect(next.step).toBe(s.step + 1);
    expect(next.player.hp).toBe(s.player.hp);
  });
});

describe('Firme (anti stun-lock)', () => {
  it('quem consome um atordoamento resiste ao seguinte na rodada seguinte; depois volta ao normal', () => {
    const p = tank(); // Guerreiro: Golpe de Escudo atordoa com 60%
    let s = fight(p, sturdy('bandit'));
    addStatus(s.enemy, 'stun', 1, 0);
    s = resolveRound(s, 'defend');
    expect(s.enemy.statuses.find((x) => x.id === 'steady')?.turns).toBe(1);
    s = resolveRound(s, 'shieldBash');
    expect(s.log.some((l) => l.text.includes('está firme e resiste a Atordoado'))).toBe(true);
    expect(s.enemy.statuses.some((x) => x.id === 'stun')).toBe(false);
    expect(s.enemy.statuses.some((x) => x.id === 'steady')).toBe(false); // expirou
  });

  it('vale para o jogador também', () => {
    let s = fight(tank(), sturdy('brute'));
    addStatus(s.player, 'stun', 1, 0);
    s = resolveRound(s, 'attack');
    expect(s.player.statuses.some((x) => x.id === 'steady')).toBe(true);
    s.intent = { action: 'smash' }; // golpe que atordoa, já pronto
    s = resolveRound(s, 'attack');
    expect(s.log.some((l) => l.text.includes('Herói está firme'))).toBe(true);
    expect(s.player.statuses.some((x) => x.id === 'stun')).toBe(false);
  });
});

describe('intentView', () => {
  it('descreve o preparo com aviso e os demais tipos de ação', () => {
    const s = rounds(fight(tank(), sturdy('brute')), 2, 'attack');
    const v = intentView(s);
    expect(v).toMatchObject({ kind: 'prep', skill: 'smash', label: 'Prepara Pancada' });
    expect(v.warning).toBeTruthy();
    expect(v.effects).toEqual(['Atordoar 40%']);
    expect(intentView({ ...s, intent: { action: 'defend' } })).toMatchObject({ kind: 'defend', label: 'Defender', effects: [] });
    expect(intentView({ ...s, intent: { action: 'roar' } }).kind).toBe('buff');
    expect(intentView({ ...s, intent: { action: 'bite' } }).effects).toEqual(['Veneno 2']);
  });

  it('o intervalo de dano contém todo golpe real sem crítico', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = rounds(fight(tank(), foe('bandit'), seed), 1, 'attack'); // próxima: Corte Sujo
      const v = intentView(s);
      const next = resolveRound(s, 'attack');
      const h = next.log.find((l) => l.round === s.round && l.kind === 'enemy' && l.target === 'player' && l.amount && !l.crit);
      if (!h) continue;
      checked++;
      expect(h.amount!).toBeGreaterThanOrEqual(v.dmg![0]);
      expect(h.amount!).toBeLessThanOrEqual(v.dmg![1]);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('considera a Guarda do jogador e o Enfraquecer do inimigo', () => {
    const s = rounds(fight(tank(), foe('bandit')), 1, 'attack');
    const plain = intentView(s).dmg!;
    addStatus(s.player, 'guard', 2, 0);
    const guarded = intentView(s).dmg!;
    expect(guarded[1]).toBeLessThan(plain[1]);
    addStatus(s.enemy, 'weaken', 2, 0);
    expect(intentView(s).dmg![1]).toBeLessThan(guarded[1]);
  });
});
