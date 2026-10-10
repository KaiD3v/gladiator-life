import { base } from './stats';
import type { ClassDef, ClassId } from './types';

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior', name: 'Guerreiro', tagline: 'Resistência, bloqueio e contra-ataque.',
    passive: 'Bloqueio pesado: ao defender recebe só 35% do dano e contra-ataca.',
    stats: base({ maxHp: 135, maxEnergy: 10, regen: 2, atk: 12, def: 8, speed: 4, block: 0.65 }),
    perks: { counter: 0.6 },
    attrs: { str: 6, dex: 3, wis: 2 },
    skills: ['shieldBash', 'ironStance'],
    glory: 'pitFury',
  },
  mage: {
    id: 'mage', name: 'Mago', tagline: 'Dano mágico, custo de energia e efeitos.',
    passive: 'Mente arcana: +4 de energia por rodada. Magia ignora metade da defesa.',
    stats: base({ maxHp: 95, maxEnergy: 16, regen: 4, atk: 8, mag: 15, def: 3, speed: 5 }),
    perks: {},
    attrs: { str: 2, dex: 3, wis: 6 },
    skills: ['fireball', 'frostRay'],
    glory: 'arenaInferno',
  },
  assassin: {
    id: 'assassin', name: 'Assassino', tagline: 'Velocidade, crítico e veneno.',
    passive: 'Letal: 25% de crítico com dano 2x e quase sempre age primeiro.',
    stats: base({ maxHp: 95, maxEnergy: 12, regen: 3, atk: 12, def: 4, speed: 9, crit: 0.25, critMult: 2 }),
    perks: {},
    attrs: { str: 3, dex: 6, wis: 2 },
    skills: ['venomBlade', 'shadowStrike'],
    glory: 'thousandCuts',
  },
};
