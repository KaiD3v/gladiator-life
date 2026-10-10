// Regras de combate. Funções puras sobre CombatState: nenhuma dependência de DOM.
import {
  ATTR_HEAL_BONUS, ATTR_SKILL_BONUS, CROWD, ITEMS, LOOT, POSTURE, SKILLS, STATUS_INFO, WEAK_INFO, type Attrs, type EnemyDef, type HazardDef, type Perks, type SkillDef, type Stats, type StatusId, type WeakTag,
} from '../data';
import { rand } from '../core/rng';

export type Side = 'player' | 'enemy';
export type Outcome = 'victory' | 'defeat' | 'draw' | 'fled';
export type Sfx = 'hit' | 'crit' | 'magic' | 'block' | 'heal' | 'status' | 'dot' | 'flee' | 'victory' | 'defeat' | 'windup' | 'crowd-roar' | 'crowd-gasp' | 'crowd-boo';

export interface Status { id: StatusId; turns: number; power: number }

export interface Fighter {
  name: string;
  side: Side;
  stats: Stats;
  perks: Perks;
  attrs: Attrs;
  skills: string[];
  bag: string[]; // consumíveis (ids de ITEMS); o que sobrar do inimigo cai para o jogador
  pattern: string[]; // ciclo de ações do inimigo (vazio no jogador)
  glory?: string; // Golpe de Glória do jogador (id de habilidade)
  hp: number;
  energy: number;
  statuses: Status[];
  defending: boolean;
  // Postura (só inimigos; maxPosture 0 = sem postura) e falas/fase de chefe, copiadas da definição
  posture: number;
  maxPosture: number;
  weak: WeakTag[];
  phase2?: EnemyDef['phase2'];
  barks?: EnemyDef['barks'];
}

export interface LogEntry {
  round: number;
  text: string;
  kind: Side | 'status' | 'system';
  target?: Side;
  amount?: number; // dano (ou cura, se heal)
  heal?: boolean;
  crit?: boolean;
  bark?: true; // fala do inimigo (kind 'enemy'): a UI pode mostrar como balão; o texto é só a fala
  sfx?: Sfx; // efeito sonoro do evento (public/audio/sfx/<sfx>.mp3)
  hp: [number, number]; // vida [jogador, inimigo] após o evento, para animar a UI
  crowd: number; // favor da multidão (0..100) após o evento
  crowdDelta?: number; // variação causada por este evento
}

/** Próxima ação do inimigo, anunciada ao jogador. `prep`: nesta rodada ele só prepara `action`, que acerta na seguinte. */
export interface Intent { action: string; prep?: boolean }

export interface IntentView {
  kind: 'attack' | 'magic' | 'defend' | 'buff' | 'prep' | 'item';
  skill: string; // id da habilidade pretendida
  label: string;
  dmg?: [number, number]; // dano esperado POR GOLPE no jogador (sem crítico), já com armadura, enfraquecer e guarda atual; em 'prep', é o golpe da rodada seguinte
  hits?: number;
  effects: string[];
  warning?: string;
  /** Presente quando o inimigo está Desequilibrado e perderá a vez: nada do que `action` descreve vai acontecer (em 'prep', o golpe é cancelado). */
  lost?: string;
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
  revealed: WeakTag[]; // pontos fracos do inimigo já descobertos (inclui os do bestiário da run)
  phased: boolean; // a fase 2 do chefe já aconteceu
  barked: string[]; // falas já ditas nesta luta (start, hurt, low, playerCrit)
  verdict?: 'executed' | 'spared';
  hazard?: HazardDef; // perigo da arena
  hazardIn: number; // rodadas até o perigo agir (1 = no fim desta rodada); 0 sem perigo
}

export const NO_PERKS: Perks = { counter: 0, lifesteal: 0, thorns: 0, poisonOnHit: 0, hpRegen: 0 };

