// Formas do estado do jogo: run, telas e ações. Sem lógica.
import type { CombatState } from '../engine/combat';
import type { Attrs, ClassId, Verdict, WeakTag } from '../data';
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
  items: string[]; // equipamentos
  bag: string[]; // consumíveis (até BAG_SIZE, repetidos contam separadamente)
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
  bestiary: Record<string, WeakTag[]>; // pontos fracos descobertos por inimigo (só da run: não vai para o save)
  seen: string[]; // cenas `once` já tocadas (ex.: chegada do chefe: fugir e voltar não repete)
  verdicts: Record<string, Verdict>; // destino dos chefes julgáveis (EnemyDef.trial): muda cenas dos atos seguintes
  bet?: RunBet; // aposta feita com a Sabina, resolvida na próxima luta
  rival?: RunRival; // Rival desta arena (SaveData.rivals), no lugar da luta `at`
  rounds: number;
  dealt: number;
  taken: number;
}

/** Aposta da run: objetivo (id em BETS) e valor (índice em BET.stakes, que também fortalece o adversário). */
export interface RunBet { id: string; stake: number }

/** Rival em campo nesta arena: quem já derrotou o herói, com nome e patente. */
export interface RunRival { enemy: string; name: string; rank: number; at: number }

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
  /** `loot`: itens coletados na última luta (a UI marca como novos até a próxima luta). */
  | { name: 'camp'; npc: string | null; line: string; news: string; loot?: string[] } // `npc`: id em NPCS
  | { name: 'summary'; summary: Summary }
  /** Fila de cenas de história; ao terminar (ou pular) segue para `next`. */
  | { name: 'scene'; queue: string[]; beat: number; next: Screen };

export type ScreenOf<N extends Screen['name']> = Extract<Screen, { name: N }>;

export interface GameState { screen: Screen; save: SaveData; run: RunState | null; notice?: string }

export type GameAction =
  | { type: 'newGame' }
  | { type: 'startRun'; name: string; classId: ClassId; seed: number }
  | { type: 'startAct'; act: number; seed: number } // ato liberado, a partir do checkpoint do herói (título ou resumo)
  | { type: 'act'; action: string }
  /** `keep`: índices em `bolsa + itens caídos` que o jogador leva (só na vitória; padrão: a bolsa e o que couber). */
  | { type: 'continue'; keep?: number[] }
  | { type: 'talk'; npc: string | null }
  /** Serviço de um NPC presente: `value` = id do item (loja), 'rest' (estalagem), 'train' ou id da habilidade (treinador). */
  | { type: 'service'; npc: string; value: string }
  | { type: 'use'; itemId: string } // consumível de cura fora da luta (não gasta dia)
  | { type: 'fight' }
  | { type: 'next' } // próxima fala da cena
  | { type: 'skip' } // pula todas as cenas da fila
  | { type: 'toTitle' }
  | { type: 'restartAct'; seed: number } // abandona a campanha em andamento e recomeça o ato atual do checkpoint
  | { type: 'abandon' }; // abandona a campanha em andamento e volta ao título (escolha de ato ou gladiador novo)

export type ActionOf<T extends GameAction['type']> = Extract<GameAction, { type: T }>;
