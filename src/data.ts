// Conteúdo do jogo. Somente dados: a lógica que os interpreta fica em combat.ts / run.ts.

export type ClassId = 'warrior' | 'mage' | 'assassin';
export type StatusId = 'poison' | 'burn' | 'stun' | 'guard' | 'weaken' | 'regen';
export type Attr = 'str' | 'dex' | 'wis';
export type Attrs = Record<Attr, number>;

export interface Stats {
  maxHp: number;
  maxEnergy: number;
  regen: number; // energia por rodada
  atk: number;
  mag: number;
  def: number;
  speed: number;
  crit: number; // chance 0..1
  critMult: number;
  block: number; // redução de dano ao defender (0..1)
}

export interface Perks {
  counter: number; // contra-ataque (fração do atk) quando defendendo/em guarda
  lifesteal: number; // fração do dano causado
  thorns: number; // fração do dano recebido refletida
  poisonOnHit: number; // veneno aplicado por golpe físico
  hpRegen: number; // vida por rodada
}

export interface Effect {
  status: StatusId;
  target: 'self' | 'foe';
  turns: number;
  power?: number;
  chance?: number; // padrão 1
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  type: 'physical' | 'magic' | 'defend' | 'self' | 'flee';
  power?: number; // multiplicador de atk/mag
  hits?: number; // golpes por uso (padrão 1)
  heal?: number; // cura base no próprio usuário (+ATTR_HEAL_BONUS por ponto do atributo)
  critBonus?: number;
  critIfPoisoned?: boolean;
  effects?: Effect[];
  // Habilidades de jogador: atributo que escala o efeito, requisito para aprender e preço no treinador
  attr?: Attr;
  req?: number;
  price?: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  tagline: string;
  passive: string;
  stats: Stats;
  perks: Partial<Perks>;
  attrs: Attrs;
  skills: [string, string];
}

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  stats: Stats;
  perks?: Partial<Perks>;
  skills: string[];
  attrs: Attrs;
  xp: number;
  gold: number;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  mods?: Partial<Stats>;
  perks?: Partial<Perks>;
}

export interface ArenaDef {
  id: string;
  name: string;
  desc: string;
  tier: number;
  pool: string[];
  fights: number;
  boss: string;
  days: number; // prazo da temporada: o chefe precisa cair até este dia
}

export type NpcId = 'merchant' | 'inn' | Attr;

export interface NpcDef {
  id: NpcId;
  name: string;
  role: string;
  greet: string[];
  deal: string[]; // após compra/treino/descanso
  poor: string[]; // sem ouro
  denied: string[]; // requisito não atendido, sem espaço ou desnecessário
}

export const STATUS_INFO: Record<StatusId, { name: string; desc: string }> = {
  poison: { name: 'Veneno', desc: 'Perde vida por rodada (acumula).' },
  burn: { name: 'Queimadura', desc: 'Perde vida por rodada.' },
  stun: { name: 'Atordoado', desc: 'Perde a próxima ação.' },
  guard: { name: 'Guarda', desc: 'Recebe metade do dano e contra-ataca.' },
  weaken: { name: 'Enfraquecido', desc: 'Causa 30% menos dano.' },
  regen: { name: 'Regeneração', desc: 'Recupera vida por rodada.' },
};

export const ATTR_INFO: Record<Attr, { name: string; short: string; desc: string }> = {
  str: { name: 'Força', short: 'FOR', desc: '+1 ataque e +5 vida máx. por ponto. Potencializa golpes de Força.' },
  dex: { name: 'Destreza', short: 'DES', desc: '+1 velocidade e +3% crítico por ponto. Potencializa golpes ágeis e decide fugas.' },
  wis: { name: 'Sabedoria', short: 'SAB', desc: '+1 magia e +1 energia máx. por ponto. Potencializa magias e curas.' },
};
/** Ganho de estatística por ponto de atributo acima do valor inicial da classe. */
export const ATTR_GAIN: Record<Attr, Partial<Stats>> = { str: { atk: 1, maxHp: 5 }, dex: { speed: 1, crit: 0.03 }, wis: { mag: 1, maxEnergy: 1 } };
export const ATTR_SKILL_BONUS = 0.5; // dano extra por ponto do atributo da habilidade
export const ATTR_HEAL_BONUS = 3; // cura extra por ponto do atributo da habilidade

