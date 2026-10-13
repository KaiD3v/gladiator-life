// Itens: aquisição, loja, bolsa e espólio. Os efeitos em si são dados (mods/perks em characters.ts, `use` no combate).
import { fork, rand } from '../core/rng';
import { ACTS, BAG_SIZE, ENEMIES, ITEMS, LOOT, SHOP_CONSUMABLES, SHOP_SIZE } from '../data';
import type { RunState } from '../state/types';
import { buildPlayer } from './characters';

/** Executa a mudança; se a vida máxima cresceu, a vida atual cresce o mesmo tanto. */
export function withMaxHpGrowth(run: RunState, mutate: () => void) {
  const before = buildPlayer(run).stats.maxHp;
  mutate();
  run.hp += buildPlayer(run).stats.maxHp - before;
}

/** Equipamento vai para `items`; consumível vai para a bolsa (quem chama confere o espaço com `buyBlock`). */
export const acquireItem = (run: RunState, itemId: string) =>
  ITEMS[itemId].use ? void run.bag.push(itemId) : withMaxHpGrowth(run, () => void run.items.push(itemId));

/** Escolha padrão do espólio: a bolsa atual e, depois, os itens caídos que couberem (índices em `bolsa + caídos`). */
export const defaultKeep = (total: number) => [...Array(Math.min(total, BAG_SIZE)).keys()];

/**
 * Bolsa depois do espólio. `pool` = bolsa atual seguida dos itens caídos; `keep` = índices escolhidos em `pool`
 * (sem repetição, no máximo BAG_SIZE). Devolve null se a escolha for inválida.
 */
export function chooseBag(pool: string[], keep = defaultKeep(pool.length)): string[] | null {
  if (keep.length > BAG_SIZE || new Set(keep).size !== keep.length || keep.some((i) => !Number.isInteger(i) || i < 0 || i >= pool.length)) return null;
  return [...keep].sort((a, b) => a - b).map((i) => pool[i]);
}

export type BuyBlock = 'unavailable' | 'owned' | 'bag' | 'gold' | null;
export function buyBlock(run: RunState, itemId: string): BuyBlock {
  if (!run.shop.includes(itemId)) return 'unavailable';
  if (run.items.includes(itemId)) return 'owned';
  if (ITEMS[itemId].use && run.bag.length >= BAG_SIZE) return 'bag';
  if (run.gold < ITEMS[itemId].price) return 'gold';
  return null;
}

/** Índice do ato da arena (0 = primeiro). */
export const actOf = (arenaId: string) => ACTS.findIndex((a) => a.arenas.some((x) => x.id === arenaId));

/**
 * Sorteia o estoque do mercador: equipamentos que o jogador ainda não tem e, depois, consumíveis.
 * Os consumíveis usam um RNG derivado para não mudar a sequência de sorteios da run.
 */
export function rollShop(run: RunState) {
  const draw = (rng: { seed: number }, pool: string[], n: number) => {
    const out: string[] = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand(rng) * pool.length), 1)[0]);
    return out;
  };
  const ids = Object.keys(ITEMS);
  const act = actOf(run.arenaId); // contrabando de atos futuros fica fora (e não muda os sorteios dos atos anteriores)
  const gear = draw(run, ids.filter((id) => !ITEMS[id].use && !run.items.includes(id) && (ITEMS[id].act ?? 0) <= act), SHOP_SIZE);
  run.shop = [...gear, ...draw(fork(run, 0x51ed270b), ids.filter((id) => ITEMS[id].use), SHOP_CONSUMABLES)];
}

/** Bolsa do inimigo para uma luta. Semente derivada da do combate: não consome o rand da run nem o do combate. */
export function rollLoot(enemyId: string, seed: number): string[] {
  const pool = ENEMIES[enemyId].loot ?? [];
  const rng = fork({ seed }, 0x5bd1e995);
  const bag: string[] = [];
  for (let i = 0; i < LOOT.rolls && pool.length; i++) if (rand(rng) < LOOT.chance) bag.push(pool[Math.floor(rand(rng) * pool.length)]);
  return bag;
}
