// Regras de combate. Funções puras sobre CombatState: nenhuma dependência de DOM.
import {
  ATTR_HEAL_BONUS, ATTR_SKILL_BONUS, CROWD, SKILLS, STATUS_INFO, type Attrs, type Perks, type SkillDef, type Stats, type StatusId,
} from '../data';
import { rand } from '../core/rng';

export type Side = 'player' | 'enemy';
export type Outcome = 'victory' | 'defeat' | 'draw' | 'fled';
export type Sfx = 'hit' | 'crit' | 'magic' | 'block' | 'heal' | 'status' | 'dot' | 'flee' | 'victory' | 'defeat';

export interface Status { id: StatusId; turns: number; power: number }

export interface Fighter {
  name: string;
  side: Side;
  stats: Stats;
  perks: Perks;
  attrs: Attrs;
  skills: string[];
  pattern: string[]; // ciclo de ações do inimigo (vazio no jogador)
  glory?: string; // Golpe de Glória do jogador (id de habilidade)
  hp: number;
  energy: number;
  statuses: Status[];
  defending: boolean;
}

export interface LogEntry {
  round: number;
  text: string;
  kind: Side | 'status' | 'system';
  target?: Side;
  amount?: number; // dano (ou cura, se heal)
  heal?: boolean;
  crit?: boolean;
  sfx?: Sfx; // efeito sonoro do evento (public/audio/sfx/<sfx>.mp3)
  hp: [number, number]; // vida [jogador, inimigo] após o evento, para animar a UI
  crowd: number; // favor da multidão (0..100) após o evento
  crowdDelta?: number; // variação causada por este evento
}

/** Próxima ação do inimigo, anunciada ao jogador. `prep`: nesta rodada ele só prepara `action`, que acerta na seguinte. */
export interface Intent { action: string; prep?: boolean }

export interface IntentView {
  kind: 'attack' | 'magic' | 'defend' | 'buff' | 'prep';
  skill: string; // id da habilidade pretendida
  label: string;
  dmg?: [number, number]; // dano esperado POR GOLPE no jogador (sem crítico), já com armadura, enfraquecer e guarda atual; em 'prep', é o golpe da rodada seguinte
  hits?: number;
  effects: string[];
  warning?: string;
}

export interface CombatState {
  round: number;
  player: Fighter;
  enemy: Fighter;
  log: LogEntry[];
  outcome: Outcome | null;
  seed: number;
  dealt: number;
  taken: number;
  intent: Intent;
  step: number; // posição no padrão do inimigo
  boss: boolean; // luta de chefe: sem veredito (Executar/Poupar)
  crowd: number; // favor da multidão, 0..100
  lastAction: string | null; // última ação do jogador
  streak: number; // quantas rodadas seguidas o jogador repetiu lastAction
  lastStandUsed: boolean; // "A multidão exige mais!" já aconteceu nesta luta
  lastStandNote: boolean; // interno: a mensagem entra logo após o evento que causou a salvação
  verdict?: 'executed' | 'spared';
}

export const NO_PERKS: Perks = { counter: 0, lifesteal: 0, thorns: 0, poisonOnHit: 0, hpRegen: 0 };

export function makeFighter(name: string, side: Side, stats: Stats, perks: Perks, attrs: Attrs, skills: string[], hp = stats.maxHp, pattern: string[] = []): Fighter {
  return { name, side, stats, perks, attrs, skills, pattern, hp: Math.min(hp, stats.maxHp), energy: stats.maxEnergy, statuses: [], defending: false };
}

export function createCombat(player: Fighter, enemy: Fighter, seed: number, opts: { boss?: boolean } = {}): CombatState {
  const s: CombatState = {
    round: 1, player, enemy, log: [], outcome: null, seed, dealt: 0, taken: 0, intent: { action: 'attack' }, step: 0,
    boss: !!opts.boss, crowd: CROWD.start, lastAction: null, streak: 0, lastStandUsed: false, lastStandNote: false,
  };
  s.intent = planIntent(s);
  log(s, `${player.name} enfrenta ${enemy.name}!`, 'system');
  return s;
}

