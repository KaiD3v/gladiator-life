// Serviços do acampamento: o que cada tipo de NPC faz (ServiceDef em data/types.ts). Todos com a mesma interface, então
// um NPC novo é só dado (data/npcs.ts) e um tipo novo de serviço é uma entrada aqui (e a sua vitrine em ui/views/camp.ts).
import { BET, BETS, ITEMS, REST_FREE, REST_PAID, SKILLS, type NpcReaction, type ServiceDef, type ServiceKind } from '../data';
import { acquireItem, buyBlock, withMaxHpGrowth } from '../engine/items';
import { freeDays, learnBlock, maxHp, restPrice, trainPrice } from './run';
import type { RunState } from './types';

/**
 * Aplica `value` na cópia da run e devolve como o NPC reage, ou 'skip' quando o valor não é deste serviço ou não vale agora.
 * Em 'skip' a run NÃO pode ter sido alterada (o reducer devolve o estado original).
 */
type Service<S extends ServiceDef> = (run: RunState, svc: S, value: string) => NpcReaction | 'skip';

/** Atividade que gasta um dia. Bloqueada no último dia: nele só se luta. */
function spendDay(run: RunState): boolean {
  if (freeDays(run) <= 0) return false;
  run.day++;
  return true;
}

/** Loja: `value` = id do item no estoque. */
const shop: Service<Extract<ServiceDef, { kind: 'shop' }>> = (run, _svc, itemId) => {
  const block = buyBlock(run, itemId);
  if (block === 'unavailable' || block === 'owned') return 'skip';
  if (block === 'bag') return 'denied';
  if (block === 'gold') return 'poor';
  run.gold -= ITEMS[itemId].price;
  acquireItem(run, itemId);
  run.shop = run.shop.filter((id) => id !== itemId);
  return 'deal';
};

/** Estalagem: `value` = 'rest'. Pagando cura REST_PAID; sem ouro, o estábulo cura REST_FREE. */
const inn: Service<Extract<ServiceDef, { kind: 'inn' }>> = (run, _svc, value) => {
  if (value !== 'rest') return 'skip';
  const max = maxHp(run);
  if (run.hp >= max) return 'denied';
  if (!spendDay(run)) return 'skip';
  const paid = run.gold >= restPrice(run);
  if (paid) run.gold -= restPrice(run);
  run.hp = Math.min(max, run.hp + Math.round(max * (paid ? REST_PAID : REST_FREE)));
  return paid ? 'deal' : 'poor';
};

/** Treinador de um atributo: `value` = 'train' (sobe o atributo) ou o id de uma habilidade desse atributo. */
const trainer: Service<Extract<ServiceDef, { kind: 'trainer' }>> = (run, { attr }, value) => {
  if (value === 'train') {
    if (freeDays(run) <= 0) return 'skip';
    const price = trainPrice(run, attr);
    if (run.gold < price) return 'poor';
    run.gold -= price;
    withMaxHpGrowth(run, () => { // treinar Força também enche a vida nova
      run.attrs[attr]++;
      run.trained[attr]++;
    });
    spendDay(run);
    return 'deal';
  }
  const sk = SKILLS[value];
  if (!sk || sk.attr !== attr || !sk.price) return 'skip';
  const block = learnBlock(run, value);
  if (block === 'known' || block === 'days') return 'skip';
  if (block === 'req' || block === 'slots') return 'denied';
  if (block === 'gold') return 'poor';
  run.gold -= sk.price;
  run.skills.push(value);
  spendDay(run);
  return 'deal';
};

/**
 * Apostas: `value` = 'bet:<id em BETS>:<índice em BET.stakes>'. Uma por vez, paga ao fim da próxima luta (state/campaign.ts);
 * valor mais alto fortalece o adversário dessa luta (state/run.ts, startFight).
 */
const bookie: Service<Extract<ServiceDef, { kind: 'bookie' }>> = (run, _svc, value) => {
  const [tag, id, i] = value.split(':');
  const bet = BETS.find((b) => b.id === id), stake = BET.stakes[Number(i)];
  if (tag !== 'bet' || !bet || !stake || !/^\d+$/.test(i)) return 'skip';
  if (run.bet) return 'denied';
  if (run.gold < stake.gold) return 'poor';
  run.gold -= stake.gold;
  run.bet = { id: bet.id, stake: Number(i) };
  return 'deal';
};

export const SERVICES: { [K in ServiceKind]: Service<Extract<ServiceDef, { kind: K }>> } = { shop, inn, trainer, bookie };

/** Primeiro serviço do NPC que aceita `value` (um NPC pode ter vários). */
export function provide(run: RunState, services: ServiceDef[], value: string): NpcReaction | 'skip' {
  for (const svc of services) {
    const r = (SERVICES[svc.kind] as Service<ServiceDef>)(run, svc, value);
    if (r !== 'skip') return r;
  }
  return 'skip';
}
