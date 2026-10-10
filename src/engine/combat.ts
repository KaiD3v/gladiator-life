// Regras de combate. Funções puras sobre CombatState: nenhuma dependência de DOM.
import {
  ATTR_HEAL_BONUS, ATTR_SKILL_BONUS, SKILLS, STATUS_INFO, type Attrs, type Perks, type SkillDef, type Stats, type StatusId,
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
}

export const NO_PERKS: Perks = { counter: 0, lifesteal: 0, thorns: 0, poisonOnHit: 0, hpRegen: 0 };

export function makeFighter(name: string, side: Side, stats: Stats, perks: Perks, attrs: Attrs, skills: string[], hp = stats.maxHp): Fighter {
  return { name, side, stats, perks, attrs, skills, hp: Math.min(hp, stats.maxHp), energy: stats.maxEnergy, statuses: [], defending: false };
}

export function createCombat(player: Fighter, enemy: Fighter, seed: number): CombatState {
  const s: CombatState = { round: 1, player, enemy, log: [], outcome: null, seed, dealt: 0, taken: 0 };
  log(s, `${player.name} enfrenta ${enemy.name}!`, 'system');
  return s;
}

export const actionsFor = (f: Fighter): string[] => ['attack', ...f.skills, 'defend', 'flee'];

export function canUse(s: CombatState, id: string): boolean {
  return !s.outcome && actionsFor(s.player).includes(id) && s.player.energy >= SKILLS[id].cost;
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
  const s = structuredClone(state);
  const enemyAction = chooseEnemyAction(s);
  s.player.defending = s.enemy.defending = false;

  const prio = (id: string) => (id === 'defend' || id === 'flee' ? 1 : 0);
  const turns: [Fighter, string][] = [[s.player, playerAction], [s.enemy, enemyAction]];
  turns.sort(([a, aId], [b, bId]) => prio(bId) - prio(aId) || b.stats.speed - a.stats.speed); // sort estável: jogador vence empates

  for (const [actor, id] of turns) {
    if (s.outcome) break;
    const stun = actor.statuses.find((x) => x.id === 'stun');
    if (stun) {
      actor.statuses = actor.statuses.filter((x) => x !== stun);
      log(s, `${actor.name} está atordoado e perde a vez.`, 'status');
      continue;
    }
    act(s, actor, actor === s.player ? s.enemy : s.player, SKILLS[id]);
    checkEnd(s);
  }
  if (!s.outcome) endOfRound(s);
  return s;
}

export function chooseEnemyAction(s: CombatState): string {
  const e = s.enemy;
  if (e.hp < e.stats.maxHp * 0.35 && rand(s) < 0.25) return 'defend';
  const special = e.skills.filter((id) => id !== 'attack' && SKILLS[id].cost <= e.energy);
  if (special.length && rand(s) < 0.6) return special[Math.floor(rand(s) * special.length)];
  return 'attack';
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
    if (e.chance !== undefined && rand(s) >= e.chance) {
      log(s, `${target.name} resiste a ${statusName(e.status)}.`, 'status');
      continue;
    }
    addStatus(target, e.status, e.turns, e.power ?? 0);
    log(s, `${target.name}: ${statusName(e.status)} (${e.turns} rod.)`, 'status', { target: target.side, sfx: 'status' });
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
  const amount = Math.max(1, Math.round(mitigate(foe, dmg)));
  damage(s, foe, amount);
  const verb = verbOverride ?? (skill.id === 'attack' ? 'ataca' : `usa ${skill.name} em`);
  log(s, `${actor.name} ${verb} ${foe.name}: ${amount}${crit ? ' CRÍTICO!' : ''}${foe.defending ? ' (bloqueado)' : ''}`, actor.side, { target: foe.side, amount, crit, sfx: crit ? 'crit' : physical ? 'hit' : 'magic' });

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
  s.log.push({ round: s.round, text, kind, ...extra, hp: [s.player.hp, s.enemy.hp] });
}
