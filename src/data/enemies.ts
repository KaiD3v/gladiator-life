import { base } from './stats';
import type { EnemyDef } from './types';

export const ENEMIES: Record<string, EnemyDef> = {
  bandit: {
    id: 'bandit', name: 'Bandido', desc: 'Equilibrado e oportunista.', xp: 20, gold: 16, attrs: { str: 4, dex: 4, wis: 1 },
    stats: base({ maxHp: 55, maxEnergy: 8, atk: 9, def: 3, speed: 5 }), skills: ['attack', 'dirtyCut'],
    pattern: ['attack', 'dirtyCut', 'attack', 'defend'],
  },
  wolf: {
    id: 'wolf', name: 'Lobo da Arena', desc: 'Rápido, morde com veneno.', xp: 20, gold: 12, attrs: { str: 3, dex: 7, wis: 1 },
    stats: base({ maxHp: 45, maxEnergy: 8, atk: 8, def: 2, speed: 10, crit: 0.15 }), skills: ['attack', 'bite'],
    pattern: ['bite', 'attack', 'attack'],
  },
  brute: {
    id: 'brute', name: 'Brutamontes', desc: 'Lento, resistente, pancadas atordoantes.', xp: 25, gold: 20, attrs: { str: 7, dex: 1, wis: 1 },
    stats: base({ maxHp: 85, maxEnergy: 10, atk: 12, def: 7, speed: 2 }), skills: ['attack', 'smash'],
    pattern: ['attack', 'attack', 'smash'],
  },
  sorcerer: {
    id: 'sorcerer', name: 'Feiticeiro Renegado', desc: 'Frágil, mas queima.', xp: 25, gold: 18, attrs: { str: 1, dex: 4, wis: 6 },
    stats: base({ maxHp: 50, maxEnergy: 12, regen: 3, atk: 4, mag: 12, def: 2, speed: 6 }), skills: ['attack', 'darkFlame'],
    pattern: ['darkFlame', 'attack', 'defend'],
  },
  tauros: {
    id: 'tauros', name: 'Tauros, o Campeão', desc: 'Chefe. Investidas brutais e rugido intimidador.', xp: 80, gold: 60, attrs: { str: 8, dex: 3, wis: 2 },
    stats: base({ maxHp: 135, maxEnergy: 12, regen: 3, atk: 11, def: 6, speed: 5 }), perks: { counter: 0.3 },
    skills: ['attack', 'charge', 'roar'],
    pattern: ['attack', 'charge', 'roar', 'attack'],
  },
  serpent: {
    id: 'serpent', name: 'Rainha Serpente', desc: 'Chefe. Veloz e venenosa.', xp: 100, gold: 80, attrs: { str: 4, dex: 8, wis: 4 },
    stats: base({ maxHp: 95, maxEnergy: 12, regen: 3, atk: 8, def: 4, speed: 11, crit: 0.1 }), perks: { poisonOnHit: 1 },
    skills: ['attack', 'bite', 'dirtyCut'],
    pattern: ['bite', 'dirtyCut', 'attack'],
  },
  emperor: {
    id: 'emperor', name: 'Imperador Caído', desc: 'Chefe. Magia sombria e vontade de ferro.', xp: 130, gold: 100, attrs: { str: 5, dex: 3, wis: 8 },
    stats: base({ maxHp: 200, maxEnergy: 16, regen: 4, atk: 10, mag: 15, def: 6, speed: 6 }), perks: { hpRegen: 2 },
    skills: ['attack', 'darkFlame', 'roar'],
    pattern: ['darkFlame', 'attack', 'roar', 'darkFlame'],
  },
};
