import type { ActDef, ArenaDef } from './types';

/** Atos da história, em ordem; dentro de cada um, o campeão de uma arena é transferido para a seguinte. */
export const ACTS: ActDef[] = [
  { id: 'chains', name: 'Correntes', camp: { name: 'Ludus do Fosso', bg: 'bg-town', npcs: ['cassio', 'brutus', 'lyra', 'oren', 'marta'] }, arenas: [
    { id: 'pit', name: 'Fosso de Areia', desc: 'Onde todo gladiador começa.', tier: 1, pool: ['bandit', 'wolf', 'brute', 'sorcerer'], fights: 3, boss: 'tauros', days: 10,
      hazard: { id: 'sandstorm', name: 'Rajada de areia', every: 4, first: 3, warn: 'O vento levanta a areia do fosso… proteja-se na próxima rodada!', strike: 'Uma rajada de areia varre a arena!', effects: [{ status: 'weaken', turns: 1 }] } },
    { id: 'colosseum', name: 'Coliseu de Pedra', desc: 'Multidões maiores, inimigos mais duros.', tier: 2, pool: ['banditLeader', 'direWolf', 'bruteWarrior', 'elderSorcerer'], fights: 4, boss: 'serpent', days: 12,
      hazard: { id: 'crowdthrow', name: 'Arremesso da plateia', every: 4, first: 3, warn: 'A plateia agita cestos e frutas… algo vai voar na próxima rodada!', strike: 'A plateia arremessa provisões ao seu favorito!', gift: 0.12 } },
    { id: 'crimson', name: 'Arena Rubra', desc: 'Só os lendários saem daqui.', tier: 3, pool: ['hellhound', 'executioner', 'necromancer'], fights: 4, boss: 'emperor', days: 13,
      hazard: { id: 'braziers', name: 'Braseiros', every: 3, first: 3, warn: 'Os braseiros ganham fôlego… as brasas voam na próxima rodada!', strike: 'Os braseiros cospem brasas sobre a arena!', effects: [{ status: 'burn', turns: 2, power: 2 }] } },
  ] },
  {
    id: 'oath', name: 'O Juramento',
    features: { demands: true, rival: true, ally: 'taurosCharge' },
    camp: { name: 'Ludus da Subura', bg: 'bg-subura', npcs: ['sabina', 'tauros', 'lyra', 'oren', 'marta'] },
    arenas: [
      { id: 'naumachia', name: 'Naumáquia', desc: 'O lago imperial alagado para batalhas navais.', tier: 4, pool: ['retiarius', 'corsair', 'crocodile', 'tideAugur'], fights: 3, boss: 'nerissa', days: 11,
        hazard: { id: 'tide', name: 'Maré', every: 4, first: 3, warn: 'A água do lago recua… uma onda vem na próxima rodada!', strike: 'Uma onda varre a arena!', effects: [{ status: 'stun', turns: 1 }] } },
      { id: 'venatio', name: 'Venatio', desc: 'A arena das feras e dos caçadores.', tier: 5, pool: ['lion', 'bear', 'beastmaster', 'retiarius'], fights: 4, boss: 'hannibal', days: 12,
        hazard: { id: 'cages', name: 'Jaulas abertas', every: 4, first: 3, warn: 'As jaulas rangem sob a areia… uma fera vai escapar na próxima rodada!', strike: 'Uma fera escapa e morde quem estiver desprotegido!', effects: [{ status: 'poison', turns: 3, power: 3 }] } },
      { id: 'coronation', name: 'Anfiteatro da Coroação', desc: 'Os Jogos do novo imperador.', tier: 6, pool: ['praetorian', 'murmillo', 'sagittarius', 'haruspex'], fights: 4, boss: 'draco', days: 13,
        hazard: { id: 'praetorians', name: 'Flechas pretorianas', every: 3, first: 3, warn: 'Os arqueiros da guarda miram o favorito da multidão… flechas na próxima rodada!', strike: 'Os pretorianos disparam contra o favorito da plebe!', harm: 0.1 } },
    ],
  },
];

/** Todas as arenas da história, em ordem (ids únicos entre os atos). */
export const ARENAS: ArenaDef[] = ACTS.flatMap((a) => a.arenas);
