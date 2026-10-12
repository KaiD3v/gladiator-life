import type { ActDef, ArenaDef } from './types';

/** Atos da história, em ordem; dentro de cada um, o campeão de uma arena é transferido para a seguinte. */
export const ACTS: ActDef[] = [
  { id: 'chains', name: 'Correntes', arenas: [
    { id: 'pit', name: 'Fosso de Areia', desc: 'Onde todo gladiador começa.', tier: 1, pool: ['bandit', 'wolf', 'brute', 'sorcerer'], fights: 3, boss: 'tauros', days: 10,
      hazard: { id: 'sandstorm', name: 'Rajada de areia', every: 4, first: 3, warn: 'O vento levanta a areia do fosso… proteja-se na próxima rodada!', strike: 'Uma rajada de areia varre a arena!', effects: [{ status: 'weaken', turns: 1 }] } },
    { id: 'colosseum', name: 'Coliseu de Pedra', desc: 'Multidões maiores, inimigos mais duros.', tier: 2, pool: ['banditLeader', 'direWolf', 'bruteWarrior', 'elderSorcerer'], fights: 4, boss: 'serpent', days: 12,
      hazard: { id: 'crowdthrow', name: 'Arremesso da plateia', every: 4, first: 3, warn: 'A plateia agita cestos e frutas… algo vai voar na próxima rodada!', strike: 'A plateia arremessa provisões ao seu favorito!', gift: 0.12 } },
    { id: 'crimson', name: 'Arena Rubra', desc: 'Só os lendários saem daqui.', tier: 3, pool: ['hellhound', 'executioner', 'necromancer'], fights: 4, boss: 'emperor', days: 13,
      hazard: { id: 'braziers', name: 'Braseiros', every: 3, first: 3, warn: 'Os braseiros ganham fôlego… as brasas voam na próxima rodada!', strike: 'Os braseiros cospem brasas sobre a arena!', effects: [{ status: 'burn', turns: 2, power: 2 }] } },
  ] },
];

/** Todas as arenas da história, em ordem (ids únicos entre os atos). */
export const ARENAS: ArenaDef[] = ACTS.flatMap((a) => a.arenas);