/** Veredito liberado: luta comum, inimigo vivo com até CROWD.verdictHp de vida. */
export const verdictAvailable = (s: CombatState) =>
  !s.outcome && !s.boss && s.enemy.hp > 0 && s.enemy.hp <= s.enemy.stats.maxHp * CROWD.verdictHp;

/**
 * Ordem ESTÁVEL (atalhos de teclado): ataque, habilidades, Golpe de Glória (se a classe tem), defender, fugir
 * e, com o estado de combate, Executar/Poupar quando o veredito está liberado.
 */
export const actionsFor = (f: Fighter, s?: CombatState): string[] => [
  'attack', ...f.skills, ...(f.glory ? [f.glory] : []), 'defend', 'flee', ...(s && verdictAvailable(s) ? ['execute', 'spare'] : []),
];

export function canUse(s: CombatState, id: string): boolean {
  if (s.outcome || !actionsFor(s.player, s).includes(id)) return false;
  const sk = SKILLS[id];
  return s.player.energy >= sk.cost && (!sk.glory || s.crowd >= 100);
}

/** Estado da torcida para a UI. */
export function crowdView(s: CombatState) {
  const v = s.crowd;
  const label = v >= 100 ? 'Em delírio' : v >= 75 ? 'Em êxtase' : v >= 50 ? 'Animada' : v >= 25 ? 'Indiferente' : 'Hostil';
  return {
    value: v, label, ovation: v >= CROWD.ovationAt, gloryReady: !!s.player.glory && v >= 100,
    lastStandReady: v >= CROWD.lastStandAt && !s.lastStandUsed,
  };
}

/** Ajusta o favor (0..100), anota a variação no último evento do log e avisa só ao cruzar marcos. */
function gain(s: CombatState, delta: number) {
  const before = s.crowd;
  s.crowd = Math.max(0, Math.min(100, before + delta));
  const d = s.crowd - before, last = s.log[s.log.length - 1];
  if (d && last) { last.crowd = s.crowd; last.crowdDelta = (last.crowdDelta ?? 0) + d; }
  const after = s.crowd;
  if (before < 100 && after >= 100) log(s, 'A multidão ruge: Golpe de Glória liberado!', 'system');
  else if (before < 50 && after >= 50) log(s, 'A multidão está com você!', 'system');
  else if (before >= 50 && after < 50) log(s, 'A multidão esfria.', 'system');
  else if (before >= 25 && after < 25) log(s, 'A multidão vaia!', 'system');
}

/** Veredito: encerra a luta como vitória sem o inimigo agir. */
function judge(state: CombatState, id: string): CombatState {
  const s = structuredClone(state);
  if (id === 'execute') {
    s.enemy.hp = 0;
    s.verdict = 'executed';
    log(s, `${s.player.name} executa ${s.enemy.name} sob o rugido da arena!`, 'player', { target: 'enemy', sfx: 'crit' });
    gain(s, CROWD.execute);
  } else {
    s.verdict = 'spared';
    log(s, `${s.player.name} poupa ${s.enemy.name}. A multidão aplaude a clemência.`, 'player');
  }
  s.outcome = 'victory';
  log(s, s.verdict === 'executed' ? `${s.enemy.name} foi derrotado!` : `${s.enemy.name} se rende.`, 'system', { sfx: 'victory' });
  return s;
}

export const hasStatus = (f: Fighter, id: StatusId) => f.statuses.some((x) => x.id === id);

/** Quem age primeiro numa rodada sem "Defender" (empate favorece o jogador). */
export const playerActsFirst = (s: CombatState) => s.player.stats.speed >= s.enemy.stats.speed;

/**
 * Resolve uma rodada inteira a partir da ação do jogador.
 * Retorna o MESMO objeto se a ação for inválida (combate encerrado, sem energia, habilidade alheia),
 * o que impede ações duplicadas: cada chamada válida consome exatamente uma rodada.
 */
