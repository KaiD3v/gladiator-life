import type { Attr, Stats } from './types';

export const ATTR_INFO: Record<Attr, { name: string; short: string; desc: string }> = {
  str: { name: 'Força', short: 'FOR', desc: '+1 ataque e +5 vida máx. por ponto. Potencializa golpes de Força.' },
  dex: { name: 'Destreza', short: 'DES', desc: '+1 velocidade e +3% crítico por ponto. Potencializa golpes ágeis e decide fugas.' },
  wis: { name: 'Sabedoria', short: 'SAB', desc: '+1 magia e +1 energia máx. por ponto. Potencializa magias e curas.' },
};
/** Ganho de estatística por ponto de atributo acima do valor inicial da classe. */
export const ATTR_GAIN: Record<Attr, Partial<Stats>> = { str: { atk: 1, maxHp: 5 }, dex: { speed: 1, crit: 0.03 }, wis: { mag: 1, maxEnergy: 1 } };
export const ATTR_SKILL_BONUS = 0.5; // dano extra por ponto do atributo da habilidade
export const ATTR_HEAL_BONUS = 3; // cura extra por ponto do atributo da habilidade
