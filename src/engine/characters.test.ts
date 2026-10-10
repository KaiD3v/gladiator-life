import { describe, expect, it } from 'vitest';
import { CLASSES, ENEMIES } from '../data';
import { applyModifiers, buildPlayer, createEnemyFighter } from './characters';
import { NO_PERKS } from './combat';

const base = { stats: CLASSES.warrior.stats, perks: NO_PERKS };
const run = (o = {}) => ({ classId: 'warrior' as const, items: [] as string[], level: 1, attrs: { ...CLASSES.warrior.attrs }, ...o });

describe('modificadores', () => {
  it('soma stats e perks, com multiplicador, sem alterar a base', () => {
    const r = applyModifiers(base, [{ stats: { atk: 2 }, times: 3 }, { perks: { thorns: 0.3 } }]);
    expect(r.stats.atk).toBe(CLASSES.warrior.stats.atk + 6);
    expect(r.perks.thorns).toBe(0.3);
    expect(base.perks.thorns).toBe(0);
    expect(base.stats.atk).toBe(CLASSES.warrior.stats.atk);
  });

  it('jogador: nível, atributo e itens', () => {
    const b = buildPlayer(run({ level: 3, items: ['titanHeart', 'vampireChalice'], attrs: { ...CLASSES.warrior.attrs, str: CLASSES.warrior.attrs.str + 2 } }));
    expect(b.stats.maxHp).toBe(CLASSES.warrior.stats.maxHp + 8 + 10 + 25);
    expect(b.stats.atk).toBe(CLASSES.warrior.stats.atk + 2);
    expect(b.perks.lifesteal).toBe(0.2);
  });
});

describe('inimigos', () => {
  const id = Object.keys(ENEMIES)[0];
  it.each([1, 2, 3])('tier %i igual à fórmula antiga', (tier) => {
    const def = ENEMIES[id];
    const t = tier - 1;
    const s = (n: number) => Math.round(n * (1 + 0.2 * t));
    const e = createEnemyFighter(id, tier);
    expect(e.stats.maxHp).toBe(s(def.stats.maxHp));
    expect(e.stats.atk).toBe(s(def.stats.atk));
    expect(e.stats.mag).toBe(s(def.stats.mag));
    expect(e.stats.def).toBe(def.stats.def + t);
    expect(e.attrs.dex).toBe(def.attrs.dex + t);
  });
});
