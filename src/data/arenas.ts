import type { ArenaDef } from './types';

/** Fases da campanha, em ordem: o campeão de uma arena é transferido para a seguinte. */
export const ARENAS: ArenaDef[] = [
  { id: 'pit', name: 'Fosso de Areia', desc: 'Onde todo gladiador começa.', tier: 1, pool: ['bandit', 'wolf', 'brute', 'sorcerer'], fights: 3, boss: 'tauros', days: 10 },
  { id: 'colosseum', name: 'Coliseu de Pedra', desc: 'Multidões maiores, inimigos mais duros.', tier: 2, pool: ['bandit', 'wolf', 'brute', 'sorcerer'], fights: 4, boss: 'serpent', days: 12 },
  { id: 'crimson', name: 'Arena Rubra', desc: 'Só os lendários saem daqui.', tier: 3, pool: ['wolf', 'brute', 'sorcerer'], fights: 4, boss: 'emperor', days: 13 },
];
