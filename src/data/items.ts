import type { ItemDef } from './types';

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
  // Relíquias do Ato II (contrabando da Sabina, na Subura): efeitos com gatilho, não só números
  retiariusNet: { id: 'retiariusNet', name: 'Rede do Retiário', price: 110, act: 1, relic: true, desc: 'No início de cada luta, 50% de chance de atordoar o adversário.', perks: { openingStun: 0.5 } },
  crocTooth: { id: 'crocTooth', name: 'Dente de Crocodilo', price: 110, act: 1, relic: true, desc: '+30% de dano contra alvo envenenado ou queimado.', perks: { dotHunter: 0.3 } },
  praetorianGladius: { id: 'praetorianGladius', name: 'Gládio Pretoriano', price: 110, act: 1, relic: true, desc: '+3 de ataque e +30% de dano extra contra Desequilibrado.', mods: { atk: 3 }, perks: { brokenHunter: 0.3 } },
  praetorianScutum: { id: 'praetorianScutum', name: 'Escudo Pretoriano', price: 120, act: 1, relic: true, desc: '+3 de defesa. Defender um golpe pesado devolve 50% do golpe a quem atacou.', mods: { def: 3 }, perks: { blockReflect: 0.5 } },
  lionMane: { id: 'lionMane', name: 'Juba de Leão', price: 120, act: 1, relic: true, desc: '+30 de vida máxima. Abaixo de 30% de vida (1x por luta): guarda por 2 rodadas e regeneração.', mods: { maxHp: 30 }, perks: { rally: 1 } },
  augurEye: { id: 'augurEye', name: 'Olho do Áugure', price: 100, act: 1, relic: true, desc: '+6 de magia. Todos os pontos fracos do adversário começam revelados.', mods: { mag: 6 }, perks: { insight: 1 } },
  laurelCrown: { id: 'laurelCrown', name: 'Coroa de Louros', price: 120, act: 1, relic: true, desc: '+5% de crítico. Cada crítico rende +5 de favor da multidão.', mods: { crit: 0.05 }, perks: { critCrowd: 5 } },
  tideAnchor: { id: 'tideAnchor', name: 'Âncora das Marés', price: 100, act: 1, relic: true, desc: '+2 de defesa. Imune aos efeitos dos perigos da arena (onda, jaulas, areia, brasas); flechas ainda acertam.', mods: { def: 2 }, perks: { anchor: 1 } },
  // Consumíveis (bolsa). Defesa: agem primeiro na rodada. Ataque: seguem a velocidade.
  potion: { id: 'potion', name: 'Poção de Vida', price: 20, desc: 'Cura 30 de vida. Age primeiro. Também pode ser bebida no acampamento.', use: { heal: 30 } },
  tonic: { id: 'tonic', name: 'Tônico', price: 15, desc: 'Recupera 6 de energia. Age primeiro.', use: { energy: 6 } },
  antidote: { id: 'antidote', name: 'Antídoto', price: 15, desc: 'Remove veneno, queimadura e enfraquecer. Age primeiro.', use: { cleanse: true } },
  salve: { id: 'salve', name: 'Unguento', price: 20, desc: 'Regenera 6 de vida por rodada durante 3 rodadas. Age primeiro.', use: { effects: [{ status: 'regen', target: 'self', turns: 3, power: 6 }] } },
  guardStone: { id: 'guardStone', name: 'Pedra de Guarda', price: 20, desc: 'Guarda por 2 rodadas: metade do dano. Age primeiro.', use: { effects: [{ status: 'guard', target: 'self', turns: 2 }] } },
  fireBomb: { id: 'fireBomb', name: 'Bomba de Fogo', price: 20, desc: 'Queima o alvo (5 por rodada, 3 rodadas).', use: { effects: [{ status: 'burn', target: 'foe', turns: 3, power: 5 }] } },
  blindPowder: { id: 'blindPowder', name: 'Pó Cegante', price: 20, desc: '70% de chance de atordoar o alvo.', use: { effects: [{ status: 'stun', target: 'foe', turns: 1, chance: 0.7 }] } },
  venomVial: { id: 'venomVial', name: 'Ampola de Veneno', price: 20, desc: 'Envenena o alvo (4 por rodada, acumula, 3 rodadas).', use: { effects: [{ status: 'poison', target: 'foe', turns: 3, power: 4 }] } },
};
