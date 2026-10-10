import { base } from './stats';
import type { EnemyDef } from './types';

// Adversários comuns do Fosso. As arenas seguintes usam variantes derivadas deles (ver ENEMIES).
const bandit: EnemyDef = {
  id: 'bandit', name: 'Bandido', desc: 'Equilibrado e oportunista.', xp: 20, gold: 16, attrs: { str: 4, dex: 4, wis: 1 },
  stats: base({ maxHp: 55, maxEnergy: 8, atk: 9, def: 3, speed: 5 }), skills: ['attack', 'dirtyCut'],
  pattern: ['attack', 'dirtyCut', 'attack', 'defend'], loot: ['fireBomb', 'blindPowder', 'potion'],
  posture: 4, weak: ['poison', 'magic'], barks: { start: 'Passe o ouro e talvez saia com vida!' },
};
const wolf: EnemyDef = {
  id: 'wolf', name: 'Lobo da Arena', desc: 'Rápido, morde com veneno.', xp: 20, gold: 12, attrs: { str: 3, dex: 7, wis: 1 },
  stats: base({ maxHp: 45, maxEnergy: 8, atk: 8, def: 2, speed: 10, crit: 0.15 }), skills: ['attack', 'bite'],
  pattern: ['bite', 'attack', 'attack'],
  posture: 3, weak: ['burn', 'stun'], barks: { start: 'Grrrr...!' },
};
const brute: EnemyDef = {
  id: 'brute', name: 'Brutamontes', desc: 'Lento, resistente, pancadas atordoantes.', xp: 25, gold: 20, attrs: { str: 7, dex: 1, wis: 1 },
  stats: base({ maxHp: 85, maxEnergy: 10, atk: 12, def: 7, speed: 2 }), skills: ['attack', 'smash'],
  pattern: ['attack', 'attack', 'smash'], loot: ['potion', 'guardStone'],
  posture: 5, weak: ['magic', 'stun'], barks: { start: 'Vou te esmagar como a um inseto!' },
};
const sorcerer: EnemyDef = {
  id: 'sorcerer', name: 'Feiticeiro Renegado', desc: 'Frágil, mas queima.', xp: 25, gold: 18, attrs: { str: 1, dex: 4, wis: 6 },
  stats: base({ maxHp: 50, maxEnergy: 12, regen: 3, atk: 4, mag: 12, def: 2, speed: 6 }), skills: ['attack', 'darkFlame'],
  pattern: ['darkFlame', 'attack', 'defend'], loot: ['tonic', 'fireBomb', 'antidote'],
  posture: 3, weak: ['physical', 'poison'], barks: { start: 'Sinta a chama negra!' },
};

/*
 * Variantes: cada arena traz versões mais fortes dos adversários anteriores. Herdam tudo do original (espalhado) e
 * sobrescrevem só o que muda; a escala por nível de perigo da arena (createEnemyFighter) continua valendo por cima.
 */
