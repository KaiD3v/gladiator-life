import type { StatusId } from './types';

export const STATUS_INFO: Record<StatusId, { name: string; desc: string }> = {
  poison: { name: 'Veneno', desc: 'Perde vida por rodada (acumula).' },
  burn: { name: 'Queimadura', desc: 'Perde vida por rodada.' },
  stun: { name: 'Atordoado', desc: 'Perde a próxima ação.' },
  guard: { name: 'Guarda', desc: 'Recebe metade do dano e contra-ataca.' },
  weaken: { name: 'Enfraquecido', desc: 'Causa 30% menos dano.' },
  steady: { name: 'Firme', desc: 'Imune a atordoamento nesta rodada.' },
  regen: { name: 'Regeneração', desc: 'Recupera vida por rodada.' },
};