export const SKILLS: Record<string, SkillDef> = {
  attack: { id: 'attack', name: 'Ataque', desc: 'Golpe básico. Sem custo.', cost: 0, type: 'physical', power: 1 },
  defend: { id: 'defend', name: 'Defender', desc: 'Age primeiro, reduz o dano da rodada e recupera +2 de energia.', cost: 0, type: 'defend' },
  flee: { id: 'flee', name: 'Fugir', desc: 'Age primeiro. Disputa de Destreza: se falhar, sofre um golpe de oportunidade.', cost: 0, type: 'flee' },
  // Força
  shieldBash: {
    id: 'shieldBash', name: 'Golpe de Escudo', desc: 'Dano físico 1.3x, 60% de chance de atordoar.', cost: 4, type: 'physical', power: 1.3,
    effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.6 }], attr: 'str', req: 4, price: 40,
  },
  ironStance: {
    id: 'ironStance', name: 'Postura de Ferro', desc: 'Guarda por 2 rodadas: metade do dano e contra-ataque a cada golpe.', cost: 3, type: 'self',
    effects: [{ status: 'guard', target: 'self', turns: 2 }], attr: 'str', req: 3, price: 35,
  },
  warCry: {
    id: 'warCry', name: 'Grito de Guerra', desc: 'Enfraquece o alvo por 2 rodadas e entra em guarda por 1.', cost: 4, type: 'self',
    effects: [{ status: 'weaken', target: 'foe', turns: 2 }, { status: 'guard', target: 'self', turns: 1 }], attr: 'str', req: 5, price: 40,
  },
  cleave: {
    id: 'cleave', name: 'Golpe Devastador', desc: 'Dano físico 1.9x. Escala com Força.', cost: 6, type: 'physical', power: 1.9,
    attr: 'str', req: 7, price: 55,
  },
  // Sabedoria
  fireball: {
    id: 'fireball', name: 'Bola de Fogo', desc: 'Dano mágico 1.6x e queimadura (4/rodada, 3 rodadas).', cost: 6, type: 'magic', power: 1.6,
    effects: [{ status: 'burn', target: 'foe', turns: 3, power: 4 }], attr: 'wis', req: 5, price: 45,
  },
  frostRay: {
    id: 'frostRay', name: 'Raio Gélido', desc: 'Dano mágico 1.1x e enfraquece o alvo por 2 rodadas.', cost: 4, type: 'magic', power: 1.1,
    effects: [{ status: 'weaken', target: 'foe', turns: 2 }], attr: 'wis', req: 3, price: 35,
  },
  mend: {
    id: 'mend', name: 'Prece Restauradora', desc: 'Cura 10 de vida +3 por ponto de Sabedoria.', cost: 5, type: 'self', heal: 10,
    attr: 'wis', req: 4, price: 45,
  },
  lightning: {
    id: 'lightning', name: 'Relâmpago', desc: 'Dano mágico 2.2x. Escala com Sabedoria.', cost: 8, type: 'magic', power: 2.2,
    attr: 'wis', req: 7, price: 60,
  },
  // Destreza
  venomBlade: {
    id: 'venomBlade', name: 'Lâmina Envenenada', desc: 'Dano físico 0.8x e veneno (3/rodada, acumula, 3 rodadas).', cost: 3, type: 'physical', power: 0.8,
    effects: [{ status: 'poison', target: 'foe', turns: 3, power: 3 }], attr: 'dex', req: 3, price: 35,
  },
  shadowStrike: {
    id: 'shadowStrike', name: 'Golpe Sombrio', desc: 'Dano físico 1.4x, +30% crítico. Crítico garantido em alvo envenenado.', cost: 5, type: 'physical', power: 1.4,
    critBonus: 0.3, critIfPoisoned: true, attr: 'dex', req: 5, price: 45,
  },
  lowBlow: {
    id: 'lowBlow', name: 'Golpe Baixo', desc: 'Dano físico 0.9x, 50% de chance de atordoar.', cost: 4, type: 'physical', power: 0.9,
    effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.5 }], attr: 'dex', req: 4, price: 40,
  },
  twinStrike: {
    id: 'twinStrike', name: 'Lâmina Dupla', desc: 'Dois golpes físicos de 0.75x (cada um pode ser crítico).', cost: 5, type: 'physical', power: 0.75, hits: 2,
    attr: 'dex', req: 7, price: 55,
  },
  // Inimigos
  dirtyCut: { id: 'dirtyCut', name: 'Corte Sujo', desc: 'Dano físico 1.3x.', cost: 4, type: 'physical', power: 1.3 },
  bite: {
    id: 'bite', name: 'Mordida', desc: 'Dano físico 0.9x e veneno.', cost: 3, type: 'physical', power: 0.9,
    effects: [{ status: 'poison', target: 'foe', turns: 3, power: 2 }],
  },
  smash: {
    id: 'smash', name: 'Pancada', desc: 'Dano físico 1.2x, 40% de chance de atordoar.', cost: 5, type: 'physical', power: 1.2,
    effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.4 }],
  },
  darkFlame: {
    id: 'darkFlame', name: 'Chama Negra', desc: 'Dano mágico 1.3x e queimadura.', cost: 5, type: 'magic', power: 1.3,
    effects: [{ status: 'burn', target: 'foe', turns: 2, power: 3 }],
  },
  charge: {
    id: 'charge', name: 'Investida', desc: 'Dano físico 1.6x, 40% de chance de atordoar.', cost: 6, type: 'physical', power: 1.6,
    effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.4 }],
  },
  roar: {
    id: 'roar', name: 'Rugido', desc: 'Enfraquece o alvo e regenera vida.', cost: 4, type: 'self',
    effects: [{ status: 'weaken', target: 'foe', turns: 2 }, { status: 'regen', target: 'self', turns: 3, power: 5 }],
  },
};

