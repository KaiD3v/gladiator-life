// Fluxo da campanha: criar o gladiador, entrar em luta, resolver o resultado, transferir de arena e encerrar.
import { fork, pick } from '../core/rng';
import { goalMet, resolveRound } from '../engine/combat';
import { chooseBag, defaultKeep } from '../engine/items';
import { scenesFor } from '../engine/scenes';
import { ACTS, BET, BETS, CLASSES, CROWD, DEMAND, ENEMIES, GOALS, GOLD_PER_LEVEL, RIVAL, RIVAL_TITLES, START_GOLD, WIN_BONUS_XP } from '../data';
import { actName, actOf, arenaById, enterArena, freeDays, isBossFight, maxHp, nextArena, placeRival, rivalFight, rollShop, stageInAct, startFight } from './run';
import { levelOf, type SaveData, type SavedRival } from './save';
import { scene } from './scenes';
import type { ActionOf, GameState, RunState, Screen, Summary } from './types';

/**
 * Quem derrotou o herói numa luta comum de um ato com Rival passa a ser o Rival daquele ato: nome com alcunha e patente 1; se
 * já era o Rival (ou o mesmo inimigo na mesma arena), sobe de patente. Um Rival por ato.
 */
function markRival(rivals: Record<string, SavedRival>, run: RunState, killer: string): Record<string, SavedRival> {
  const act = ACTS[actOf(run.arenaId)];
  if (!act.features?.rival || isBossFight(run)) return rivals;
  const cur = rivals[act.id];
  const same = !!cur && cur.enemy === killer && cur.arena === run.arenaId;
  const name = same ? cur.name : `${ENEMIES[killer].name} ${pick(fork(run, 0x7a11e5), RIVAL_TITLES)}`;
  return { ...rivals, [act.id]: { arena: run.arenaId, enemy: killer, name, rank: same ? cur.rank + 1 : 1 } };
}

