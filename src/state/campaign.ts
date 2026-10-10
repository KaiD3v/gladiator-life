// Fluxo da campanha: criar o gladiador, entrar em luta, resolver o resultado, transferir de arena e encerrar.
import { resolveRound } from '../engine/combat';
import { ARENAS, CLASSES, ENEMIES, GOLD_PER_LEVEL, START_GOLD, WIN_BONUS_XP } from '../data';
import { arenaById, enterArena, freeDays, isBossFight, maxHp, nextArena, rollShop, stageOf, startFight } from './run';
import { levelOf, type SaveData } from './save';
import { scene } from './scenes';
import type { ActionOf, GameState, RunState, Screen, Summary } from './types';

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

export const newGame = (g: GameState): GameState =>
  g.screen.name === 'title' ? { ...g, screen: scene(['prologue-village'], { name: 'create' }), notice: undefined } : g;

export const toTitle = (g: GameState): GameState =>
  g.screen.name === 'summary' || g.screen.name === 'create' ? { ...g, screen: { name: 'title' }, run: null } : g;

export function startRun(g: GameState, a: ActionOf<'startRun'>): GameState {
  const name = a.name.trim().slice(0, 16);
  if (g.screen.name !== 'create' || !name || !CLASSES[a.classId]) return g;
  const arena = ARENAS[0]; // todo personagem começa do zero, na primeira fase
  const cls = CLASSES[a.classId];
  const level = levelOf(g.save.xp);
  const run: RunState = {
    name, classId: a.classId, arenaId: arena.id, titles: [], daysSpent: 0, level, attrs: { ...cls.attrs }, trained: { str: 0, dex: 0, wis: 0 },
    skills: [...cls.skills], items: [], gold: START_GOLD + GOLD_PER_LEVEL * (level - 1), day: 1, hp: 0, shop: [],
    encounter: 0, enemies: [], seed: a.seed, xp: 0, goldEarned: 0, kills: [], fled: [], seen: [], rounds: 0, dealt: 0, taken: 0,
  };
  run.hp = maxHp(run);
  enterArena(run);
  const news = `Bem-vindo ao ludus de ${arena.name}, fase 1 de ${ARENAS.length}. ${ENEMIES[arena.boss].name} precisa cair até o dia ${arena.days}.`;
  return { ...g, run, screen: scene(['prologue-ludus'], { name: 'camp', npc: null, line: '', news }) };
}

export function act(g: GameState, a: ActionOf<'act'>): GameState {
  if (g.screen.name !== 'combat') return g;
  const combat = resolveRound(g.screen.combat, a.action);
  return combat === g.screen.combat ? g : { ...g, screen: { name: 'combat', combat } };
}

export function fight(g: GameState): GameState {
  if (g.screen.name !== 'camp' || !g.run || freeDays(g.run) < 0) return g;
  const run = structuredClone(g.run);
  const combat: Screen = { name: 'combat', combat: startFight(run) };
  const boss = run.enemies[run.encounter];
  if (!isBossFight(run) || run.seen.includes(boss)) return { ...g, run, screen: combat };
  run.seen.push(boss);
  return { ...g, run, screen: scene([`boss-intro-${boss}`], combat) };
}

/** Depois do combate: aplica o resultado e decide a próxima tela (acampamento, transferência, resumo). */
export function afterCombat(g: GameState): GameState {
  if (g.screen.name !== 'combat' || !g.screen.combat.outcome || !g.run) return g;
  const c = g.screen.combat;
  const run = structuredClone(g.run);
  const enemyId = run.enemies[run.encounter];
  const isBoss = isBossFight(run);
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
      const next = nextArena(run);
      if (!next) {
        const done = finish(g, run, 'victory');
        return { ...done, screen: scene([`boss-defeat-${enemyId}`, 'epilogue'], done.screen) };
      }
      // Campeão: transferido para a próxima arena com a build intacta, curado, numa temporada nova.
      run.daysSpent += run.day - 1;
      run.arenaId = next.id;
      enterArena(run);
      run.hp = maxHp(run);
      const news = `Campeão de ${arena.name}! +${gold} de ouro. Você foi transferido para ${next.name} (fase ${stageOf(run) + 1} de ${ARENAS.length}): ${ENEMIES[next.boss].name} precisa cair até o dia ${next.days}.`;
      const camp: Screen = { name: 'camp', npc: null, line: '', news };
      return { ...g, run, screen: scene([`boss-defeat-${enemyId}`, `transfer-${next.id}`], camp) };
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