const base = (s: Partial<Stats>): Stats => ({
  maxHp: 60, maxEnergy: 10, regen: 2, atk: 8, mag: 2, def: 3, speed: 5, crit: 0.05, critMult: 1.75, block: 0.5, ...s,
});

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior', name: 'Guerreiro', tagline: 'Resistência, bloqueio e contra-ataque.',
    passive: 'Bloqueio pesado: ao defender recebe só 35% do dano e contra-ataca.',
    stats: base({ maxHp: 135, maxEnergy: 10, regen: 2, atk: 12, def: 8, speed: 4, block: 0.65 }),
    perks: { counter: 0.6 },
    attrs: { str: 6, dex: 3, wis: 2 },
    skills: ['shieldBash', 'ironStance'],
  },
  mage: {
    id: 'mage', name: 'Mago', tagline: 'Dano mágico, custo de energia e efeitos.',
    passive: 'Mente arcana: +4 de energia por rodada. Magia ignora metade da defesa.',
    stats: base({ maxHp: 85, maxEnergy: 16, regen: 4, atk: 5, mag: 15, def: 3, speed: 5 }),
    perks: {},
    attrs: { str: 2, dex: 3, wis: 6 },
    skills: ['fireball', 'frostRay'],
  },
  assassin: {
    id: 'assassin', name: 'Assassino', tagline: 'Velocidade, crítico e veneno.',
    passive: 'Letal: 25% de crítico com dano 2x e quase sempre age primeiro.',
    stats: base({ maxHp: 95, maxEnergy: 12, regen: 3, atk: 12, def: 4, speed: 9, crit: 0.25, critMult: 2 }),
    perks: {},
    attrs: { str: 3, dex: 6, wis: 2 },
    skills: ['venomBlade', 'shadowStrike'],
  },
};

