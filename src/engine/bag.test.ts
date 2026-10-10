import { describe, expect, it } from 'vitest';
import { CLASSES, ENEMIES, LOOT } from '../data';
import { NO_PERKS, actionsFor, addStatus, createCombat, intentView, makeFighter, resolveRound } from './combat';
import { rollLoot } from './items';

const hero = (bag: string[] = []) => {
  const c = CLASSES.warrior;
  return makeFighter('Herói', 'player', { ...c.stats }, { ...NO_PERKS, ...c.perks }, { ...c.attrs }, [...c.skills], undefined, [], { bag });
};
const foe = (id = 'bandit', bag: string[] = [], hp?: number) => {
  const e = ENEMIES[id];
  return makeFighter(e.name, 'enemy', { ...e.stats }, { ...NO_PERKS, ...e.perks }, { ...e.attrs }, [...e.skills], hp, [...e.pattern], { bag });
};
const actorsOf = (log: { kind: string; round: number }[]) => log.filter((l) => l.round === 1 && (l.kind === 'player' || l.kind === 'enemy')).map((l) => l.kind);

describe('bolsa do jogador', () => {
  it('itens viram ações (um por tipo, depois de Fugir); usar gasta a rodada e tira só um da bolsa', () => {
    const s = createCombat(hero(['potion', 'fireBomb', 'potion']), foe(), 1);
    expect(actionsFor(s.player, s).slice(-2)).toEqual(['potion', 'fireBomb']);
    const next = resolveRound(s, 'fireBomb');
    expect(next.round).toBe(2);
    expect(next.player.bag).toEqual(['potion', 'potion']);
    expect(next.enemy.statuses.some((x) => x.id === 'burn')).toBe(true);
    expect(s.player.bag).toHaveLength(3); // estado anterior intacto
  });

  it('item fora da bolsa é ação inválida (mesmo objeto)', () => {
    const s = createCombat(hero(), foe(), 1);
    expect(resolveRound(s, 'potion')).toBe(s);
  });

  it('item de defesa age primeiro; item de ataque segue a velocidade', () => {
    const s = createCombat(hero(['potion', 'fireBomb']), foe('wolf'), 1); // lobo é mais rápido
    s.player.hp = 20;
    expect(actorsOf(resolveRound(s, 'potion').log)[0]).toBe('player');
    expect(actorsOf(resolveRound(s, 'fireBomb').log)[0]).toBe('enemy');
  });

  it('atordoado perde a vez e não gasta o item', () => {
    const s = createCombat(hero(['potion']), foe(), 1);
    addStatus(s.player, 'stun', 1, 0);
    expect(resolveRound(s, 'potion').player.bag).toEqual(['potion']);
  });

  it('Antídoto purifica e Tônico devolve energia', () => {
    const s = createCombat(hero(['antidote', 'tonic']), foe(), 1);
    addStatus(s.player, 'poison', 3, 6);
    addStatus(s.player, 'weaken', 2, 0);
    expect(resolveRound(s, 'antidote').player.statuses.filter((x) => x.id === 'poison' || x.id === 'weaken')).toEqual([]);
    s.player.energy = 0;
    const t = resolveRound(s, 'tonic');
    expect(t.player.energy).toBe(Math.min(t.player.stats.maxEnergy, 6 + t.player.stats.regen));
  });
});

describe('bolsa do inimigo', () => {
  it('com pouca vida anuncia a poção, bebe antes do jogador e não perde o passo do padrão', () => {
    const e = foe('bandit', ['potion'], Math.floor(ENEMIES.bandit.stats.maxHp * LOOT.healAt));
    const s = createCombat(hero(), e, 1);
    expect(s.intent.action).toBe('potion');
    expect(intentView(s)).toMatchObject({ kind: 'item', effects: ['Cura 30'] });
    const next = resolveRound(s, 'attack');
    expect(actorsOf(next.log)[0]).toBe('enemy');
    expect(next.enemy.bag).toEqual([]);
    expect(next.step).toBe(0);
  });

  it('com vida alta guarda a poção', () => {
    const s = createCombat(hero(), foe('bandit', ['potion']), 1);
    expect(s.intent.action).toBe('attack');
  });

  it('nunca troca uma habilidade do padrão por item: espera o ataque básico ou a defesa', () => {
    const s = createCombat(hero(), foe('wolf', ['potion'], 5), 1); // padrão do lobo começa com Mordida
    expect(s.intent.action).toBe('bite');
  });

  it('item de ataque entra no lugar do ataque básico e acumula veneno com golpes envenenados', () => {
    const e = foe('bandit', ['venomVial']);
    e.perks.poisonOnHit = 1;
    let s = createCombat(hero(), e, 1);
    expect(s.intent.action).toBe('venomVial');
    s = resolveRound(s, 'defend');
    expect(s.intent.action).toBe('attack'); // o passo 0 (ataque) ainda vem
    s = resolveRound(s, 'defend');
    expect(s.player.statuses.find((x) => x.id === 'poison')?.power).toBe(5);
  });
});

describe('espólio', () => {
  it('é determinístico, sai do loot do inimigo e respeita o número de tentativas', () => {
    for (let seed = 0; seed < 50; seed++) {
      const bag = rollLoot('bandit', seed);
      expect(rollLoot('bandit', seed)).toEqual(bag);
      expect(bag.length).toBeLessThanOrEqual(LOOT.rolls);
      expect(bag.every((id) => ENEMIES.bandit.loot!.includes(id))).toBe(true);
    }
    expect(rollLoot('wolf', 1)).toEqual([]);
  });
});

describe('itens caídos', () => {
  it('o registro anuncia o que o inimigo não usou ao vencer', () => {
    const s = createCombat(hero(), foe('bandit', ['blindPowder'], 1), 1);
    s.intent = { action: 'defend' }; // guarda o pó: cai com ele na bolsa
    const won = resolveRound(s, 'attack');
    expect(won.outcome).toBe('victory');
    expect(won.log.at(-1)!.text).toBe('Bandido deixa cair: Pó Cegante.');
  });
});