export const ENEMIES: Record<string, EnemyDef> = {
  bandit, wolf, brute, sorcerer,
  // Coliseu de Pedra
  banditLeader: {
    ...bandit, id: 'banditLeader', name: 'Bandido Líder', desc: 'Comanda o bando: corta sujo e grita ordens que enfraquecem.', xp: 24, gold: 20,
    attrs: { str: 5, dex: 5, wis: 2 }, stats: { ...bandit.stats, maxHp: 60, maxEnergy: 10, atk: 10, def: 4, speed: 6 },
    skills: ['attack', 'dirtyCut', 'warCry'], pattern: ['dirtyCut', 'attack', 'warCry', 'attack'],
    loot: ['fireBomb', 'blindPowder', 'venomVial', 'potion'], posture: 5, weak: ['poison', 'stun'],
    barks: { start: 'Cerquem! Quero a bolsa inteira, e a cabeça também.' },
  },
  direWolf: {
    ...wolf, id: 'direWolf', name: 'Lobo Atroz', desc: 'Maior e mais feroz: dilacera com mordidas seguidas.', xp: 24, gold: 14,
    stats: { ...wolf.stats, maxHp: 55, maxEnergy: 9, atk: 9, def: 3, speed: 11 },
    skills: ['attack', 'bite', 'maul'], pattern: ['bite', 'maul', 'attack'], posture: 4, weak: ['burn', 'magic'],
    barks: { start: 'GRRRAAAH!' },
  },
  bruteWarrior: {
    ...brute, id: 'bruteWarrior', name: 'Guerreiro Brutamontes', desc: 'Brutamontes de armadura: ergue a guarda e devolve cada golpe.', xp: 30, gold: 24,
    stats: { ...brute.stats, maxHp: 90, maxEnergy: 12, def: 9 }, perks: { counter: 0.25 },
    skills: ['attack', 'smash', 'ironStance'], pattern: ['attack', 'ironStance', 'attack', 'smash'],
    loot: ['potion', 'guardStone', 'antidote'], posture: 6, weak: ['magic', 'poison'],
    barks: { start: 'Escudo erguido, clava pronta. Venha!' },
  },
  elderSorcerer: {
    ...sorcerer, id: 'elderSorcerer', name: 'Feiticeiro Ancião', desc: 'Séculos de magia: queima, enfraquece e se cura.', xp: 30, gold: 22,
    stats: { ...sorcerer.stats, maxHp: 55, maxEnergy: 14, mag: 13, speed: 5 },
    skills: ['attack', 'darkFlame', 'frostRay', 'mend'], pattern: ['darkFlame', 'frostRay', 'attack', 'mend'],
    loot: ['tonic', 'salve', 'antidote', 'fireBomb'], posture: 4, weak: ['physical', 'stun'],
    barks: { start: 'Eu já queimava gladiadores antes de os seus avós nascerem.' },
  },
  // Arena Rubra
  hellhound: {
    ...wolf, id: 'hellhound', name: 'Cão Infernal', desc: 'Fera das brasas: mordidas que queimam.', xp: 28, gold: 16,
    stats: { ...wolf.stats, maxHp: 60, maxEnergy: 10, atk: 10, def: 3, speed: 11 },
    skills: ['attack', 'bite', 'fireBite'], pattern: ['fireBite', 'attack', 'bite'], posture: 4, weak: ['stun', 'poison'],
    barks: { start: 'Hhhrrr... GRAAAH!' },
  },
  executioner: {
    ...brute, id: 'executioner', name: 'Carrasco Rubro', desc: 'Machado enorme e golpes devastadores.', xp: 34, gold: 26,
    stats: { ...brute.stats, maxHp: 90, maxEnergy: 12, speed: 3 },
    skills: ['attack', 'cleave', 'smash'], pattern: ['attack', 'cleave', 'attack', 'smash'],
    loot: ['potion', 'guardStone', 'fireBomb'], posture: 6, weak: ['magic', 'stun'],
    barks: { start: 'A plebe pediu sangue. Ajoelhe-se.' },
  },
  necromancer: {
    ...sorcerer, id: 'necromancer', name: 'Necromante', desc: 'Névoa peçonhenta, chama negra e relâmpagos.', xp: 34, gold: 26,
    attrs: { str: 1, dex: 4, wis: 7 }, stats: { ...sorcerer.stats, maxHp: 60, maxEnergy: 16, regen: 4, mag: 14, def: 3 },
    skills: ['attack', 'darkFlame', 'venomMist', 'lightning'], pattern: ['venomMist', 'darkFlame', 'attack', 'lightning'],
    loot: ['tonic', 'venomVial', 'salve', 'antidote'], posture: 4, weak: ['physical', 'burn'],
    barks: { start: 'Os mortos desta arena me emprestam a força deles.' },
  },
  // Chefes
  tauros: {
    id: 'tauros', name: 'Tauros, o Campeão', desc: 'Chefe. Investidas brutais e rugido intimidador.', xp: 80, gold: 60, attrs: { str: 8, dex: 3, wis: 2 },
    stats: base({ maxHp: 135, maxEnergy: 12, regen: 3, atk: 11, def: 6, speed: 5 }), perks: { counter: 0.3 },
    skills: ['attack', 'charge', 'roar'],
    pattern: ['attack', 'charge', 'roar', 'attack'], loot: ['potion', 'guardStone', 'fireBomb'],
    posture: 6, weak: ['magic', 'poison'],
    phase2: {
      at: 0.5, pattern: ['charge', 'defend', 'attack', 'charge', 'roar'], line: 'Chega de brincar!',
      effects: [{ status: 'guard', target: 'self', turns: 2 }],
    },
    barks: { start: 'Venha. A areia não perdoa quem hesita.', low: 'Ainda... de pé. Termine logo!', playerCrit: 'Hah! Esse eu senti.' },
  },
  serpent: {
    id: 'serpent', name: 'Rainha Serpente', desc: 'Chefe. Veloz e venenosa.', xp: 100, gold: 80, attrs: { str: 4, dex: 8, wis: 4 },
    stats: base({ maxHp: 95, maxEnergy: 12, regen: 3, atk: 8, def: 4, speed: 11, crit: 0.1 }), perks: { poisonOnHit: 1 },
    skills: ['attack', 'bite', 'dirtyCut', 'venomMist'],
    pattern: ['bite', 'dirtyCut', 'attack'], loot: ['venomVial', 'antidote', 'potion'],
    posture: 6, weak: ['burn', 'physical'],
    phase2: { at: 0.5, pattern: ['bite', 'venomMist', 'dirtyCut', 'venomMist'], line: 'Chega de joguinhos. Respire fundo... se puder.' },
    barks: { start: 'Dance para mim. Quero ver você sangrar com elegância.', low: 'Não! A coroa... fique longe da coroa!', playerCrit: 'Ora, ora... tem dentes.' },
  },
  emperor: {
    id: 'emperor', name: 'Imperador Caído', desc: 'Chefe. Magia sombria e vontade de ferro.', xp: 130, gold: 100, attrs: { str: 5, dex: 3, wis: 8 },
    stats: base({ maxHp: 200, maxEnergy: 16, regen: 4, atk: 10, mag: 15, def: 6, speed: 6 }), perks: { hpRegen: 2 },
    skills: ['attack', 'darkFlame', 'roar', 'brazier'],
    pattern: ['darkFlame', 'attack', 'roar', 'darkFlame'], loot: ['fireBomb', 'tonic', 'salve', 'potion'],
    posture: 6, weak: ['magic', 'burn', 'stun'],
    phase2: { at: 0.5, pattern: ['darkFlame', 'brazier', 'roar', 'darkFlame', 'brazier'], line: 'Acendam os braseiros! Que a plebe veja um imperador arder.' },
    barks: { start: 'Outra alma para a plebe aplaudir...', low: 'Silêncio... finalmente?', playerCrit: 'Há muito eu não sentia dor.' },
  },
};
