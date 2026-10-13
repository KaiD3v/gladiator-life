import { describe, expect, it } from 'vitest';
import { ACTS, BET, BETS, DEMAND, ENEMIES } from '../data';
import type { CombatState } from '../engine/combat';
import { defaultSave, initialState, parseSave, reduce, rivalFight, type GameState } from '.';

const skip = (g: GameState) => reduce(g, { type: 'skip' });
const start = () =>
  skip(reduce(skip(reduce(initialState(defaultSave()), { type: 'newGame' })), { type: 'startRun', name: 'Ana', classId: 'warrior', seed: 5 }));

/** Entra na luta atual (pulando cenas) e devolve o combate. */
function enter(g: GameState): { g: GameState; c: CombatState } {
  g = skip(reduce(g, { type: 'fight' }));
  if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
  return { g, c: g.screen.combat };
}
/** Força o fim da luta atual com o resultado e os campos dados. */
function finishAs(g: GameState, patch: Partial<CombatState>): GameState {
  const { g: inFight, c } = enter(g);
  return skip(reduce({ ...inFight, screen: { name: 'combat', combat: { ...c, ...patch } } }, { type: 'continue' }));
}
const win = (g: GameState, patch: Partial<CombatState> = {}) => finishAs(g, { outcome: 'victory', ...patch });

/** Vence todo o Ato I e chega ao acampamento do Ato II. */
function toAct2(): GameState {
  let g = start();
  for (const a of ACTS[0].arenas) for (let i = 0; i <= a.fights; i++) g = win(g);
  return g;
}

describe('Exigências da Plebe', () => {
  it('só nas lutas comuns de atos com a camada; cumprir paga ouro × perigo da arena', () => {
    expect(enter(start()).c.demand).toBeUndefined(); // Ato I: sem exigências
    const g = toAct2();
    const { c } = enter(g);
    expect(c.demand).toBeDefined();
    expect(c.player.ally).toBe('taurosCharge'); // e o Chamado de Tauros
    const met = win(g, { demandMet: true }), missed = win(g, { demandMet: false });
    expect(met.run!.gold - missed.run!.gold).toBe(DEMAND.gold * ACTS[1].arenas[0].tier);
    expect(met.screen.name === 'camp' && met.screen.news).toContain('Exigência da Plebe cumprida');
    // chefe: sem exigência
    let b = g;
    for (let i = 0; i < ACTS[1].arenas[0].fights; i++) b = win(b);
    expect(enter(b).c.demand).toBeUndefined();
  });
});

describe('apostas com a Sabina', () => {
  it('cobra o valor, aceita uma por vez e paga valor × odds na próxima luta se o objetivo for cumprido', () => {
    const g = toAct2();
    const bet = BETS[0], low = BET.stakes[0];
    const placed = reduce(g, { type: 'service', npc: 'sabina', value: `bet:${bet.id}:0` });
    expect(placed.run).toMatchObject({ bet: { id: bet.id, stake: 0 }, gold: g.run!.gold - low.gold });
    const again = reduce(placed, { type: 'service', npc: 'sabina', value: `bet:${BETS[1].id}:0` });
    expect(again.run!.bet).toEqual({ id: bet.id, stake: 0 }); // recusada: já há aposta
    expect(again.screen.name === 'camp' && again.screen.npc).toBe('sabina');
    const poor = reduce({ ...g, run: { ...g.run!, gold: low.gold - 1 } }, { type: 'service', npc: 'sabina', value: `bet:${bet.id}:0` });
    expect(poor.run!.bet).toBeUndefined();
    for (const bad of [`bet:${bet.id}:9`, `bet:${bet.id}:`, `bet:nada:0`, `bet:${bet.id}:1.5`]) {
      expect(reduce(g, { type: 'service', npc: 'sabina', value: bad })).toBe(g);
    }
    const won = win(placed), lost = finishAs(placed, { outcome: 'fled' });
    const plain = win(g);
    expect(won.run!.gold - plain.run!.gold).toBe(Math.round(low.gold * bet.odds) - low.gold);
    expect(won.run!.bet).toBeUndefined();
    expect(lost.run!.bet).toBeUndefined();
    expect(lost.screen.name === 'camp' && lost.screen.news).toContain('Aposta perdida');
    expect(reduce(start(), { type: 'service', npc: 'cassio', value: `bet:${bet.id}:0` }).run!.bet).toBeUndefined(); // Cássio não aceita apostas
  });

  it('quanto mais alta a aposta, mais forte o adversário da próxima luta (e maior o prêmio)', () => {
    const g = toAct2();
    const foe = (stake: number) => enter(reduce(g, { type: 'service', npc: 'sabina', value: `bet:${BETS[0].id}:${stake}` })).c;
    const base = enter(g).c.enemy.stats;
    expect(foe(0).enemy.stats).toEqual(base);
    const [mid, high] = [foe(1), foe(2)];
    expect(Math.abs(mid.enemy.stats.maxHp - base.maxHp * (1 + BET.stakes[1].boost))).toBeLessThanOrEqual(1); // arredondamento
    expect(high.enemy.stats.maxHp).toBeGreaterThan(mid.enemy.stats.maxHp);
    expect(high.enemy.stats.atk).toBeGreaterThan(base.atk);
    expect(high.log.some((l) => l.text.startsWith('A aposta alta atraiu um adversário mais forte'))).toBe(true);
    expect(foe(0).log.some((l) => l.text.startsWith('A aposta alta'))).toBe(false);
    const rich = { ...g, run: { ...g.run!, gold: 1000 } };
    const paid = (stake: number) => win(reduce(rich, { type: 'service', npc: 'sabina', value: `bet:${BETS[0].id}:${stake}` })).run!.gold;
    expect(paid(2) - paid(0)).toBe(Math.round((BET.stakes[2].gold - BET.stakes[0].gold) * (BETS[0].odds - 1)));
  });
});