export const ENEMIES: Record<string, EnemyDef> = {
  bandit: {
    id: 'bandit', name: 'Bandido', desc: 'Equilibrado e oportunista.', xp: 20, gold: 16, attrs: { str: 4, dex: 4, wis: 1 },
    stats: base({ maxHp: 55, maxEnergy: 8, atk: 9, def: 3, speed: 5 }), skills: ['attack', 'dirtyCut'],
  },
  wolf: {
    id: 'wolf', name: 'Lobo da Arena', desc: 'Rápido, morde com veneno.', xp: 20, gold: 12, attrs: { str: 3, dex: 7, wis: 1 },
    stats: base({ maxHp: 45, maxEnergy: 8, atk: 8, def: 2, speed: 10, crit: 0.15 }), skills: ['attack', 'bite'],
  },
  brute: {
    id: 'brute', name: 'Brutamontes', desc: 'Lento, resistente, pancadas atordoantes.', xp: 25, gold: 20, attrs: { str: 7, dex: 1, wis: 1 },
    stats: base({ maxHp: 85, maxEnergy: 10, atk: 12, def: 7, speed: 2 }), skills: ['attack', 'smash'],
  },
  sorcerer: {
    id: 'sorcerer', name: 'Feiticeiro Renegado', desc: 'Frágil, mas queima.', xp: 25, gold: 18, attrs: { str: 1, dex: 4, wis: 6 },
    stats: base({ maxHp: 50, maxEnergy: 12, regen: 3, atk: 4, mag: 12, def: 2, speed: 6 }), skills: ['attack', 'darkFlame'],
  },
  tauros: {
    id: 'tauros', name: 'Tauros, o Campeão', desc: 'Chefe. Investidas brutais e rugido intimidador.', xp: 80, gold: 60, attrs: { str: 8, dex: 3, wis: 2 },
    stats: base({ maxHp: 135, maxEnergy: 12, regen: 3, atk: 11, def: 6, speed: 5 }), perks: { counter: 0.3 },
    skills: ['attack', 'charge', 'roar'],
  },
  serpent: {
    id: 'serpent', name: 'Rainha Serpente', desc: 'Chefe. Veloz e venenosa.', xp: 100, gold: 80, attrs: { str: 4, dex: 8, wis: 4 },
    stats: base({ maxHp: 95, maxEnergy: 12, regen: 3, atk: 8, def: 4, speed: 11, crit: 0.1 }), perks: { poisonOnHit: 1 },
    skills: ['attack', 'bite', 'dirtyCut'],
  },
  emperor: {
    id: 'emperor', name: 'Imperador Caído', desc: 'Chefe. Magia sombria e vontade de ferro.', xp: 130, gold: 100, attrs: { str: 5, dex: 3, wis: 8 },
    stats: base({ maxHp: 200, maxEnergy: 16, regen: 4, atk: 10, mag: 15, def: 6, speed: 6 }), perks: { hpRegen: 2 },
    skills: ['attack', 'darkFlame', 'roar'],
  },
};

export const ITEMS: Record<string, ItemDef> = {
  chippedSword: { id: 'chippedSword', name: 'Espada Lascada', price: 30, desc: '+3 de ataque.', mods: { atk: 3 } },
  bronzeShield: { id: 'bronzeShield', name: 'Escudo de Bronze', price: 30, desc: '+3 de defesa.', mods: { def: 3 } },
  emberAmulet: { id: 'emberAmulet', name: 'Amuleto de Brasa', price: 35, desc: '+4 de magia.', mods: { mag: 4 } },
  swiftBoots: { id: 'swiftBoots', name: 'Botas Velozes', price: 35, desc: '+3 de velocidade.', mods: { speed: 3 } },
  serratedDagger: { id: 'serratedDagger', name: 'Adaga Serrilhada', price: 40, desc: '+10% de chance de crítico.', mods: { crit: 0.1 } },
  titanHeart: { id: 'titanHeart', name: 'Coração de Titã', price: 45, desc: '+25 de vida máxima (e cura 25).', mods: { maxHp: 25 } },
  manaCrystal: { id: 'manaCrystal', name: 'Cristal de Mana', price: 40, desc: '+3 de energia máxima e +1 por rodada.', mods: { maxEnergy: 3, regen: 1 } },
  vampireChalice: { id: 'vampireChalice', name: 'Cálice Vampírico', price: 55, desc: 'Cura 20% do dano causado.', perks: { lifesteal: 0.2 } },
  thornCloak: { id: 'thornCloak', name: 'Manto de Espinhos', price: 45, desc: 'Reflete 30% do dano recebido.', perks: { thorns: 0.3 } },
  venomFlask: { id: 'venomFlask', name: 'Frasco de Peçonha', price: 45, desc: 'Golpes físicos aplicam veneno 2.', perks: { poisonOnHit: 2 } },
  ritualBandage: { id: 'ritualBandage', name: 'Bandagem Ritual', price: 50, desc: 'Recupera 3 de vida por rodada.', perks: { hpRegen: 3 } },
  warHorn: { id: 'warHorn', name: 'Trompa de Guerra', price: 45, desc: 'Contra-ataca 40% do ataque ao defender.', perks: { counter: 0.4 } },
};

