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
};
