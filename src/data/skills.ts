import { ITEMS } from './items';
import type { SkillDef } from './types';

export const SKILLS: Record<string, SkillDef> = {
  attack: { id: 'attack', name: 'Ataque', desc: 'Golpe básico. Sem custo.', cost: 0, type: 'physical', power: 1 },
  defend: { id: 'defend', name: 'Defender', desc: 'Age primeiro, reduz o dano da rodada e recupera +2 de energia. Ideal contra golpes pesados anunciados.', cost: 0, type: 'defend' },
  flee: { id: 'flee', name: 'Fugir', desc: 'Age primeiro. Disputa de Destreza: se falhar, sofre um golpe de oportunidade.', cost: 0, type: 'flee' },
  // Golpes de Glória (um por classe; só com a torcida em 100)
  pitFury: {
    id: 'pitFury', name: 'Fúria do Fosso', desc: 'Golpe de Glória: dano físico 2.6x e atordoa. Exige a torcida em 100.', cost: 0, type: 'physical', power: 2.6, glory: true,
    effects: [{ status: 'stun', target: 'foe', turns: 1 }],
  },
  arenaInferno: {
    id: 'arenaInferno', name: 'Inferno da Arena', desc: 'Golpe de Glória: dano mágico 2.6x e queimadura forte. Exige a torcida em 100.', cost: 0, type: 'magic', power: 2.6, glory: true,
    effects: [{ status: 'burn', target: 'foe', turns: 3, power: 5 }],
  },
  thousandCuts: {
    id: 'thousandCuts', name: 'Mil Cortes', desc: 'Golpe de Glória: 4 golpes de 0.8x com +30% de crítico. Exige a torcida em 100.', cost: 0, type: 'physical', power: 0.8, hits: 4, critBonus: 0.3, glory: true,
  },
  // Veredito (luta comum, inimigo com 15% de vida ou menos)
  execute: { id: 'execute', name: 'Executar', desc: 'Encerra a luta: a multidão vibra e os patronos pagam mais. Não vale contra chefes.', cost: 0, type: 'verdict' },
  spare: { id: 'spare', name: 'Poupar', desc: 'Encerra a luta e deixa o inimigo vivo: menos ouro, mais experiência. Não vale contra chefes.', cost: 0, type: 'verdict' },
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
  maul: { id: 'maul', name: 'Dilacerar', desc: 'Duas mordidas seguidas de dano físico 0.7x.', cost: 4, type: 'physical', power: 0.7, hits: 2 },
  fireBite: {
    id: 'fireBite', name: 'Mordida Ígnea', desc: 'Dano físico 1x e queimadura.', cost: 4, type: 'physical', power: 1,
    effects: [{ status: 'burn', target: 'foe', turns: 2, power: 3 }],
  },
  smash: {
    id: 'smash', name: 'Pancada', desc: 'Golpe pesado: prepara por uma rodada, depois causa dano físico 2.6x com 40% de chance de atordoar.', cost: 5, type: 'physical', power: 2.6, windup: true,
    effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.4 }],
  },
  darkFlame: {
    id: 'darkFlame', name: 'Chama Negra', desc: 'Dano mágico 1.3x e queimadura.', cost: 5, type: 'magic', power: 1.3,
    effects: [{ status: 'burn', target: 'foe', turns: 2, power: 3 }],
  },
  charge: {
    id: 'charge', name: 'Investida', desc: 'Golpe pesado: prepara por uma rodada, depois causa dano físico 3x com 40% de chance de atordoar.', cost: 6, type: 'physical', power: 3, windup: true,
    effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.4 }],
  },
  venomMist: {
    id: 'venomMist', name: 'Névoa Peçonhenta', desc: 'Dano mágico 1x, veneno e enfraquece o alvo.', cost: 5, type: 'magic', power: 1,
    effects: [{ status: 'poison', target: 'foe', turns: 3, power: 2 }, { status: 'weaken', target: 'foe', turns: 2 }],
  },
  brazier: {
    id: 'brazier', name: 'Braseiros', desc: 'Golpe pesado: prepara por uma rodada, depois causa dano mágico 2.8x e queimadura forte.', cost: 8, type: 'magic', power: 2.8, windup: true,
    effects: [{ status: 'burn', target: 'foe', turns: 3, power: 4 }],
  },
  roar: {
    id: 'roar', name: 'Rugido', desc: 'Enfraquece o alvo e regenera vida.', cost: 4, type: 'self',
    effects: [{ status: 'weaken', target: 'foe', turns: 2 }, { status: 'regen', target: 'self', turns: 3, power: 5 }],
  },
  // Consumíveis: a ação de cada item da bolsa (mesmo id, nome e descrição do item em items.ts)
  ...Object.fromEntries(Object.values(ITEMS).filter((it) => it.use).map((it) => [it.id, { id: it.id, name: it.name, desc: it.desc, cost: 0, type: 'self', ...it.use } satisfies SkillDef])),
};