export function resolveRound(state: CombatState, playerAction: string): CombatState {
  if (!canUse(state, playerAction)) return state;
  if (SKILLS[playerAction].type === 'verdict') return judge(state, playerAction);
  const s = structuredClone(state);
  let lostTurn = false; // o inimigo perdeu a vez por atordoamento
  s.player.defending = s.enemy.defending = false;
  // Estilo de jogo para a torcida (aplicado depois da ação do jogador, para a variação cair no evento certo)
  const prevAction = s.lastAction;
  s.streak = playerAction === prevAction ? s.streak + 1 : 1;
  s.lastAction = playerAction;
  const idleFoe = s.intent.prep || ['defend', 'self'].includes(SKILLS[s.intent.action].type); // inimigo não vai causar dano

  const prio = (id: string) => (id === 'defend' || id === 'flee' ? 1 : 0);
  const turns: [Fighter, string][] = [[s.player, playerAction], [s.enemy, s.intent.prep ? 'prep' : s.intent.action]];
  turns.sort(([a, aId], [b, bId]) => prio(bId) - prio(aId) || b.stats.speed - a.stats.speed); // sort estável: jogador vence empates

  for (const [actor, id] of turns) {
    if (s.outcome) break;
    const stun = actor.statuses.find((x) => x.id === 'stun');
    if (stun) {
      actor.statuses = actor.statuses.filter((x) => x !== stun);
      addStatus(actor, 'steady', 2, 0); // Firme: sem novo atordoamento até o fim da próxima rodada
      log(s, `${actor.name} está atordoado e perde a vez.`, 'status');
      if (actor === s.enemy) {
        lostTurn = true;
        if (s.intent.prep) log(s, `${actor.name} perde a concentração.`, 'enemy');
      }
      continue;
    }
    if (id === 'prep') {
      log(s, `${actor.name} se prepara para ${SKILLS[s.intent.action].name}…`, 'enemy', { sfx: 'status' });
      continue;
    }
    act(s, actor, actor === s.player ? s.enemy : s.player, SKILLS[id]);
    if (actor === s.player) {
      const sk = SKILLS[id];
      if (sk.glory) gain(s, CROWD.gloryDrop - s.crowd);
      else {
        let d = 0;
        if (s.streak >= CROWD.repeatAfter) d += CROWD.repeat;
        else if (prevAction && prevAction !== id && sk.type !== 'defend' && sk.type !== 'flee') d += CROWD.variety;
        if (id === 'defend' && idleFoe) d += CROWD.coward;
        if (d) gain(s, d);
      }
    } else if (SKILLS[id].windup && s.player.defending && s.player.hp > 0) gain(s, CROWD.perfectBlock);
    checkEnd(s);
  }
  if (!s.outcome) {
    endOfRound(s);
    if (!s.outcome) advanceIntent(s, lostTurn);
  }
  return s;
}

/** Próxima ação do padrão (cíclico); sem energia, cai para o ataque básico. Golpes pesados começam por uma rodada de preparo. */
function planIntent(s: CombatState): Intent {
  const e = s.enemy;
  const wanted = e.pattern.length ? e.pattern[s.step % e.pattern.length] : 'attack';
  const action = SKILLS[wanted].cost <= e.energy ? wanted : 'attack';
  return SKILLS[action].windup ? { action, prep: true } : { action };
}

/** Depois de uma rodada: o preparo cumprido leva ao golpe (mesmo passo); qualquer outro caso avança o padrão. */
function advanceIntent(s: CombatState, lostTurn: boolean) {
  if (s.intent.prep && !lostTurn) {
    const a = s.intent.action;
    s.intent = { action: SKILLS[a].cost <= s.enemy.energy ? a : 'attack' };
    return;
  }
  s.step++;
  s.intent = planIntent(s);
}

