// Itens: aquisição, loja e validação de compra. Os efeitos em si são dados (mods/perks) aplicados em characters.ts.
import { rand } from '../core/rng';
import { ITEMS, SHOP_SIZE } from '../data';
import type { RunState } from '../state/types';
import { buildPlayer } from './characters';

/** Executa a mudança; se a vida máxima cresceu, a vida atual cresce o mesmo tanto. */
export function withMaxHpGrowth(run: RunState, mutate: () => void) {
  const before = buildPlayer(run).stats.maxHp;
  mutate();
  run.hp += buildPlayer(run).stats.maxHp - before;
}

export const acquireItem = (run: RunState, itemId: string) => withMaxHpGrowth(run, () => void run.items.push(itemId));

export type BuyBlock = 'unavailable' | 'owned' | 'gold' | null;
export function buyBlock(run: RunState, itemId: string): BuyBlock {
  if (!run.shop.includes(itemId)) return 'unavailable';
  if (run.items.includes(itemId)) return 'owned';
  if (run.gold < ITEMS[itemId].price) return 'gold';
  return null;
}

/** Sorteia o estoque do mercador entre os itens que o jogador ainda não tem. */
export function rollShop(run: RunState) {
  const pool = Object.keys(ITEMS).filter((id) => !run.items.includes(id));
  run.shop = [];
  while (run.shop.length < SHOP_SIZE && pool.length) run.shop.push(pool.splice(Math.floor(rand(run) * pool.length), 1)[0]);
}
