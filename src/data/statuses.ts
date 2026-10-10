import type { StatusId, WeakTag } from './types';

export const STATUS_INFO: Record<StatusId, { name: string; desc: string }> = {
  poison: { name: 'Veneno', desc: 'Perde vida por rodada (acumula).' },
  burn: { name: 'Queimadura', desc: 'Perde vida por rodada.' },
  stun: { name: 'Atordoado', desc: 'Perde a próxima ação.' },
  guard: { name: 'Guarda', desc: 'Recebe metade do dano e contra-ataca.' },
  weaken: { name: 'Enfraquecido', desc: 'Causa 30% menos dano.' },
  steady: { name: 'Firme', desc: 'Imune a atordoamento nesta rodada.' },
  broken: { name: 'Desequilibrado', desc: 'Perde a próxima ação e recebe +50% de dano.' },
  regen: { name: 'Regeneração', desc: 'Recupera vida por rodada.' },
};

export const WEAK_INFO: Record<WeakTag, { name: string; desc: string }> = {
  physical: { name: 'Físico', desc: 'Golpes físicos abalam a postura.' },
  magic: { name: 'Mágico', desc: 'Golpes mágicos abalam a postura.' },
  poison: { name: 'Veneno', desc: 'Envenenar abala a postura.' },
  burn: { name: 'Queimadura', desc: 'Queimar abala a postura.' },
  stun: { name: 'Atordoamento', desc: 'Atordoar abala a postura.' },
};
