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
  // Contrabando do Ato II (a Sabina, na Subura, só vende a partir dele)
  praetorianGladius: { id: 'praetorianGladius', name: 'Gládio Pretoriano', price: 110, act: 1, desc: '+6 de ataque.', mods: { atk: 6 } },
  praetorianScutum: { id: 'praetorianScutum', name: 'Escudo Pretoriano', price: 110, act: 1, desc: '+6 de defesa.', mods: { def: 6 } },
  lionMane: { id: 'lionMane', name: 'Juba de Leão', price: 120, act: 1, desc: '+40 de vida máxima (e cura 40).', mods: { maxHp: 40 } },
  augurEye: { id: 'augurEye', name: 'Olho do Áugure', price: 120, act: 1, desc: '+7 de magia e +2 de energia máxima.', mods: { mag: 7, maxEnergy: 2 } },
  laurelCrown: { id: 'laurelCrown', name: 'Coroa de Louros', price: 130, act: 1, desc: '+10% de crítico e crítico 0.5x mais forte.', mods: { crit: 0.1, critMult: 0.5 } },
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