/** Fases da campanha, em ordem: o campeão de uma arena é transferido para a seguinte. */
export const ARENAS: ArenaDef[] = [
  { id: 'pit', name: 'Fosso de Areia', desc: 'Onde todo gladiador começa.', tier: 1, pool: ['bandit', 'wolf', 'brute', 'sorcerer'], fights: 3, boss: 'tauros', days: 10 },
  { id: 'colosseum', name: 'Coliseu de Pedra', desc: 'Multidões maiores, inimigos mais duros.', tier: 2, pool: ['bandit', 'wolf', 'brute', 'sorcerer'], fights: 4, boss: 'serpent', days: 12 },
  { id: 'crimson', name: 'Arena Rubra', desc: 'Só os lendários saem daqui.', tier: 3, pool: ['wolf', 'brute', 'sorcerer'], fights: 4, boss: 'emperor', days: 13 },
];

export const NPCS: Record<NpcId, NpcDef> = {
  merchant: {
    id: 'merchant', name: 'Cássio', role: 'Mercador',
    greet: ['Aço bom, preço justo! Bem... quase justo.', 'Sobreviveu de novo? Isso pede equipamento novo!', 'Tudo aqui já salvou a vida de alguém. Às vezes.'],
    deal: ['Ótima escolha! Use com sabedoria.', 'Negócio fechado. Volte vivo, preciso de clientes.', 'Isso vai fazer a multidão gritar seu nome!'],
    poor: ['Sem moedas, sem mercadoria, gladiador.', 'Volte quando seu bolso pesar mais que sua espada.'],
    denied: ['Você já carrega um desses.'],
  },
  inn: {
    id: 'inn', name: 'Marta', role: 'Estalajadeira',
    greet: ['Cama quente e ensopado, por um punhado de moedas.', 'Você parece um saco de pancadas. Descanse um pouco.'],
    deal: ['Durma bem. A arena não vai a lugar nenhum.', 'Coma tudo, está magro demais para morrer amanhã.'],
    poor: ['Sem moedas? O estábulo está livre... e os cavalos quase não roncam.'],
    denied: ['Você já está inteiro. Vá lutar!'],
  },
  str: {
    id: 'str', name: 'Brutus', role: 'Treinador de Força',
    greet: ['Músculo não cresce sozinho. Pegue essa pedra!', 'Lutei vinte anos naquela areia. Quer aprender a bater de verdade?'],
    deal: ['Ha! Sentiu isso? É força nova nos braços.', 'Mais um golpe desses e nem o Tauros fica de pé.'],
    poor: ['Treino custa. Nem eu levanto peso de graça.'],
    denied: ['Fraco demais para essa técnica. Treine Força primeiro.', 'Sua cabeça já está cheia de golpes. Não cabe mais nenhum.'],
  },
  dex: {
    id: 'dex', name: 'Lyra', role: 'Treinadora de Destreza',
    greet: ['Quem acerta primeiro vive mais. Vamos ver seus pés.', 'Leveza, precisão e uma lâmina no lugar certo.'],
    deal: ['Mais rápido que a própria sombra. Bom trabalho.', 'Agora você vê o golpe antes de ele existir.'],
    poor: ['Minhas lições não são de graça, querido.'],
    denied: ['Lento demais para isso. Treine Destreza comigo antes.', 'Você já sabe técnicas demais. Foco é tudo.'],
  },
  wis: {
    id: 'wis', name: 'Mestre Oren', role: 'Treinador de Sabedoria',
    greet: ['A mente é a lâmina mais afiada. Sente-se.', 'O fogo obedece a quem entende o fogo.'],
    deal: ['Sinto a energia fluindo em você. Excelente.', 'Mais um véu levantado. Siga estudando.'],
    poor: ['O conhecimento é livre. Meu tempo, não.'],
    denied: ['Ainda não está pronto para este tomo. Medite mais.', 'Sua mente está cheia. Domine o que já sabe.'],
  },
};

export const START_GOLD = 30;
export const GOLD_PER_LEVEL = 10; // ouro inicial extra por nível permanente
export const REST_PRICE = 15; // por nível de perigo da arena
export const REST_PAID = 0.5; // fração da vida recuperada pagando a estalagem
export const REST_FREE = 0.2; // fração recuperada dormindo de graça no estábulo
export const TRAIN_BASE = 25; // preço do 1º treino de um atributo
export const TRAIN_STEP = 15; // aumento por treino já feito naquele atributo
export const MAX_SKILLS = 4;
export const SHOP_SIZE = 4;
export const XP_PER_LEVEL = 100; // passar do nível N para N+1 custa XP_PER_LEVEL * N
export const HP_PER_LEVEL = 4;
export const WIN_BONUS_XP = 50; // por título de campeão, multiplicado pelo nível de perigo da arena