export function makeFighter(
  name: string, side: Side, stats: Stats, perks: Perks, attrs: Attrs, skills: string[], hp = stats.maxHp, pattern: string[] = [],
  extra: Partial<Pick<Fighter, 'maxPosture' | 'weak' | 'phase2' | 'barks' | 'bag'>> = {},
): Fighter {
  const maxPosture = extra.maxPosture ?? 0;
  return {
    name, side, stats, perks, attrs, skills, bag: extra.bag ?? [], pattern, hp: Math.min(hp, stats.maxHp), energy: stats.maxEnergy, statuses: [], defending: false,
    posture: maxPosture, maxPosture, weak: extra.weak ?? [], phase2: extra.phase2, barks: extra.barks,
  };
}

/** `known`: pontos fracos já descobertos em lutas anteriores da run (bestiário). */
export function createCombat(player: Fighter, enemy: Fighter, seed: number, opts: { boss?: boolean; known?: WeakTag[]; hazard?: HazardDef } = {}): CombatState {
  const s: CombatState = {
    round: 1, player, enemy, log: [], outcome: null, seed, dealt: 0, taken: 0, intent: { action: 'attack' }, step: 0,
    boss: !!opts.boss, crowd: CROWD.start, lastAction: null, streak: 0, lastStandUsed: false, lastStandNote: false,
    revealed: enemy.weak.filter((t) => opts.known?.includes(t)), phased: false, barked: [],
    hazard: opts.hazard, hazardIn: opts.hazard?.first ?? 0,
  };
  s.intent = planIntent(s);
  log(s, `${player.name} enfrenta ${enemy.name}!`, 'system');
  bark(s, 'start');
  if (s.hazard && s.hazardIn === 1) log(s, s.hazard.warn, 'system');
  return s;
}

/** Veredito liberado: luta comum, inimigo vivo com até CROWD.verdictHp de vida. */
export const verdictAvailable = (s: CombatState) =>
  !s.outcome && !s.boss && s.enemy.hp > 0 && s.enemy.hp <= s.enemy.stats.maxHp * CROWD.verdictHp;

/**
 * Ordem ESTÁVEL (atalhos de teclado): ataque, habilidades, Golpe de Glória (se a classe tem), defender, fugir, consumíveis
 * da bolsa (um por tipo, na ordem em que entraram) e, com o estado de combate, Executar/Poupar quando o veredito está liberado.
 */
export const actionsFor = (f: Fighter, s?: CombatState): string[] => [
  'attack', ...f.skills, ...(f.glory ? [f.glory] : []), 'defend', 'flee', ...new Set(f.bag), ...(s && verdictAvailable(s) ? ['execute', 'spare'] : []),
];

export const isItem = (id: string) => !!ITEMS[id]?.use;
/** Item de defesa (nenhum efeito no inimigo: cura, guarda, energia...): age primeiro na rodada, como Defender. */
export const isQuickItem = (id: string) => isItem(id) && !ITEMS[id].use!.effects?.some((e) => e.target === 'foe');

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
  if (before < 100 && after >= 100) log(s, 'A multidão ruge: Golpe de Glória liberado!', 'system', { sfx: 'crowd-roar' });
  else if (before < 50 && after >= 50) log(s, 'A multidão está com você!', 'system');
  else if (before >= 50 && after < 50) log(s, 'A multidão esfria.', 'system');
  else if (before >= 25 && after < 25) log(s, 'A multidão vaia!', 'system', { sfx: 'crowd-boo' });
}