/** Fim da campanha (morte, prazo ou última arena conquistada): grava XP e estatísticas. `killer`: inimigo que derrotou o herói. */
function finish(g: GameState, run: RunState, result: Summary['result'], killer?: string): GameState {
  run.daysSpent += run.day - 1;
  const save: SaveData = {
    ...g.save,
    rivals: killer ? markRival(g.save.rivals, run, killer) : g.save.rivals,
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

/** Abandona a campanha em andamento (conta como derrota: o XP já ganho fica) e volta ao título, onde se escolhe o ato. */
export function abandon(g: GameState): GameState {
  if (!g.run) return g;
  const done = finish(g, structuredClone(g.run), 'defeat');
  return { ...done, screen: { name: 'title' }, notice: undefined };
}

/** Abandona a campanha em andamento (como `abandon`) e recomeça o ato atual do checkpoint. Sem checkpoint, nada muda. */
export function restartAct(g: GameState, a: ActionOf<'restartAct'>): GameState {
  if (!g.run) return g;
  const act = actOf(g.run.arenaId);
  if (!g.save.story[act]) return g;
  return startAct(finish(g, structuredClone(g.run), 'defeat'), { type: 'startAct', act, seed: a.seed });
}

/** Gladiador novo: começa a história do zero (apaga os atos liberados e seus checkpoints). */
export function startRun(g: GameState, a: ActionOf<'startRun'>): GameState {
  const name = a.name.trim().slice(0, 16);
  if (g.screen.name !== 'create' || !name || !CLASSES[a.classId]) return g;
  const arena = ACTS[0].arenas[0]; // todo gladiador novo começa a história do zero
  const cls = CLASSES[a.classId];
  const level = levelOf(g.save.xp);
  const run: RunState = {
    name, classId: a.classId, arenaId: arena.id, titles: [], daysSpent: 0, level, attrs: { ...cls.attrs }, trained: { str: 0, dex: 0, wis: 0 },
    skills: [...cls.skills], items: [], bag: [], gold: START_GOLD + GOLD_PER_LEVEL * (level - 1), day: 1, hp: 0, shop: [],
    encounter: 0, enemies: [], seed: a.seed, xp: 0, goldEarned: 0, kills: [], fled: [], bestiary: {}, seen: [], verdicts: {}, rounds: 0, dealt: 0, taken: 0,
  };
  run.hp = maxHp(run);
  enterArena(run);
  const save: SaveData = { ...g.save, story: [structuredClone(run)], rivals: {} };
  const news = `Bem-vindo ao ludus de ${arena.name}, arena 1 de ${ACTS[0].arenas.length}. ${ENEMIES[arena.boss].name} precisa cair até o dia ${arena.days}.`;
  return { ...g, save, run, screen: scene(scenesFor({ on: 'run-start' }), { name: 'camp', npc: null, line: '', news }) };
}

/**
 * Começa (ou recomeça, depois de cair) um ato já liberado a partir do checkpoint do herói: mesma build e ouro,
 * vida cheia, nível atual do legado e uma temporada nova sorteada pela semente da tentativa. Toca de novo a abertura do
 * ato (Ato I: chegada ao ludus; depois: chegada à primeira arena), que pode ser pulada.
 */
export function startAct(g: GameState, a: ActionOf<'startAct'>): GameState {
  const checkpoint = g.save.story[a.act];
  if ((g.screen.name !== 'title' && g.screen.name !== 'summary') || !checkpoint) return g;
  const run = structuredClone(checkpoint);
  run.seed = a.seed;
  run.level = levelOf(g.save.xp);
  enterArena(run);
  placeRival(run, g.save.rivals);
  run.hp = maxHp(run);
  const arena = arenaById(run.arenaId);
  const news = `${actName(a.act)}: ${ACTS[a.act].name}. De volta a ${arena.name}: ${ENEMIES[arena.boss].name} precisa cair até o dia ${arena.days}.`;
  const camp: Screen = { name: 'camp', npc: null, line: '', news };
  const opening = a.act === 0 ? scenesFor({ on: 'run-start' }) : scenesFor({ on: 'arena-enter', arena: arena.id }, run.seen, run.verdicts);
  return { ...g, run, screen: opening.length ? scene(opening, camp) : camp, notice: undefined };
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
  const intro = isBossFight(run) ? scenesFor({ on: 'boss-intro', boss }, run.seen, run.verdicts) : [];
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
  const isRival = rivalFight(run);
  const foe = c.enemy.name;
  const tier = arenaById(run.arenaId).tier;
  const act = ACTS[actOf(run.arenaId)];
  let save = g.save;
  run.hp = c.player.hp;
  run.bag = bag;
  run.rounds += c.round;
  run.dealt += c.dealt;
  run.taken += c.taken;
  run.bestiary[enemyId] = [...new Set([...(run.bestiary[enemyId] ?? []), ...c.revealed])];
  run.day++;
  if (c.outcome === 'defeat' || c.outcome === 'draw') return finish(g, run, c.outcome, enemyId);
  // Aposta com a Sabina: resolvida em qualquer fim de luta (fugir perde)
  let betNote = '';
  if (run.bet) {
    const bet = BETS.find((b) => b.id === run.bet!.id)!;
    const prize = Math.round(BET.stakes[run.bet.stake].gold * bet.odds);
    if (goalMet(bet.goal, c)) {
      run.gold += prize;
      run.goldEarned += prize;
      betNote = ` Aposta ganha (${GOALS[bet.goal].text}): +${prize} de ouro.`;
    } else betNote = ' Aposta perdida.';
    delete run.bet;
  }
  let news: string;
  if (c.outcome === 'victory') {
    // A torcida paga: ouro × (1 + favor/CROWD.goldDivisor); executar rende mais ouro, poupar rende menos ouro e mais XP.
    const verdictGold = c.verdict === 'executed' ? CROWD.executeGold : c.verdict === 'spared' ? CROWD.spareGold : 1;
    const rivalBonus = isRival ? RIVAL.reward : 1;
    const demandGold = c.demandMet ? DEMAND.gold * tier : 0;
    const gold = Math.round(ENEMIES[enemyId].gold * tier * (1 + c.crowd / CROWD.goldDivisor) * verdictGold * rivalBonus) + demandGold;
    run.kills.push(enemyId);
    run.xp += Math.round(ENEMIES[enemyId].xp * tier * (c.verdict === 'spared' ? CROWD.spareXp : 1) * rivalBonus);
    run.gold += gold;
    run.goldEarned += gold;
    const demandNote = c.demand ? (c.demandMet ? ` Exigência da Plebe cumprida: +${demandGold} de ouro.` : ' A multidão não teve o que exigiu.') : '';
    let rivalNote = '';
    if (isRival) { // vingança: o Rival some do save
      const { [act.id]: _beaten, ...rest } = save.rivals;
      save = { ...save, rivals: rest };
      delete run.rival;
      rivalNote = ` Vingança! ${foe} não volta mais.`;
    }
    if (isBoss) {
      const arena = arenaById(run.arenaId);
      run.titles.push(arena.id);
      run.xp += WIN_BONUS_XP * tier;
      if (ENEMIES[enemyId].trial) run.verdicts[enemyId] = c.verdict ?? 'executed'; // vencer sem veredito também mata
      const next = nextArena(run);
      const actEnds = !next || actOf(next.id) !== actOf(arena.id);
      const after = [...scenesFor({ on: 'boss-defeat', boss: enemyId }, run.seen, run.verdicts),
        ...(actEnds ? scenesFor({ on: 'act-won', act: act.id }, run.seen, run.verdicts) : [])];
      if (!next) {
        const done = finish({ ...g, save }, run, 'victory');
        return { ...done, screen: scene([...after, ...scenesFor({ on: 'campaign-won' }, run.seen, run.verdicts)], done.screen) };
      }
      // Campeão: transferido para a próxima arena com a build intacta, curado, numa temporada nova.
      run.daysSpent += run.day - 1;
      run.arenaId = next.id;
      enterArena(run);
      placeRival(run, save.rivals);
      run.hp = maxHp(run);
      // Novo ato: o herói como entra nele vira o checkpoint (substitui o de uma passagem anterior; os atos seguintes ficam).
      const nextAct = actOf(next.id), story = save.story;
      if (actEnds) save = { ...save, story: [...story.slice(0, nextAct), structuredClone(run), ...story.slice(nextAct + 1)] };
      const at = stageInAct(next.id);
      const news = actEnds
        ? `${actName(at.act)}: ${ACTS[at.act].name}. ${ACTS[at.act].camp.name}, ${next.name}: ${ENEMIES[next.boss].name} precisa cair até o dia ${next.days}.`
        : `Campeão de ${arena.name}! +${gold} de ouro.${betNote} Você foi transferido para ${next.name} (${actName(at.act)}, arena ${at.arena + 1} de ${at.arenas}): ${ENEMIES[next.boss].name} precisa cair até o dia ${next.days}.`;
      const camp: Screen = { name: 'camp', npc: null, line: '', news, loot };
      return { ...g, save, run, screen: scene([...after, ...scenesFor({ on: 'arena-enter', arena: next.id }, run.seen, run.verdicts)], camp) };
    }
    run.encounter++;
    const crowdNote = c.verdict === 'executed' ? ' Você o executou: a multidão vibra e os patronos pagam mais.'
      : c.verdict === 'spared' ? ' Você o poupou: menos ouro, mais experiência.'
      : c.crowd >= 50 ? ' Os patronos jogam moedas na arena.' : '';
    news = `Vitória sobre ${foe}! +${gold} de ouro.${rivalNote}${demandNote}${betNote}${crowdNote}`;
  } else if (isBoss) {
    news = `Você fugiu de ${foe}. O chefe continua esperando.${betNote}`;
  } else {
    run.fled.push(enemyId);
    run.encounter++;
    news = `Você fugiu de ${foe}: sem ouro nem glória desta vez.${betNote}`;
  }
  if (freeDays(run) < 0) return finish({ ...g, save }, run, 'timeout');
  rollShop(run);
  return { ...g, save, run, screen: { name: 'camp', npc: null, line: '', news, loot } };
}