describe('Rival', () => {
  it('quem mata o herói numa luta comum do Ato II vira Rival e volta na próxima tentativa, mais forte', () => {
    const g = toAct2();
    const killer = g.run!.enemies[0];
    const dead = finishAs(g, { outcome: 'defeat' });
    const rival = dead.save.rivals.oath;
    expect(rival).toMatchObject({ arena: 'naumachia', enemy: killer, rank: 1 });
    expect(rival.name.startsWith(ENEMIES[killer].name)).toBe(true);
    expect(parseSave(JSON.stringify(dead.save)).save.rivals).toEqual(dead.save.rivals);

    let retry = skip(reduce(dead, { type: 'startAct', act: 1, seed: 11 }));
    const at = retry.run!.enemies.length - 2;
    expect(retry.run!.rival).toEqual({ enemy: killer, name: rival.name, rank: 1, at });
    expect(retry.run!.enemies[at]).toBe(killer);
    for (let i = 0; i < at; i++) retry = win(retry);
    expect(rivalFight(retry.run!)).toBe(true);
    const { c } = enter(retry);
    expect(c.enemy.name).toBe(rival.name);
    expect(c.log.some((l) => l.bark && l.text.includes('Ana'))).toBe(true); // provocação com o nome do herói
    expect(c.enemy.stats.maxHp).toBeGreaterThan(enter({ ...retry, run: { ...retry.run!, rival: undefined } }).c.enemy.stats.maxHp);

    // cair de novo para o Rival: sobe de patente
    expect(finishAs(retry, { outcome: 'defeat' }).save.rivals.oath.rank).toBe(2);
    // vingança: o Rival some
    const avenged = win(retry);
    expect(avenged.save.rivals.oath).toBeUndefined();
    expect(avenged.run!.rival).toBeUndefined();
    expect(avenged.screen.name === 'camp' && avenged.screen.news).toContain('Vingança!');
  });

  it('chefe, Ato I e abandonar não criam Rival; gladiador novo zera os rivais', () => {
    expect(finishAs(start(), { outcome: 'defeat' }).save.rivals).toEqual({});
    let g = toAct2();
    expect(reduce(g, { type: 'restartAct', seed: 1 }).save.rivals).toEqual({});
    for (let i = 0; i < ACTS[1].arenas[0].fights; i++) g = win(g);
    expect(finishAs(g, { outcome: 'defeat' }).save.rivals).toEqual({}); // morto pelo chefe
    const withRival = finishAs(toAct2(), { outcome: 'defeat' });
    const fresh = skip(reduce(skip(reduce(reduce(withRival, { type: 'toTitle' }), { type: 'newGame' })), { type: 'startRun', name: 'Bia', classId: 'mage', seed: 1 }));
    expect(fresh.save.rivals).toEqual({});
  });
});
