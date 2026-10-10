// Estado do jogo, transições entre telas, run, acampamento e progressão permanente. Sem DOM.
import { createCombat, makeFighter, rand, NO_PERKS, resolveRound, type CombatState } from './combat';
import {
  ARENAS, ATTR_GAIN, CLASSES, ENEMIES, GOLD_PER_LEVEL, HP_PER_LEVEL, ITEMS, MAX_SKILLS, NPCS, REST_FREE, REST_PAID, REST_PRICE,
  SHOP_SIZE, SKILLS, START_GOLD, TRAIN_BASE, TRAIN_STEP, WIN_BONUS_XP, XP_PER_LEVEL,
  type ArenaDef, type Attr, type Attrs, type ClassId, type NpcId, type Perks, type Stats,
} from './data';

// ---------- Save ----------

/** Progressão permanente: só XP (nível) e estatísticas. Arenas não se desbloqueiam: cada personagem recomeça da fase 1. */
export interface SaveData { version: 2; xp: number; runs: number; wins: number; best: number }

export const SAVE_KEY = 'arena-dos-gladiadores:save';
export const defaultSave = (): SaveData => ({ version: 2, xp: 0, runs: 0, wins: 0, best: 0 });

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/** Valida o save bruto do navegador. Qualquer coisa fora do formato volta ao padrão com aviso. */
export function parseSave(raw: string | null): { save: SaveData; error?: string } {
  if (raw === null) return { save: defaultSave() };
  try {
    const d = JSON.parse(raw);
    if (d?.version === 2 && isCount(d.xp) && isCount(d.runs) && isCount(d.wins) && isCount(d.best) && d.best <= ARENAS.length) {
      return { save: { version: 2, xp: d.xp, runs: d.runs, wins: d.wins, best: d.best } };
    }
    // v1 (arenas desbloqueáveis): mantém XP e runs; "vitórias" mudaram de sentido (campanha completa), então zeram.
    if (d?.version === 1 && isCount(d.xp) && isCount(d.runs) && Array.isArray(d.unlocked)) {
      return { save: { version: 2, xp: d.xp, runs: d.runs, wins: 0, best: Math.min(ARENAS.length, Math.max(0, d.unlocked.length - 1)) } };
    }
  } catch { /* cai no padrão abaixo */ }
  return { save: defaultSave(), error: 'O save encontrado estava inválido e foi reiniciado.' };
}