/** Veredito: encerra a luta como vitória sem o inimigo agir. */
function judge(state: CombatState, id: string): CombatState {
  const s = structuredClone(state);
  if (id === 'execute') {
    s.enemy.hp = 0;
    s.verdict = 'executed';
    log(s, `${s.player.name} executa ${s.enemy.name} sob o rugido da arena!`, 'player', { target: 'enemy', sfx: 'crowd-roar' });
    gain(s, CROWD.execute);
  } else {
    s.verdict = 'spared';
    log(s, `${s.player.name} poupa ${s.enemy.name}. A multidão aplaude a clemência.`, 'player');
  }
  s.outcome = 'victory';
  log(s, s.verdict === 'executed' ? `${s.enemy.name} foi derrotado!` : `${s.enemy.name} se rende.`, 'system', { sfx: 'victory' });
  dropNote(s);
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
  const idleFoe = s.intent.prep || hasStatus(s.enemy, 'broken') || ['defend', 'self'].includes(SKILLS[s.intent.action].type); // inimigo não vai causar dano

  const prio = (id: string) => (id === 'defend' || id === 'flee' || isQuickItem(id) ? 1 : 0);
  const turns: [Fighter, string][] = [[s.player, playerAction], [s.enemy, s.intent.prep ? 'prep' : s.intent.action]];
  turns.sort(([a, aId], [b, bId]) => prio(bId) - prio(aId) || b.stats.speed - a.stats.speed); // sort estável: jogador vence empates

  for (const [actor, id] of turns) {
    if (s.outcome) break;
    const stun = actor.statuses.find((x) => x.id === 'stun');
    const broken = actor.statuses.find((x) => x.id === 'broken' && !x.power); // power 1 = a vez perdida já foi consumida
    if (stun || broken) {
      if (stun) {
        actor.statuses = actor.statuses.filter((x) => x !== stun);
        addStatus(actor, 'steady', 2, 0); // Firme: sem novo atordoamento até o fim da próxima rodada
        log(s, `${actor.name} está atordoado e perde a vez.`, 'status');
      }
      if (broken) {
        broken.power = 1; // a condição segue (dano extra) até expirar, mas só tira uma vez a ação
        if (!stun) log(s, `${actor.name} está desequilibrado e perde a vez.`, 'status');
      }
      if (actor === s.enemy) {
        lostTurn = true;
        if (s.intent.prep) log(s, `${actor.name} perde a concentração.`, 'enemy');
      }
      continue;
    }
    if (id === 'prep') {
      log(s, `${actor.name} se prepara para ${SKILLS[s.intent.action].name}…`, 'enemy', { sfx: 'windup' });
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
    reactions(s);
    checkEnd(s);
  }
  if (!s.outcome) {
    endOfRound(s);
    if (!s.outcome) advanceIntent(s, lostTurn);
  }
  return s;
}

/**
 * Próxima ação do padrão (cíclico); sem energia, cai para o ataque básico. Golpes pesados começam por uma rodada de preparo.
 * Quando a ação seria o ataque básico ou a defesa, a bolsa pode entrar antes dela (ver `enemyItem`; o passo não é consumido).
 */
function planIntent(s: CombatState): Intent {
  const e = s.enemy;
  const wanted = e.pattern.length ? e.pattern[Math.max(0, s.step) % e.pattern.length] : 'attack';
  const action = SKILLS[wanted].cost <= e.energy ? wanted : 'attack';
  const item = (action === 'attack' || action === 'defend') && enemyItem(e, action, wanted);
  if (item) return { action: item };
  return SKILLS[action].windup ? { action, prep: true } : { action };
}

/**
 * Regra fixa (sem rand) do inimigo para a bolsa, só no lugar de ataque básico/defesa (nunca troca uma habilidade forte).
 * Defesa: com pouca vida, envenenado/queimado ou sem energia para o que queria. Ataque: no lugar do ataque básico.
 */
function enemyItem(e: Fighter, action: string, wanted: string): string | undefined {
  return e.bag.find((id) => {
    const sk = SKILLS[id];
    if (sk.cleanse) return e.statuses.some((x) => x.id === 'poison' || x.id === 'burn' || x.id === 'weaken');
    if (sk.energy) return wanted !== action;
    if (!isQuickItem(id)) return action === 'attack';
    return e.hp <= e.stats.maxHp * LOOT.healAt && !sk.effects?.some((x) => hasStatus(e, x.status)); // não repete guarda/regeneração ativas
  });
}

/** Depois de uma rodada: o preparo cumprido leva ao golpe (mesmo passo); qualquer outro caso avança o padrão. */
function advanceIntent(s: CombatState, lostTurn: boolean) {
  if (s.intent.prep && !lostTurn) {
    const a = s.intent.action;
    s.intent = { action: SKILLS[a].cost <= s.enemy.energy ? a : 'attack' };
    return;
  }
  if (!isItem(s.intent.action) || s.step < 0) s.step++; // após a fase 2, step vale -1 e este incremento cai no passo 0 do padrão novo; item não gasta o passo
  s.intent = planIntent(s);
}

const EFFECT_TAG: Record<string, string> = { stun: 'Atordoar', poison: 'Veneno', burn: 'Queimadura', weaken: 'Enfraquecer', regen: 'Regenera', guard: 'Guarda' };
const CLEANSED: StatusId[] = ['poison', 'burn', 'weaken'];

/** O que o inimigo fará, para a UI. Não sorteia nada; dano é o intervalo (0.9x a 1.1x, sem crítico) contra o jogador agora. */
export function intentView(s: CombatState): IntentView {
  const { action, prep } = s.intent;
  const sk = SKILLS[action];
  const { enemy: e, player: p } = s;
  const effects = (sk.effects ?? [])
    .filter((x) => !(x.status === 'stun' && hasStatus(p, 'steady')))
    .map((x) => EFFECT_TAG[x.status] + (x.power ? ` ${x.power}` : '') + (x.chance !== undefined && x.chance < 1 ? ` ${Math.round(x.chance * 100)}%` : ''));
  if (sk.heal) effects.unshift(`Cura ${sk.heal}`);
  if (sk.energy) effects.unshift(`Energia ${sk.energy}`);
  if (sk.cleanse) effects.unshift('Purifica');
  const view: IntentView = {
    kind: prep ? 'prep' : isItem(action) ? 'item' : sk.type === 'defend' ? 'defend' : sk.type === 'magic' ? 'magic' : sk.type === 'self' ? 'buff' : 'attack',
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
  if (e.statuses.some((x) => x.id === 'broken' && !x.power)) {
    view.lost = 'Desequilibrado: perde a vez';
    if (prep) view.warning = 'Desequilibrado: o golpe pesado será cancelado!';
  }
  return view;
}

function act(s: CombatState, actor: Fighter, foe: Fighter, skill: SkillDef) {
  actor.energy -= skill.cost;
  const bagged = actor.bag.indexOf(skill.id);
  if (bagged >= 0) actor.bag.splice(bagged, 1); // consumível: sai da bolsa ao ser usado
  if (skill.type === 'defend') {
    actor.defending = true;
    actor.energy = Math.min(actor.stats.maxEnergy, actor.energy + 2);
    log(s, `${actor.name} ergue a guarda.`, actor.side, { sfx: 'block' });
  } else if (skill.type === 'flee') {
    return flee(s, actor, foe);
  } else if (skill.type === 'self') {
    log(s, `${actor.name} usa ${skill.name}.`, actor.side, { sfx: 'status' });
    if (skill.heal) heal(s, actor, skill.heal + (skill.attr ? actor.attrs[skill.attr] * ATTR_HEAL_BONUS : 0), skill.name);
    if (skill.energy) {
      const before = actor.energy;
      actor.energy = Math.min(actor.stats.maxEnergy, actor.energy + skill.energy);
      log(s, `${skill.name}: ${actor.name} +${actor.energy - before} de energia`, 'status', { target: actor.side });
    }
    if (skill.cleanse && actor.statuses.some((x) => CLEANSED.includes(x.id))) {
      actor.statuses = actor.statuses.filter((x) => !CLEANSED.includes(x.id));
      log(s, `${actor.name} está purificado.`, 'status', { target: actor.side, sfx: 'heal' });
    }
  } else {
    for (let i = 0; i < (skill.hits ?? 1) && foe.hp > 0 && actor.hp > 0; i++) hit(s, actor, foe, skill);
    if (skill.glory && POSTURE.glory && actor === s.player && foe.hp > 0) strain(s, foe.maxPosture); // Golpe de Glória quebra a postura
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
    if (actor === s.player && target === s.enemy) strain(s, POSTURE.weakHit, e.status);
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
  log(s, `${actor.name} tenta fugir, mas ${foe.name} bloqueia a saída! (${roll})`, actor.side, actor === s.player ? { sfx: 'crowd-boo' } : {});
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
  if (hasStatus(foe, 'broken')) dmg *= 1 + POSTURE.brokenBonus; // Desequilibrado
  if (actor === s.player && s.crowd >= CROWD.ovationAt) dmg *= 1 + CROWD.ovationBonus; // ovação
  const amount = Math.max(1, Math.round(mitigate(foe, dmg)));
  damage(s, foe, amount);
  const verb = verbOverride ?? (skill.id === 'attack' ? ATTACK_VERBS[(s.round + s.log.length) % ATTACK_VERBS.length] : `usa ${skill.name} em`);
  log(s, `${actor.name} ${verb} ${foe.name}: ${amount}${crit ? ' CRÍTICO!' : ''}${foe.defending ? ' (bloqueado)' : ''}`, actor.side, { target: foe.side, amount, crit, sfx: crit ? 'crit' : physical ? 'hit' : 'magic' });
  if (crit) gain(s, actor === s.player ? CROWD.crit : CROWD.critTaken);
  if (actor === s.player && foe.hp > 0) {
    if (physical ? foe.weak.includes('physical') : foe.weak.includes('magic')) strain(s, POSTURE.weakHit, physical ? 'physical' : 'magic');
    if (crit) { strain(s, POSTURE.crit); bark(s, 'playerCrit'); }
  }

  if (actor.perks.lifesteal) heal(s, actor, Math.round(amount * actor.perks.lifesteal), 'Roubo de vida');
  if (physical && actor.perks.poisonOnHit && foe.hp > 0) {
    addStatus(foe, 'poison', 3, actor.perks.poisonOnHit);
    if (actor === s.player) strain(s, POSTURE.weakHit, 'poison');
  }
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

/** Reduz a postura do inimigo (o jogador causou um golpe/efeito no ponto fraco, crítico...). `tag`: revela o ponto fraco. Em 0, quebra. */
function strain(s: CombatState, n: number, id?: WeakTag | StatusId) {
  const e = s.enemy;
  if (!e.maxPosture || e.hp <= 0) return;
  if (id) {
    const tag = id as WeakTag; // status sem ponto fraco correspondente (guard, regen...) nunca está em `weak`
    if (!e.weak.includes(tag)) return;
    if (!s.revealed.includes(tag)) {
      s.revealed.push(tag);
      log(s, `Ponto fraco descoberto: ${WEAK_INFO[tag].name}!`, 'system');
    }
  }
  if (hasStatus(e, 'broken')) return; // já desequilibrado: nada a abalar
  e.posture = Math.max(0, e.posture - n);
  if (e.posture > 0) return;
  addStatus(e, 'broken', POSTURE.brokenTurns, 0);
  log(s, `${e.name} perde o equilíbrio!`, 'status', { target: 'enemy', sfx: 'crowd-roar' });
  gain(s, CROWD.broken);
}

/** Postura do inimigo para a UI. `weak`: um item por ponto fraco, `null` enquanto não descoberto. */
export function postureView(s: CombatState) {
  const e = s.enemy;
  return {
    value: e.posture, max: e.maxPosture, broken: hasStatus(e, 'broken'),
    weak: e.weak.map((t): WeakTag | null => (s.revealed.includes(t) ? t : null)),
  };
}

/** Fala do inimigo (no máximo uma vez por luta por chave). */
function bark(s: CombatState, key: 'start' | 'hurt' | 'low' | 'playerCrit') {
  const text = s.enemy.barks?.[key];
  if (!text || s.barked.includes(key) || s.enemy.hp <= 0) return;
  s.barked.push(key);
  log(s, text, 'enemy', { bark: true });
}

/** Depois de cada ação: fase 2 do chefe (uma vez) e falas por vida. A troca de padrão só vale ao fim da rodada (step -1). */
function reactions(s: CombatState) {
  const e = s.enemy;
  if (s.outcome || e.hp <= 0) return;
  const ph = e.phase2;
  if (ph && !s.phased && e.hp <= ph.at * e.stats.maxHp) {
    s.phased = true;
    log(s, ph.line, 'enemy', { bark: true });
    for (const fx of ph.effects ?? []) {
      addStatus(e, fx.status, fx.turns, fx.power ?? 0);
      log(s, `${e.name}: ${statusName(fx.status)} (${fx.turns} rod.)`, 'status', { target: 'enemy', sfx: 'status' });
    }
    e.pattern = [...ph.pattern];
    s.step = -1; // o golpe pesado já anunciado ainda acontece; o padrão novo começa na rodada seguinte a ele
  }
  const frac = e.hp / e.stats.maxHp;
  if (frac <= 0.2 && e.barks?.low) { s.barked.push('hurt'); bark(s, 'low'); }
  else if (frac <= 0.5 && !ph) bark(s, 'hurt');
}

/** Variação determinística (sem rand) do verbo do ataque básico. */
const ATTACK_VERBS = ['ataca', 'golpeia', 'acerta', 'investe contra'];

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
    const wasBroken = hasStatus(f, 'broken');
    f.statuses = f.statuses.filter((x) => x.id === 'stun' || --x.turns > 0);
    if (wasBroken && !hasStatus(f, 'broken') && f.hp > 0) {
      f.posture = f.maxPosture; // sem encadeamento: a postura volta cheia quando o desequilíbrio acaba
      log(s, `${f.name} recupera o equilíbrio.`, 'status', { target: f.side });
    }
  }
  hazardTick(s);
  reactions(s);
  checkEnd(s);
  if (s.outcome) return;
  for (const f of [s.player, s.enemy]) f.energy = Math.min(f.stats.maxEnergy, f.energy + f.stats.regen);
  s.round++;
}

/**
 * Perigo da arena: no fim da rodada, DEPOIS de veneno/queimadura, curas e expiração de status (efeitos novos duram a duração
 * cheia a partir da rodada seguinte) e ANTES das reações e da regeneração de energia. A rodada anterior ao golpe termina com o aviso.
 */
function hazardTick(s: CombatState) {
  const h = s.hazard;
  if (!h) return;
  if (s.hazardIn > 1) {
    if (--s.hazardIn === 1) log(s, h.warn, 'system');
    return;
  }
  log(s, h.strike, 'system', { sfx: 'status' });
  for (const f of [s.player, s.enemy]) {
    if (f.hp <= 0) continue;
    if (f.defending) { log(s, `${f.name} se protege.`, 'status', { target: f.side, sfx: 'block' }); continue; }
    for (const fx of h.effects ?? []) {
      addStatus(f, fx.status, fx.turns, fx.power ?? 0);
      log(s, `${f.name}: ${statusName(fx.status)} (${fx.turns} rod.)`, 'status', { target: f.side, sfx: 'status' });
    }
  }
  if (h.gift) {
    const fav = s.crowd >= CROWD.ovationAt ? s.player : s.enemy;
    heal(s, fav, Math.round(fav.stats.maxHp * h.gift), h.name);
  }
  s.hazardIn = h.every;
  if (h.every === 1) log(s, h.warn, 'system');
}

/** Perigo da arena para a UI: `in` = rodadas até agir (1 = no fim desta rodada). */
export function hazardView(s: CombatState): { name: string; in: number; warn: string } | null {
  return s.hazard && !s.outcome ? { name: s.hazard.name, in: s.hazardIn, warn: s.hazard.warn } : null;
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
  if (s.outcome === 'victory') dropNote(s);
}

/** Vitória: o registro anuncia o que o inimigo não usou. O que o jogador leva é escolhido depois (state/campaign.ts). */
function dropNote(s: CombatState) {
  if (s.enemy.bag.length) log(s, `${s.enemy.name} deixa cair: ${s.enemy.bag.map((id) => ITEMS[id].name).join(', ')}.`, 'system');
}

const statusName = (id: StatusId) => STATUS_INFO[id].name;

function log(s: CombatState, text: string, kind: LogEntry['kind'], extra: Partial<LogEntry> = {}) {
  s.log.push({ round: s.round, text, kind, ...extra, hp: [s.player.hp, s.enemy.hp], crowd: s.crowd });
  if (s.lastStandNote) {
    s.lastStandNote = false;
    log(s, 'A multidão exige mais! Você se levanta com 1 de vida.', 'system', { sfx: 'crowd-roar' });
    gain(s, -CROWD.lastStandCost);
  }
}
