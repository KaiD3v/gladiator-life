import type { CharacterDef } from './types';

/**
 * Pessoas que aparecem no acampamento (e nas cenas): nome e retrato num lugar só. Um NPC (data/npcs.ts) aponta para uma
 * delas em `who`; uma fala de cena usa a mesma pessoa via SPEAKERS (data/story.ts).
 */
export const CHARACTERS: Record<string, CharacterDef> = {
  cassio: { name: 'Cássio', art: 'npc-merchant' },
  marta: { name: 'Marta', art: 'npc-inn' },
  brutus: { name: 'Brutus', art: 'npc-str' },
  lyra: { name: 'Lyra', art: 'npc-dex' },
  oren: { name: 'Mestre Oren', art: 'npc-wis' },
  tauros: { name: 'Tauros', art: 'npc-tauros' },
  sabina: { name: 'Sabina', art: 'npc-sabina' },
};
