// Números de balanceamento da economia e da progressão.

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
// Escala dos inimigos por nível de perigo da arena acima do 1 (tier - 1).
export const ENEMY_SCALE_PER_TIER = 0.2; // vida, ataque e magia: +20% por tier
export const ENEMY_DEF_PER_TIER = 1; // defesa somada por tier
export const ENEMY_DEX_PER_TIER = 1; // destreza somada por tier

// Torcida (multidão): favor 0..100 que recompensa jogo vistoso e pune jogo covarde.
export const CROWD = {
  start: 30, // favor ao entrar na arena
  // Ganhos
  crit: 10, // crítico do jogador
  stun: 8, // atordoamento aplicado ao inimigo
  interrupt: 10, // extra: atordoar um inimigo que está preparando golpe pesado
  counter: 6, // contra-ataque do jogador
  perfectBlock: 12, // defender na rodada em que o golpe pesado anunciado acerta
  variety: 3, // ação de ataque/habilidade diferente da rodada anterior
  execute: 15, // veredito: executar
  // Perdas
  repeatAfter: 3, // a partir da N-ésima repetição seguida da mesma ação...
  repeat: -6, // ...cada repetição custa isto
  coward: -5, // defender quando o inimigo não vai causar dano (defesa, buff, preparo)
  failedFlee: -15,
  critTaken: -5, // jogador sofre crítico
  // Efeitos
  ovationAt: 50, // com o favor nesse valor ou mais, o jogador causa +ovationBonus de dano
  ovationBonus: 0.05,
  gloryDrop: 40, // favor depois de usar o Golpe de Glória (só usável com 100)
  lastStandAt: 80, // favor mínimo para "A multidão exige mais!" (1 vez por luta, salva da morte com 1 de vida)
  lastStandCost: 40,
  verdictHp: 0.15, // fração de vida do inimigo (luta comum) que libera Executar/Poupar
  // Recompensas (state/campaign.ts): ouro × (1 + favor/goldDivisor)
  goldDivisor: 300,
  executeGold: 1.25, // multiplicador extra de ouro ao executar
  spareGold: 0.5, // poupar: menos ouro...
  spareXp: 1.5, // ...e mais XP
};

