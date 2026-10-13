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
  // Ato II · Naumáquia (o Retiário é um arquétipo novo; os outros são variantes)
  retiarius: {
    id: 'retiarius', name: 'Retiário', desc: 'Rede e tridente: prende a presa e fura de longe.', xp: 30, gold: 22, attrs: { str: 4, dex: 6, wis: 1 },
    stats: base({ maxHp: 111, maxEnergy: 10, atk: 18, def: 3, speed: 8 }), skills: ['attack', 'net', 'trident'],
    pattern: ['net', 'trident', 'attack'], loot: ['blindPowder', 'potion', 'tonic'], posture: 4, weak: ['burn', 'physical'],
    barks: { start: 'A rede já está no ar. Você só ainda não viu.' },
  },
  corsair: {
    ...bandit, id: 'corsair', name: 'Corsário', desc: 'Pirata das galeras imperiais: corta sujo e arremessa fogo.', xp: 30, gold: 24,
    attrs: { str: 5, dex: 5, wis: 1 }, stats: { ...bandit.stats, maxHp: 111, maxEnergy: 10, atk: 20, def: 4, speed: 7 },
    skills: ['attack', 'dirtyCut', 'warCry'], pattern: ['dirtyCut', 'attack', 'warCry', 'attack'],
    loot: ['fireBomb', 'fireBomb', 'potion'], posture: 5, weak: ['stun', 'burn'],
    barks: { start: 'Esta água já engoliu frotas inteiras. Você é só mais um.' },
  },
  crocodile: {
    ...wolf, id: 'crocodile', name: 'Crocodilo do Nilo', desc: 'Couro duro e mandíbula que não solta.', xp: 30, gold: 18,
    attrs: { str: 6, dex: 4, wis: 1 }, stats: { ...wolf.stats, maxHp: 128, maxEnergy: 10, atk: 18, def: 6, speed: 6, crit: 0.1 },
    skills: ['attack', 'bite', 'deathRoll'], pattern: ['bite', 'attack', 'deathRoll'], posture: 5, weak: ['magic', 'stun'],
    barks: { start: 'Hsssss...' },
  },
  tideAugur: {
    ...sorcerer, id: 'tideAugur', name: 'Áugure das Marés', desc: 'Lê o futuro na água e afoga com magia.', xp: 32, gold: 24,
    stats: { ...sorcerer.stats, maxHp: 94, maxEnergy: 14, atk: 7, mag: 23, speed: 6 },
    skills: ['attack', 'frostRay', 'tidalWave', 'mend'], pattern: ['frostRay', 'tidalWave', 'attack', 'mend'],
    loot: ['tonic', 'salve', 'antidote'], posture: 4, weak: ['physical', 'poison'],
    barks: { start: 'As águas já me contaram como você cai.' },
  },
  // Ato II · Venatio
  lion: {
    ...wolf, id: 'lion', name: 'Leão da Venatio', desc: 'Rei da areia: salta e dilacera.', xp: 32, gold: 18,
    attrs: { str: 6, dex: 7, wis: 1 }, stats: { ...wolf.stats, maxHp: 119, maxEnergy: 10, atk: 20, def: 3, speed: 11, crit: 0.15 },
    skills: ['attack', 'maul', 'pounce'], pattern: ['maul', 'attack', 'pounce'], posture: 4, weak: ['burn', 'stun'],
    barks: { start: 'RRROOOAAARR!' },
  },
  bear: {
    ...brute, id: 'bear', name: 'Urso das Montanhas', desc: 'Lento, enorme e furioso: cada patada pesa como um tronco.', xp: 36, gold: 22,
    stats: { ...brute.stats, maxHp: 187, maxEnergy: 12, atk: 23, def: 6, speed: 3 },
    skills: ['attack', 'smash', 'roar'], pattern: ['attack', 'roar', 'smash'], posture: 6, weak: ['poison', 'magic'],
    barks: { start: 'GRRRUUUAAAH!' },
  },
  beastmaster: {
    ...bandit, id: 'beastmaster', name: 'Bestiário', desc: 'Caçador de feras: chicote, lança e iscas.', xp: 32, gold: 26,
    attrs: { str: 5, dex: 5, wis: 2 }, stats: { ...bandit.stats, maxHp: 119, maxEnergy: 10, atk: 20, def: 5, speed: 8 },
    skills: ['attack', 'whip', 'warCry'], pattern: ['whip', 'attack', 'warCry', 'attack'],
    loot: ['venomVial', 'blindPowder', 'potion'], posture: 5, weak: ['magic', 'poison'],
    barks: { start: 'Já domei coisa pior que você. Bem pior.' },
  },
  // Ato II · Anfiteatro da Coroação
  praetorian: {
    ...brute, id: 'praetorian', name: 'Pretoriano', desc: 'Guarda do imperador: escudo retangular e disciplina de ferro.', xp: 38, gold: 28,
    attrs: { str: 7, dex: 2, wis: 1 }, stats: { ...brute.stats, maxHp: 170, maxEnergy: 12, atk: 22, def: 10, speed: 4 }, perks: { counter: 0.3 },
    skills: ['attack', 'shieldBash', 'ironStance', 'smash'], pattern: ['attack', 'ironStance', 'shieldBash', 'smash'],
    loot: ['potion', 'guardStone', 'antidote'], posture: 7, weak: ['magic', 'poison'],
    barks: { start: 'Pelo imperador. Nenhum passo além daqui.' },
  },
  murmillo: {
    ...bandit, id: 'murmillo', name: 'Mirmilão', desc: 'Gladiador de elmo de peixe: gládio rápido atrás do escudo.', xp: 36, gold: 28,
    attrs: { str: 6, dex: 4, wis: 1 }, stats: { ...bandit.stats, maxHp: 136, maxEnergy: 12, atk: 22, def: 7, speed: 6 },
    skills: ['attack', 'dirtyCut', 'ironStance', 'cleave'], pattern: ['dirtyCut', 'attack', 'ironStance', 'cleave'],
    loot: ['potion', 'guardStone', 'fireBomb'], posture: 6, weak: ['stun', 'burn'],
    barks: { start: 'Peixe na rede ou peixe no espeto: escolha.' },
  },
  sagittarius: {
    ...wolf, id: 'sagittarius', name: 'Sagitário', desc: 'Arqueiro imperial: flechas rápidas, algumas em chamas.', xp: 34, gold: 26,
    attrs: { str: 3, dex: 8, wis: 2 }, stats: { ...wolf.stats, maxHp: 102, maxEnergy: 12, atk: 20, def: 3, speed: 12, crit: 0.2 },
    skills: ['attack', 'volley', 'fireArrow'], pattern: ['volley', 'attack', 'fireArrow'],
    loot: ['blindPowder', 'tonic', 'potion'], posture: 4, weak: ['physical', 'stun'],
    barks: { start: 'Daqui de cima, todo gladiador parece um alvo.' },
  },
  haruspex: {
    ...sorcerer, id: 'haruspex', name: 'Arúspice', desc: 'Sacerdote que lê entranhas: maldições, veneno e relâmpago.', xp: 38, gold: 28,
    attrs: { str: 1, dex: 4, wis: 8 }, stats: { ...sorcerer.stats, maxHp: 111, maxEnergy: 16, regen: 4, atk: 7, mag: 27, def: 3 },
    skills: ['attack', 'venomMist', 'lightning', 'mend'], pattern: ['venomMist', 'attack', 'lightning', 'mend'],
    loot: ['tonic', 'venomVial', 'salve'], posture: 4, weak: ['physical', 'burn'],
    barks: { start: 'As entranhas já disseram: hoje é o seu último dia.' },
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
  // Chefes do Ato II (Nerissa e Draco aceitam julgamento: poupar ou executar muda a história)
  nerissa: {
    id: 'nerissa', name: 'Nerissa, Rainha das Marés', desc: 'Chefe. Veloz, venenosa e agora vingativa.', xp: 120, gold: 90, attrs: { str: 5, dex: 9, wis: 5 },
    stats: base({ maxHp: 209, maxEnergy: 14, regen: 3, atk: 16, mag: 14, def: 5, speed: 12, crit: 0.12 }), perks: { poisonOnHit: 2 },
    skills: ['attack', 'bite', 'net', 'venomMist', 'tidalWave'],
    pattern: ['net', 'bite', 'attack', 'venomMist'], loot: ['venomVial', 'antidote', 'potion'],
    posture: 7, weak: ['magic', 'burn'], trial: true,
    phase2: { at: 0.5, pattern: ['tidalWave', 'bite', 'net', 'venomMist'], line: 'A maré sobe. Vamos ver quanto fôlego você tem.' },
    barks: { start: 'Você me tirou a coroa. Hoje eu tiro o resto.', low: 'Espere... não pode acabar assim. Não de novo.', playerCrit: 'Isso... vai custar caro.' },
  },
  hannibal: {
    id: 'hannibal', name: 'Aníbal, o Domador', desc: 'Chefe. Luta com chicote, lança e um leão de guerra; sem o leão, vira fúria.', xp: 140, gold: 100, attrs: { str: 7, dex: 5, wis: 3 },
    stats: base({ maxHp: 272, maxEnergy: 14, regen: 3, atk: 22, def: 6, speed: 7 }), perks: { counter: 0.2 },
    skills: ['attack', 'whip', 'pounce', 'roar', 'cleave'],
    pattern: ['whip', 'pounce', 'attack', 'roar'], loot: ['potion', 'blindPowder', 'venomVial'],
    posture: 7, weak: ['burn', 'stun'],
    phase2: {
      at: 0.5, pattern: ['cleave', 'attack', 'cleave', 'roar'], line: 'Meu leão caiu?! Então eu mesmo arranco sua garganta!',
      effects: [{ status: 'regen', target: 'self', turns: 3, power: 6 }],
    },
    barks: { start: 'Ajoelhe para a fera, ou vire carne para ela.', low: 'Eu devo a Varro... mais do que a vida.', playerCrit: 'Ha! Até o leão recuou.' },
  },
  draco: {
    id: 'draco', name: 'Draco, o Dragão de Varro', desc: 'Chefe. O campeão do imperador: fogo, aço e nenhuma hesitação.', xp: 160, gold: 120, attrs: { str: 7, dex: 6, wis: 5 },
    stats: base({ maxHp: 315, maxEnergy: 16, regen: 4, atk: 21, mag: 18, def: 8, speed: 8, crit: 0.1 }), perks: { counter: 0.2 },
    skills: ['attack', 'cleave', 'shieldBash', 'ironStance', 'dragonFlame'],
    pattern: ['cleave', 'attack', 'dragonFlame', 'ironStance'], loot: ['potion', 'fireBomb', 'salve'],
    posture: 7, weak: ['magic', 'burn'], trial: true,
    phase2: {
      at: 0.5, pattern: ['dragonFlame', 'cleave', 'shieldBash', 'attack'], line: 'Esse golpe... Quem te ensinou? Só uma pessoa no vale lutava assim.',
      effects: [{ status: 'guard', target: 'self', turns: 1 }],
    },
    barks: { start: 'O imperador pediu sua cabeça. Nada pessoal.', low: 'O rio... eu lembro de um rio...', playerCrit: 'Hm. Você aprendeu a bater.' },
  },
};
