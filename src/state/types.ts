// Formas do estado do jogo: run, telas e ações. Sem lógica.
import type { CombatState } from '../engine/combat';
import type { Attr, Attrs, ClassId, NpcId } from '../data';
import type { SaveData } from './save';

export interface RunState {
  name: string;
  classId: ClassId;
  arenaId: string; // fase atual da campanha
  titles: string[]; // arenas das quais já é campeão
  daysSpent: number; // dias gastos nas arenas anteriores
  level: number;
  attrs: Attrs;
  trained: Attrs; // treinos comprados por atributo (define o preço do próximo)
  skills: string[];
  items: string[];
  gold: number;
  day: number;
  hp: number;
  shop: string[]; // estoque atual do mercador
  encounter: number; // índice em enemies
  enemies: string[]; // último é o chefe
  seed: number;
  xp: number;
  goldEarned: number;
  kills: string[];
  fled: string[];
  seen: string[]; // chefes cuja cena de chegada já tocou (fugir e voltar não repete)
  rounds: number;
  dealt: number;
  taken: number;
}

export interface Summary {
  result: 'victory' | 'defeat' | 'draw' | 'timeout';
  run: RunState;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
}

export type Screen =
  | { name: 'title' }
  | { name: 'create' }
  | { name: 'combat'; combat: CombatState }
  | { name: 'camp'; npc: NpcId | null; line: string; news: string }
  | { name: 'summary'; summary: Summary }
  /** Fila de cenas de história; ao terminar (ou pular) segue para `next`. */
  | { name: 'scene'; queue: string[]; beat: number; next: Screen };

export type ScreenOf<N extends Screen['name']> = Extract<Screen, { name: N }>;

export interface GameState { screen: Screen; save: SaveData; run: RunState | null; notice?: string }

export type GameAction =
  | { type: 'newGame' }
  | { type: 'startRun'; name: string; classId: ClassId; seed: number }
  | { type: 'act'; action: string }
  | { type: 'continue' }
  | { type: 'talk'; npc: NpcId | null }
  | { type: 'buy'; itemId: string }
  | { type: 'train'; attr: Attr }
  | { type: 'learn'; skill: string }
  | { type: 'rest' }
  | { type: 'fight' }
  | { type: 'next' } // próxima fala da cena
  | { type: 'skip' } // pula todas as cenas da fila
  | { type: 'toTitle' };

export type ActionOf<T extends GameAction['type']> = Extract<GameAction, { type: T }>;
