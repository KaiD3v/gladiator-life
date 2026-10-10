import { describe, expect, it } from 'vitest';
import { CLASSES, ITEMS, SHOP_CONSUMABLES, SHOP_SIZE } from '../data';
import type { RunState } from '../state/types';
import { buildPlayer } from './characters';
import { acquireItem, buyBlock, rollShop, withMaxHpGrowth } from './items';

const mk = (o: Partial<RunState> = {}) => {
  const r = { classId: 'warrior', items: [], level: 1, attrs: { ...CLASSES.warrior.attrs }, gold: 100, shop: ['titanHeart', 'chippedSword'], seed: 7, hp: 0 } as unknown as RunState;
  r.hp = buildPlayer(r).stats.maxHp;
  return Object.assign(r, o);
};

describe('itens', () => {
  it('Coração de Titã sobe vida máxima e atual em 25', () => {
    const r = mk();
    const max = r.hp;
    acquireItem(r, 'titanHeart');
    expect(buildPlayer(r).stats.maxHp).toBe(max + 25);
    expect(r.hp).toBe(max + 25);
  });

  it('treinar Força sobe a vida atual em 5', () => {
    const r = mk();
    const hp = r.hp;
    withMaxHpGrowth(r, () => { r.attrs.str++; });
    expect(r.hp).toBe(hp + 5);
  });

  it('buyBlock', () => {
    expect(buyBlock(mk(), 'warHorn')).toBe('unavailable');
    expect(buyBlock(mk({ items: ['chippedSword'] }), 'chippedSword')).toBe('owned');
    expect(buyBlock(mk({ gold: ITEMS.titanHeart.price - 1 }), 'titanHeart')).toBe('gold');
    expect(buyBlock(mk(), 'titanHeart')).toBeNull();
  });

  it('a loja nunca oferece item já possuído', () => {
    const r = mk({ items: Object.keys(ITEMS).slice(0, 5) });
    for (let i = 0; i < 20; i++) {
      rollShop(r);
      expect(r.shop).toHaveLength(SHOP_SIZE + SHOP_CONSUMABLES);
      expect(r.shop.some((id) => r.items.includes(id))).toBe(false);
    }
  });
});