/** XP total para alcançar o nível L (curva crescente: cada nível custa 100 × o nível atual). */
export const xpForLevel = (level: number) => (XP_PER_LEVEL / 2) * level * (level - 1);
export function levelOf(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

// ---------- Run ----------

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
  | { name: 'summary'; summary: Summary };

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
  | { type: 'toTitle' };

export const initialState = (save: SaveData, notice?: string): GameState => ({ screen: { name: 'title' }, save, run: null, notice });

export const arenaById = (id: string): ArenaDef => ARENAS.find((a) => a.id === id)!;
/** Índice da fase atual (0 = primeira arena). */
export const stageOf = (run: Pick<RunState, 'arenaId'>) => ARENAS.findIndex((a) => a.id === run.arenaId);

export function playerBuild(run: Pick<RunState, 'classId' | 'items' | 'level' | 'attrs'>): { stats: Stats; perks: Perks } {
  const cls = CLASSES[run.classId];
  const stats = { ...cls.stats, maxHp: cls.stats.maxHp + HP_PER_LEVEL * (run.level - 1) };
  const perks = { ...NO_PERKS, ...cls.perks };
  const add = (mods: Partial<Stats>, times = 1) => {
    for (const [k, v] of Object.entries(mods)) stats[k as keyof Stats] += v * times;
  };
  for (const a of Object.keys(ATTR_GAIN) as Attr[]) add(ATTR_GAIN[a], run.attrs[a] - cls.attrs[a]);
  for (const item of run.items.map((id) => ITEMS[id])) {
    add(item.mods ?? {});
    for (const [k, v] of Object.entries(item.perks ?? {})) perks[k as keyof Perks] += v;
  }
  return { stats, perks };
}

// ---------- Regras do acampamento (exportadas para a UI mostrar preços e bloqueios) ----------

export const trainPrice = (run: RunState, a: Attr) => TRAIN_BASE + TRAIN_STEP * run.trained[a];
export const restPrice = (run: RunState) => REST_PRICE * arenaById(run.arenaId).tier;
export const maxHp = (run: RunState) => playerBuild(run).stats.maxHp;
/** Dias livres antes do prazo. 0 = hoje só dá para lutar. */
export const freeDays = (run: RunState) => arenaById(run.arenaId).days - run.day;

export type LearnBlock = 'known' | 'slots' | 'req' | 'gold' | 'days' | null;
export function learnBlock(run: RunState, id: string): LearnBlock {
  const sk = SKILLS[id];
  if (run.skills.includes(id)) return 'known';
  if (run.skills.length >= MAX_SKILLS) return 'slots';
  if (run.attrs[sk.attr!] < sk.req!) return 'req';
  if (freeDays(run) <= 0) return 'days';
  if (run.gold < sk.price!) return 'gold';
  return null;
}

const pick = <T>(run: RunState, list: T[]): T => list[Math.floor(rand(run) * list.length)];

function rollShop(run: RunState) {
  const pool = Object.keys(ITEMS).filter((id) => !run.items.includes(id));
  run.shop = [];
  while (run.shop.length < SHOP_SIZE && pool.length) run.shop.push(pool.splice(Math.floor(rand(run) * pool.length), 1)[0]);
}

function startFight(run: RunState): CombatState {
  const { stats, perks } = playerBuild(run);
  const player = makeFighter(run.name, 'player', stats, perks, { ...run.attrs }, [...run.skills], run.hp);
  const def = ENEMIES[run.enemies[run.encounter]];
  const t = arenaById(run.arenaId).tier - 1;
  const scale = (n: number) => Math.round(n * (1 + 0.2 * t));
  const eStats = { ...def.stats, maxHp: scale(def.stats.maxHp), atk: scale(def.stats.atk), mag: scale(def.stats.mag), def: def.stats.def + t };
  const enemy = makeFighter(def.name, 'enemy', eStats, { ...NO_PERKS, ...def.perks }, { ...def.attrs, dex: def.attrs.dex + t }, [...def.skills]);
  return createCombat(player, enemy, Math.floor(rand(run) * 2 ** 32));
}

/** Prepara a temporada da arena atual: adversários sorteados + chefe, dia 1, loja nova. */
function enterArena(run: RunState) {
  const arena = arenaById(run.arenaId);
  run.encounter = 0;
  run.day = 1;
  run.enemies = [];
  for (let i = 0; i < arena.fights; i++) run.enemies.push(arena.pool[Math.floor(rand(run) * arena.pool.length)]);
  run.enemies.push(arena.boss);
  rollShop(run);
}

/** Fim da campanha (morte, prazo ou última arena conquistada): grava só XP e estatísticas. */
function finish(g: GameState, run: RunState, result: Summary['result']): GameState {
  run.daysSpent += run.day - 1;
  const save: SaveData = {
    ...g.save,
    xp: g.save.xp + run.xp,
    runs: g.save.runs + 1,
    wins: g.save.wins + (result === 'victory' ? 1 : 0),
    best: Math.max(g.save.best, run.titles.length),
  };
  const summary: Summary = { result, run, xpGained: run.xp, levelBefore: levelOf(g.save.xp), levelAfter: levelOf(save.xp) };
  return { save, run: null, screen: { name: 'summary', summary } };
}

/** Atividade do acampamento que gasta um dia. Bloqueada no último dia: nele só se luta. */
function spendDay(run: RunState): boolean {
  if (freeDays(run) <= 0) return false;
  run.day++;
  return true;
}

/** Ações do acampamento: valida a tela, clona a run e devolve a fala do NPC (ou o estado intacto se nada mudou). */
function campAction(g: GameState, npc: NpcId, fn: (run: RunState) => keyof Omit<(typeof NPCS)[NpcId], 'id' | 'name' | 'role'> | 'skip'): GameState {
  const scr = g.screen;
  if (scr.name !== 'camp' || !g.run) return g;
  const run = structuredClone(g.run);
  const outcome = fn(run);
  if (outcome === 'skip') return g;
  return { ...g, run, screen: { ...scr, npc, line: pick(run, NPCS[npc][outcome]) } };
}

/** Única porta de entrada para mudar o estado. Ação inválida para a tela atual => estado inalterado. */
export function reduce(g: GameState, a: GameAction): GameState {
  const scr = g.screen;
  switch (a.type) {
    case 'newGame':
      return scr.name === 'title' ? { ...g, screen: { name: 'create' }, notice: undefined } : g;

    case 'toTitle':
      return scr.name === 'summary' || scr.name === 'create' ? { ...g, screen: { name: 'title' }, run: null } : g;

    case 'startRun': {
      const name = a.name.trim().slice(0, 16);
      if (scr.name !== 'create' || !name || !CLASSES[a.classId]) return g;
      const arena = ARENAS[0]; // todo personagem começa do zero, na primeira fase
      const cls = CLASSES[a.classId];
      const level = levelOf(g.save.xp);
      const run: RunState = {
        name, classId: a.classId, arenaId: arena.id, titles: [], daysSpent: 0, level, attrs: { ...cls.attrs }, trained: { str: 0, dex: 0, wis: 0 },
        skills: [...cls.skills], items: [], gold: START_GOLD + GOLD_PER_LEVEL * (level - 1), day: 1, hp: 0, shop: [],
        encounter: 0, enemies: [], seed: a.seed, xp: 0, goldEarned: 0, kills: [], fled: [], rounds: 0, dealt: 0, taken: 0,
      };
      run.hp = maxHp(run);
      enterArena(run);
      const news = `Bem-vindo ao ludus de ${arena.name}, fase 1 de ${ARENAS.length}. ${ENEMIES[arena.boss].name} precisa cair até o dia ${arena.days}.`;
      return { ...g, run, screen: { name: 'camp', npc: null, line: '', news } };
    }

    case 'act': {
      if (scr.name !== 'combat') return g;
      const combat = resolveRound(scr.combat, a.action);
      return combat === scr.combat ? g : { ...g, screen: { name: 'combat', combat } };
    }

    case 'fight': {
      if (scr.name !== 'camp' || !g.run || freeDays(g.run) < 0) return g;
      const run = structuredClone(g.run);
      return { ...g, run, screen: { name: 'combat', combat: startFight(run) } };
    }

    case 'continue': {
      if (scr.name !== 'combat' || !scr.combat.outcome || !g.run) return g;
      const c = scr.combat;
      const run = structuredClone(g.run);
      const enemyId = run.enemies[run.encounter];
      const isBoss = run.encounter === run.enemies.length - 1;
      const tier = arenaById(run.arenaId).tier;
      run.hp = c.player.hp;
      run.rounds += c.round;
      run.dealt += c.dealt;
      run.taken += c.taken;
      run.day++;
      if (c.outcome === 'defeat' || c.outcome === 'draw') return finish(g, run, c.outcome);
      let news: string;
      if (c.outcome === 'victory') {
        const gold = ENEMIES[enemyId].gold * tier;
        run.kills.push(enemyId);
        run.xp += ENEMIES[enemyId].xp * tier;
        run.gold += gold;
        run.goldEarned += gold;
        if (isBoss) {
          const arena = arenaById(run.arenaId);
          run.titles.push(arena.id);
          run.xp += WIN_BONUS_XP * tier;
          const next = ARENAS[stageOf(run) + 1];
          if (!next) return finish(g, run, 'victory');
          // Campeão: transferido para a próxima arena com a build intacta, curado, numa temporada nova.
          run.daysSpent += run.day - 1;
          run.arenaId = next.id;
          enterArena(run);
          run.hp = maxHp(run);
          const news = `Campeão de ${arena.name}! +${gold} de ouro. Você foi transferido para ${next.name} (fase ${stageOf(run) + 1} de ${ARENAS.length}): ${ENEMIES[next.boss].name} precisa cair até o dia ${next.days}.`;
          return { ...g, run, screen: { name: 'camp', npc: null, line: '', news } };
        }
        run.encounter++;
        news = `Vitória sobre ${ENEMIES[enemyId].name}! +${gold} de ouro.`;
      } else if (isBoss) {
        news = `Você fugiu de ${ENEMIES[enemyId].name}. O chefe continua esperando.`;
      } else {
        run.fled.push(enemyId);
        run.encounter++;
        news = `Você fugiu de ${ENEMIES[enemyId].name}: sem ouro nem glória desta vez.`;
      }
      if (freeDays(run) < 0) return finish(g, run, 'timeout');
      rollShop(run);
      return { ...g, run, screen: { name: 'camp', npc: null, line: '', news } };
    }

    case 'talk': {
      if (scr.name !== 'camp' || !g.run) return g;
      if (a.npc === null) return { ...g, screen: { ...scr, npc: null, line: '' } };
      const run = structuredClone(g.run);
      return { ...g, run, screen: { ...scr, npc: a.npc, line: pick(run, NPCS[a.npc].greet) } };
    }

    case 'buy':
      return campAction(g, 'merchant', (run) => {
        if (!run.shop.includes(a.itemId)) return 'skip';
        const item = ITEMS[a.itemId];
        if (run.gold < item.price) return 'poor';
        run.gold -= item.price;
        run.items.push(a.itemId);
        run.hp += item.mods?.maxHp ?? 0;
        run.shop = run.shop.filter((id) => id !== a.itemId);
        return 'deal';
      });

    case 'train':
      return campAction(g, a.attr, (run) => {
        if (!(a.attr in run.attrs) || freeDays(run) <= 0) return 'skip';
        const price = trainPrice(run, a.attr);
        if (run.gold < price) return 'poor';
        const before = maxHp(run);
        run.gold -= price;
        run.attrs[a.attr]++;
        run.trained[a.attr]++;
        run.hp += maxHp(run) - before; // treinar Força também enche a vida nova
        spendDay(run);
        return 'deal';
      });

    case 'learn': {
      const sk = SKILLS[a.skill];
      if (!sk?.attr || !sk.price) return g;
      return campAction(g, sk.attr, (run) => {
        const block = learnBlock(run, a.skill);
        if (block === 'known' || block === 'days') return 'skip';
        if (block === 'req' || block === 'slots') return 'denied';
        if (block === 'gold') return 'poor';
        run.gold -= sk.price!;
        run.skills.push(a.skill);
        spendDay(run);
        return 'deal';
      });
    }

    case 'rest':
      return campAction(g, 'inn', (run) => {
        const max = maxHp(run);
        if (run.hp >= max) return 'denied';
        if (!spendDay(run)) return 'skip';
        const paid = run.gold >= restPrice(run);
        if (paid) run.gold -= restPrice(run);
        run.hp = Math.min(max, run.hp + Math.round(max * (paid ? REST_PAID : REST_FREE)));
        return paid ? 'deal' : 'poor';
      });
  }
}
