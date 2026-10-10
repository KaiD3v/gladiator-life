// Fluxo da campanha: criar o gladiador, entrar em luta, resolver o resultado, transferir de arena e encerrar.
import { resolveRound } from '../engine/combat';
import { chooseBag, defaultKeep } from '../engine/items';
import { scenesFor } from '../engine/scenes';
import { ARENAS, CLASSES, CROWD, ENEMIES, GOLD_PER_LEVEL, START_GOLD, WIN_BONUS_XP } from '../data';
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
  g.screen.name === 'title' ? { ...g, screen: scene(scenesFor({ on: 'campaign-start' }), { name: 'create' }), notice: undefined } : g;

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
    skills: [...cls.skills], items: [], bag: [], gold: START_GOLD + GOLD_PER_LEVEL * (level - 1), day: 1, hp: 0, shop: [],
    encounter: 0, enemies: [], seed: a.seed, xp: 0, goldEarned: 0, kills: [], fled: [], bestiary: {}, seen: [], rounds: 0, dealt: 0, taken: 0,
  };
  run.hp = maxHp(run);
  enterArena(run);
  const news = `Bem-vindo ao ludus de ${arena.name}, fase 1 de ${ARENAS.length}. ${ENEMIES[arena.boss].name} precisa cair até o dia ${arena.days}.`;
  return { ...g, run, screen: scene(scenesFor({ on: 'run-start' }), { name: 'camp', npc: null, line: '', news }) };
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
  const intro = isBossFight(run) ? scenesFor({ on: 'boss-intro', boss }, run.seen) : [];
  if (!intro.length) return { ...g, run, screen: combat };
  run.seen.push(...intro);
  return { ...g, run, screen: scene(intro, combat) };
}

/**
 * Depois do combate: aplica o resultado e decide a próxima tela (acampamento, transferência, resumo).
 * Na vitória, o jogador escolhe (`keep`) o que leva entre a própria bolsa e os itens que o inimigo não usou.
 */
export function afterCombat(g: GameState, a: ActionOf<'continue'>): GameState {
  if (g.screen.name !== 'combat' || !g.screen.combat.outcome || !g.run) return g;
  const c = g.screen.combat;
  const won = c.outcome === 'victory';
  const pool = [...c.player.bag, ...c.enemy.bag]; // o que foi gasto na luta não volta
  const keep = a.keep ?? defaultKeep(pool.length);
  const bag = won ? chooseBag(pool, keep) : [...c.player.bag];
  if (!bag) return g;
  const loot = won ? keep.filter((i) => i >= c.player.bag.length).sort((x, y) => x - y).map((i) => pool[i]) : [];
  const run = structuredClone(g.run);
  const enemyId = run.enemies[run.encounter];
  const isBoss = isBossFight(run);
  const tier = arenaById(run.arenaId).tier;
  run.hp = c.player.hp;
  run.bag = bag;
  run.rounds += c.round;
  run.dealt += c.dealt;
  run.taken += c.taken;
  run.bestiary[enemyId] = [...new Set([...(run.bestiary[enemyId] ?? []), ...c.revealed])];
  run.day++;
  if (c.outcome === 'defeat' || c.outcome === 'draw') return finish(g, run, c.outcome);
  let news: string;
  if (c.outcome === 'victory') {
    // A torcida paga: ouro × (1 + favor/CROWD.goldDivisor); executar rende mais ouro, poupar rende menos ouro e mais XP.
    const verdictGold = c.verdict === 'executed' ? CROWD.executeGold : c.verdict === 'spared' ? CROWD.spareGold : 1;
    const gold = Math.round(ENEMIES[enemyId].gold * tier * (1 + c.crowd / CROWD.goldDivisor) * verdictGold);
    run.kills.push(enemyId);
    run.xp += Math.round(ENEMIES[enemyId].xp * tier * (c.verdict === 'spared' ? CROWD.spareXp : 1));
    run.gold += gold;
    run.goldEarned += gold;
    if (isBoss) {
      const arena = arenaById(run.arenaId);
      run.titles.push(arena.id);
      run.xp += WIN_BONUS_XP * tier;
      const next = nextArena(run);
      if (!next) {
        const done = finish(g, run, 'victory');
        return { ...done, screen: scene([...scenesFor({ on: 'boss-defeat', boss: enemyId }), ...scenesFor({ on: 'campaign-won' })], done.screen) };
      }
      // Campeão: transferido para a próxima arena com a build intacta, curado, numa temporada nova.
      run.daysSpent += run.day - 1;
      run.arenaId = next.id;
      enterArena(run);
      run.hp = maxHp(run);
      const news = `Campeão de ${arena.name}! +${gold} de ouro. Você foi transferido para ${next.name} (fase ${stageOf(run) + 1} de ${ARENAS.length}): ${ENEMIES[next.boss].name} precisa cair até o dia ${next.days}.`;
      const camp: Screen = { name: 'camp', npc: null, line: '', news, loot };
      return { ...g, run, screen: scene([...scenesFor({ on: 'boss-defeat', boss: enemyId }), ...scenesFor({ on: 'arena-enter', arena: next.id })], camp) };
    }
    run.encounter++;
    const crowdNote = c.verdict === 'executed' ? ' Você o executou: a multidão vibra e os patronos pagam mais.'
      : c.verdict === 'spared' ? ' Você o poupou: menos ouro, mais experiência.'
      : c.crowd >= 50 ? ' Os patronos jogam moedas na arena.' : '';
    news = `Vitória sobre ${ENEMIES[enemyId].name}! +${gold} de ouro.${crowdNote}`;
  } else if (isBoss) {
    news = `Você fugiu de ${ENEMIES[enemyId].name}. O chefe continua esperando.`;
  } else {
    run.fled.push(enemyId);
    run.encounter++;
    news = `Você fugiu de ${ENEMIES[enemyId].name}: sem ouro nem glória desta vez.`;
  }
  if (freeDays(run) < 0) return finish(g, run, 'timeout');
  rollShop(run);
  return { ...g, run, screen: { name: 'camp', npc: null, line: '', news, loot } };
}