const EFFECT_TAG: Record<string, string> = { stun: 'Atordoar', poison: 'Veneno', burn: 'Queimadura', weaken: 'Enfraquecer', regen: 'Regenera', guard: 'Guarda' };

/** O que o inimigo fará, para a UI. Não sorteia nada; dano é o intervalo (0.9x a 1.1x, sem crítico) contra o jogador agora. */
export function intentView(s: CombatState): IntentView {
  const { action, prep } = s.intent;
  const sk = SKILLS[action];
  const { enemy: e, player: p } = s;
  const effects = (sk.effects ?? [])
    .filter((x) => !(x.status === 'stun' && hasStatus(p, 'steady')))
    .map((x) => EFFECT_TAG[x.status] + (x.power ? ` ${x.power}` : '') + (x.chance !== undefined && x.chance < 1 ? ` ${Math.round(x.chance * 100)}%` : ''));
  const view: IntentView = {
    kind: prep ? 'prep' : sk.type === 'defend' ? 'defend' : sk.type === 'magic' ? 'magic' : sk.type === 'self' ? 'buff' : 'attack',
    skill: action,
    label: prep ? `Prepara ${sk.name}` : sk.name,
    effects,
  };
  if (sk.type === 'physical' || sk.type === 'magic') {
    const physical = sk.type === 'physical';
    const weak = hasStatus(e, 'weaken') ? 0.7 : 1;
    const base = ((physical ? e.stats.atk : e.stats.mag) * (sk.power ?? 1) + (sk.attr ? e.attrs[sk.attr] * ATTR_SKILL_BONUS : 0)) * weak
      * armor(physical ? p.stats.def : p.stats.def / 2) * (hasStatus(p, 'guard') ? 0.5 : 1);
    view.dmg = [Math.max(1, Math.round(base * 0.9)), Math.max(1, Math.round(base * 1.1))];
    view.hits = sk.hits ?? 1;
  }
  if (prep) view.warning = 'Golpe pesado na próxima rodada: atordoe agora ou defenda então!';
  return view;
}

function act(s: CombatState, actor: Fighter, foe: Fighter, skill: SkillDef) {
  actor.energy -= skill.cost;
  if (skill.type === 'defend') {
    actor.defending = true;
    actor.energy = Math.min(actor.stats.maxEnergy, actor.energy + 2);
    log(s, `${actor.name} ergue a guarda.`, actor.side, { sfx: 'block' });
  } else if (skill.type === 'flee') {
    return flee(s, actor, foe);
  } else if (skill.type === 'self') {
    log(s, `${actor.name} usa ${skill.name}.`, actor.side, { sfx: 'status' });
    if (skill.heal) heal(s, actor, skill.heal + (skill.attr ? actor.attrs[skill.attr] * ATTR_HEAL_BONUS : 0), skill.name);
  } else {
    for (let i = 0; i < (skill.hits ?? 1) && foe.hp > 0 && actor.hp > 0; i++) hit(s, actor, foe, skill);
  }
  for (const e of skill.effects ?? []) {
    const target = e.target === 'self' ? actor : foe;
    if (target.hp <= 0 || actor.hp <= 0) continue;
    if (e.status === 'stun' && hasStatus(target, 'steady')) {
      log(s, `${target.name} está firme e resiste a ${statusName(e.status)}.`, 'status');
      continue;
    }
    if (e.chance !== undefined && rand(s) >= e.chance) {
      log(s, `${target.name} resiste a ${statusName(e.status)}.`, 'status');
      continue;
    }
    addStatus(target, e.status, e.turns, e.power ?? 0);
    log(s, `${target.name}: ${statusName(e.status)} (${e.turns} rod.)`, 'status', { target: target.side, sfx: 'status' });
    if (e.status === 'stun' && actor === s.player) gain(s, CROWD.stun + (s.intent.prep ? CROWD.interrupt : 0));
  }
}

/** Chance exata de fuga: DES + d10 do fugitivo precisa superar DES + d10 de quem bloqueia. */
export function fleeChance(runner: Fighter, blocker: Fighter): number {
  let wins = 0;
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) if (runner.attrs.dex + a > blocker.attrs.dex + b) wins++;
  return wins / 100;
}

