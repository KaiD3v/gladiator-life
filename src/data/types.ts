// Tipos do conteúdo do jogo. Só formas de dados: nenhum valor aqui.

export type ClassId = 'warrior' | 'mage' | 'assassin';
export type StatusId = 'poison' | 'burn' | 'stun' | 'guard' | 'weaken' | 'regen' | 'steady' | 'broken';
/** Ponto fraco de um inimigo: tipo de golpe (physical/magic) ou efeito aplicado (poison/burn/stun). */
export type WeakTag = 'physical' | 'magic' | 'poison' | 'burn' | 'stun';
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
  type: 'physical' | 'magic' | 'defend' | 'self' | 'flee' | 'verdict'; // verdict: Executar/Poupar (fim imediato da luta)
  power?: number; // multiplicador de atk/mag
  hits?: number; // golpes por uso (padrão 1)
  heal?: number; // cura base no próprio usuário (+ATTR_HEAL_BONUS por ponto do atributo)
  energy?: number; // energia recuperada pelo próprio usuário
  cleanse?: boolean; // remove veneno, queimadura e enfraquecer do próprio usuário
  critBonus?: number;
  critIfPoisoned?: boolean;
  windup?: boolean; // golpe pesado: quando o inimigo o usa, gasta uma rodada preparando e só acerta na seguinte
  glory?: boolean; // Golpe de Glória: só usável com a torcida em 100
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
  glory: string; // Golpe de Glória da classe (id em SKILLS)
}

export interface EnemyDef {
  id: string;
  name: string;
  desc: string;
  stats: Stats;
  perks?: Partial<Perks>;
  skills: string[];
  pattern: string[]; // ciclo de ações (ids de habilidade ou 'defend'), uma por rodada
  attrs: Attrs;
  xp: number;
  gold: number;
  loot?: string[]; // consumíveis que pode carregar para a luta (sorteados); o que não usar cai para o vencedor
  posture: number; // pontos de postura: a cada golpe/efeito no ponto fraco perde 1; em 0 o inimigo fica Desequilibrado
  weak: WeakTag[];
  /** Chefe: ao cair a esta fração de vida (uma vez), fala `line`, aplica `effects` em si e troca o padrão. */
  phase2?: { at: number; pattern: string[]; line: string; effects?: Effect[] };
  /** Falas do inimigo (cada uma no máximo uma vez por luta). `hurt`: 1ª vez abaixo de 50% (só sem phase2); `low`: até 20%. */
  barks?: { start?: string; hurt?: string; low?: string; playerCrit?: string };
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  mods?: Partial<Stats>;
  perks?: Partial<Perks>;
  /**
   * Consumível: vai para a bolsa (não para o equipamento) e vira uma ação de combate de custo 0 com este efeito
   * (entrada de mesmo id em SKILLS). Sem efeito no inimigo é item de defesa: age primeiro, como Defender.
   */
  use?: Pick<SkillDef, 'heal' | 'energy' | 'cleanse' | 'effects'>;
}

/** Perigo da arena, sempre anunciado uma rodada antes. `first`: rodada em que acontece pela 1ª vez (fim da rodada); `every`: intervalo depois. */
export interface HazardDef {
  id: string;
  name: string;
  every: number;
  first: number;
  warn: string;
  strike: string;
  effects?: { status: StatusId; turns: number; power?: number }[]; // quem NÃO está defendendo sofre
  gift?: number; // fração da vida máxima curada no favorito da multidão (jogador se favor >= CROWD.ovationAt, senão o inimigo)
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
  hazard: HazardDef;
}

/** Ato da história: arenas em sequência. Vencer a última libera o ato seguinte. */
export interface ActDef {
  id: string;
  name: string;
  arenas: ArenaDef[];
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