/** Disputa de Destreza (atributo + d10, empate favorece quem bloqueia). Falhou: o inimigo ganha um golpe de oportunidade. */
function flee(s: CombatState, actor: Fighter, foe: Fighter) {
  const d1 = 1 + Math.floor(rand(s) * 10), d2 = 1 + Math.floor(rand(s) * 10);
  const mine = actor.attrs.dex + d1, theirs = foe.attrs.dex + d2;
  const roll = `DES ${actor.attrs.dex}+${d1} × ${foe.attrs.dex}+${d2}`;
  if (mine > theirs) {
    s.outcome = 'fled';
    log(s, `${actor.name} escapa da arena! (${roll})`, 'system', { sfx: 'flee' });
    return;
  }
  log(s, `${actor.name} tenta fugir, mas ${foe.name} bloqueia a saída! (${roll})`, actor.side);
  if (actor === s.player) gain(s, CROWD.failedFlee);
  hit(s, foe, actor, SKILLS.attack, 'aproveita e golpeia');
}

function hit(s: CombatState, actor: Fighter, foe: Fighter, skill: SkillDef, verbOverride?: string) {
  const physical = skill.type === 'physical';
  const weak = hasStatus(actor, 'weaken') ? 0.7 : 1;
  const attrBonus = skill.attr ? actor.attrs[skill.attr] * ATTR_SKILL_BONUS : 0;
  let dmg = ((physical ? actor.stats.atk : actor.stats.mag) * (skill.power ?? 1) + attrBonus) * weak * (0.9 + rand(s) * 0.2);
  dmg *= armor(physical ? foe.stats.def : foe.stats.def / 2);
  const crit = (skill.critIfPoisoned && hasStatus(foe, 'poison')) || rand(s) < actor.stats.crit + (skill.critBonus ?? 0);
  if (crit) dmg *= actor.stats.critMult;
  if (actor === s.player && s.crowd >= CROWD.ovationAt) dmg *= 1 + CROWD.ovationBonus; // ovação
  const amount = Math.max(1, Math.round(mitigate(foe, dmg)));
  damage(s, foe, amount);
  const verb = verbOverride ?? (skill.id === 'attack' ? 'ataca' : `usa ${skill.name} em`);
  log(s, `${actor.name} ${verb} ${foe.name}: ${amount}${crit ? ' CRÍTICO!' : ''}${foe.defending ? ' (bloqueado)' : ''}`, actor.side, { target: foe.side, amount, crit, sfx: crit ? 'crit' : physical ? 'hit' : 'magic' });
  if (crit) gain(s, actor === s.player ? CROWD.crit : CROWD.critTaken);

  if (actor.perks.lifesteal) heal(s, actor, Math.round(amount * actor.perks.lifesteal), 'Roubo de vida');
  if (physical && actor.perks.poisonOnHit && foe.hp > 0) addStatus(foe, 'poison', 3, actor.perks.poisonOnHit);
  if (foe.perks.thorns && actor.hp > 0) {
    const r = Math.max(1, Math.round(amount * foe.perks.thorns));
    damage(s, actor, r);
    log(s, `Espinhos ferem ${actor.name}: ${r}`, 'status', { target: actor.side, amount: r, sfx: 'hit' });
  }
  if (foe.perks.counter && foe.hp > 0 && actor.hp > 0 && (foe.defending || hasStatus(foe, 'guard'))) {
    const c = Math.max(1, Math.round(mitigate(actor, foe.stats.atk * foe.perks.counter * armor(actor.stats.def))));
    damage(s, actor, c);
    log(s, `${foe.name} contra-ataca: ${c}`, foe.side, { target: actor.side, amount: c, sfx: 'hit' });
    if (foe === s.player) gain(s, CROWD.counter);
  }
}

const armor = (def: number) => 20 / (20 + def);

function mitigate(f: Fighter, dmg: number): number {
  if (f.defending) dmg *= 1 - f.stats.block;
  if (hasStatus(f, 'guard')) dmg *= 0.5;
  return dmg;
}

function damage(s: CombatState, target: Fighter, amount: number) {
  target.hp = Math.max(0, target.hp - amount);
  if (target === s.player && target.hp <= 0 && !s.lastStandUsed && s.crowd >= CROWD.lastStandAt) {
    target.hp = 1; // "A multidão exige mais!": a mensagem e o custo entram logo após o evento (ver log)
    s.lastStandUsed = s.lastStandNote = true;
  }
  if (target.side === 'enemy') s.dealt += amount;
  else s.taken += amount;
}

function heal(s: CombatState, f: Fighter, amount: number, source: string) {
  if (f.hp <= 0 || amount <= 0 || f.hp >= f.stats.maxHp) return;
  const before = f.hp;
  f.hp = Math.min(f.stats.maxHp, f.hp + amount);
  log(s, `${source}: ${f.name} +${f.hp - before}`, 'status', { target: f.side, amount: f.hp - before, heal: true, sfx: 'heal' });
}

export function addStatus(f: Fighter, id: StatusId, turns: number, power: number) {
  const cur = f.statuses.find((x) => x.id === id);
  if (!cur) f.statuses.push({ id, turns, power });
  else {
    cur.turns = Math.max(cur.turns, turns);
    cur.power = id === 'poison' ? cur.power + power : Math.max(cur.power, power);
  }
}

/** Fim da rodada: dano/cura por efeitos, duração decrementada, energia regenerada. */
function endOfRound(s: CombatState) {
  for (const f of [s.player, s.enemy]) {
    for (const st of f.statuses) {
      if (st.id === 'poison' || st.id === 'burn') {
        damage(s, f, st.power);
        log(s, `${statusName(st.id)} causa ${st.power} em ${f.name}`, 'status', { target: f.side, amount: st.power, sfx: 'dot' });
      }
    }
  }
  // Curas só depois de todo o dano: quem caiu a 0 não volta.
  for (const f of [s.player, s.enemy]) {
    const regen = f.statuses.find((x) => x.id === 'regen');
    if (regen) heal(s, f, regen.power, 'Regeneração');
    if (f.perks.hpRegen) heal(s, f, f.perks.hpRegen, 'Regeneração');
    // Atordoamento dura até ser consumido; os demais expiram por rodada.
    f.statuses = f.statuses.filter((x) => x.id === 'stun' || --x.turns > 0);
  }
  checkEnd(s);
  if (s.outcome) return;
  for (const f of [s.player, s.enemy]) f.energy = Math.min(f.stats.maxEnergy, f.energy + f.stats.regen);
  s.round++;
}

function checkEnd(s: CombatState) {
  if (s.outcome) return;
  const p = s.player.hp <= 0, e = s.enemy.hp <= 0;
  if (p && e) s.outcome = 'draw';
  else if (e) s.outcome = 'victory';
  else if (p) s.outcome = 'defeat';
  else return;
  const text = { victory: `${s.enemy.name} foi derrotado!`, defeat: `${s.player.name} caiu na arena.`, draw: 'Os dois caem ao mesmo tempo!' }[s.outcome];
  log(s, text, 'system', { sfx: s.outcome === 'victory' ? 'victory' : 'defeat' });
}

const statusName = (id: StatusId) => STATUS_INFO[id].name;

function log(s: CombatState, text: string, kind: LogEntry['kind'], extra: Partial<LogEntry> = {}) {
  s.log.push({ round: s.round, text, kind, ...extra, hp: [s.player.hp, s.enemy.hp], crowd: s.crowd });
  if (s.lastStandNote) {
    s.lastStandNote = false;
    log(s, 'A multidão exige mais! Você se levanta com 1 de vida.', 'system', { sfx: 'status' });
    gain(s, -CROWD.lastStandCost);
  }
}
