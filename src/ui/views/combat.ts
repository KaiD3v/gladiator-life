import { ALLY, BAG_SIZE, CROWD, GOALS, ITEMS, SKILLS, STATUS_INFO, WEAK_INFO } from '../../data';
import { defaultKeep } from '../../engine/items';
import { actionsFor, canUse, crowdView, demandView, fleeChance, hasStatus, hazardView, intentView, isItem, isQuickItem, playerActsFirst, postureView, type CombatState, type Fighter, type IntentView, type LogEntry } from '../../engine/combat';
import { arenaById, isBossFight, nextArena, rivalFight, stageOf, type GameState } from '../../state';
import { art, assetUrl, attrTag, bar, bossTag, esc, itemChip, stageLabel, statusArt } from '../components';

const GLYPH: Record<IntentView['kind'], string> = { attack: '⚔', magic: '✦', defend: '◈', buff: '▲', prep: '⚠', item: '⚗' };

/** Resumo em texto da intenção: "Pancada 12–15×2 · Atordoar 40%". */
function intentText(v: IntentView, stunned: boolean): string {
  if (v.lost) return `${v.label} (${v.lost.toLowerCase()})`;
  const dmg = v.dmg ? ` ${v.dmg[0]}–${v.dmg[1]}${v.hits && v.hits > 1 ? `×${v.hits}` : ''}` : '';
  const fx = v.effects.length ? ` · ${v.effects.join(', ')}` : '';
  return `${v.label}${dmg}${fx}${v.kind === 'prep' ? ' (golpe na próxima rodada)' : ''}${stunned ? ' (atordoado: perde a vez)' : ''}`;
}

function intentBadge(v: IntentView, stunned: boolean): string {
  const dmg = v.dmg ? `<b class="idmg">${v.dmg[0]}–${v.dmg[1]}${v.hits && v.hits > 1 ? `×${v.hits}` : ''}</b>` : '';
  const fx = v.effects.map((e) => `<span class="itag">${e}</span>`).join('');
  const note = v.lost ? `<small>${v.lost}</small>` : stunned ? '<small>Atordoado: perde a vez</small>' : v.kind === 'prep' ? `<small>${v.warning ?? ''}</small>` : '';
  return `<div class="intent ${v.kind}${stunned || v.lost ? ' stunned' : ''}" role="status" aria-label="Próxima ação do inimigo: ${intentText(v, stunned)}">
    <span class="iglyph" aria-hidden="true">${GLYPH[v.kind]}</span><span class="ilabel">${v.label}</span>${dmg}${fx}${note}
  </div>`;
}

function crowdMeter(c: CombatState, value: number, fresh: LogEntry | null): string {
  const v = crowdView({ ...c, crowd: value });
  const d = fresh?.crowdDelta;
  return `<div class="crowd${v.gloryReady ? ' glory' : ''}">
    <b class="crowd-label">Multidão</b>
    <div class="crowd-track" role="meter" aria-label="Multidão: ${v.label}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <i class="crowd-fill" style="width:${value}%"></i>
      <u class="tick t50" title="Ovação"></u><u class="tick t80" title="A multidão exige mais"></u><u class="tick t100" title="Glória"></u>
      ${d ? `<span class="float crowd-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</span>` : ''}
    </div>
    <span class="crowd-value">${v.label} · ${value}</span>
  </div>`;
}

function postureRow(c: CombatState): string {
  const p = postureView(c);
  if (!p.max) return '';
  const pips = Array.from({ length: p.max }, (_, i) => `<i class="${i < p.value ? 'on' : ''}"></i>`).join('');
  const weak = p.weak.map((t) => (t ? `<span class="chip weak" title="${WEAK_INFO[t].desc}">${WEAK_INFO[t].name}</span>` : '<span class="chip weak unknown" title="Ponto fraco ainda não descoberto">?</span>')).join('');
  return `<div class="posture${p.broken ? ' broken' : ''}">
    <b>Postura</b>${p.broken ? '<span class="broken-tag">DESEQUILIBRADO</span>' : ''}
    <div class="pips" role="meter" aria-label="Postura ${p.value}/${p.max}" aria-valuenow="${p.value}" aria-valuemin="0" aria-valuemax="${p.max}">${pips}</div>
    ${weak ? `<span class="weaks"><span class="dim">Fraco:</span>${weak}</span>` : ''}
  </div>`;
}

/** Perigo da arena (canto superior esquerdo do palco): contagem regressiva; no turno do golpe vira alerta com a dica. */
function hazardBadge(c: CombatState): string {
  const h = hazardView(c);
  if (!h) return '';
  const now = h.in <= 1;
  const gift = c.hazard?.gift;
  const hint = now ? (gift ? `A plateia vai arremessar ao favorito: ${c.crowd >= CROWD.ovationAt ? 'você' : esc(c.enemy.name)}` : 'No fim desta rodada — Defender protege') : `em ${h.in} rodadas`;
  return `<div class="hazard${now ? ' now' : ''}" role="status" aria-label="Perigo da arena: ${h.name}, ${hint}">
    <span class="hglyph" aria-hidden="true">${now ? '⚠' : '☄'}</span><b>${h.name}</b><small>${hint}</small></div>`;
}

/** HUD compacto do lutador: nome, vida, energia e efeitos numa linha que rola de lado se precisar. */
function fighterHud(f: Fighter, hp: number, en: number, animating: boolean, first: boolean, extraChips = '', extra = ''): string {
  const chips = [
    extraChips,
    animating && f.defending ? `<span class="chip defending">${statusArt('defend')}Defendendo</span>` : '',
    ...f.statuses.map((s) => {
      const info = STATUS_INFO[s.id];
      const detail = s.id === 'stun' ? '' : s.id === 'poison' || s.id === 'burn' ? ` ${s.power}/rod · ${s.turns}` : ` ${s.turns}`;
      return `<span class="chip ${s.id}" title="${info.desc}">${statusArt(s.id)}${info.name}${detail}</span>`;
    }),
  ].join('');
  return `<div class="sketch fighter hud ${f.side}">
    <div class="hud-top"><span class="name">${esc(f.name)}</span>${first ? '<span class="first" title="Age primeiro nesta rodada (maior velocidade)">Age 1º</span>' : ''}<span class="statline">Vel ${f.stats.speed} · Def ${f.stats.def}</span></div>
    ${bar('hp', hp, f.stats.maxHp, `Vida ${hp}/${f.stats.maxHp}`)}
    ${bar('en', en, f.stats.maxEnergy, `Energia ${en}/${f.stats.maxEnergy} · +${f.stats.regen}/rod.`)}
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    ${extra}
  </div>`;
}

/** Sprite no palco: avança quando ataca, pisca ao sofrer dano, brilha ao curar, cai ao ser derrotado. */
function actor(f: Fighter, hp: number, fresh: LogEntry | null, sprite: string, fb: string, boss = false, enraged = false): string {
  const dizzy = f.statuses.some((x) => x.id === 'stun' || x.id === 'broken');
  const hit = fresh?.target === f.side && fresh.amount ? fresh : null;
  const state = hp <= 0 ? 'down' : hit ? (hit.heal ? 'healed' : 'hurt') : fresh?.kind === f.side && fresh.target && fresh.target !== f.side && !fresh.ally ? 'lunge' : '';
  return `<div class="actor ${f.side} ${state}${boss ? ' boss' : ''}${enraged ? ' enraged' : ''}">
    ${hit ? `<span class="float ${hit.heal ? 'heal' : hit.crit ? 'crit' : 'dmg'}">${hit.heal ? '+' : '-'}${hit.amount}</span>` : ''}
    ${dizzy && hp > 0 ? '<span class="dizzy" aria-hidden="true">✦✦</span>' : ''}
    ${art(sprite, 'sprite', f.name, fb)}
  </div>`;
}

/** Balão de fala: a fala nova durante a animação; parado, a última da rodada anterior. */
function bubble(c: CombatState, fresh: LogEntry | null, animating: boolean): string {
  const b = animating ? (fresh?.bark ? fresh : null) : c.log.filter((l) => l.bark && (l.round === c.round - 1 || (c.round === 1 && l.round === 1))).pop();
  return b ? `<div class="say" role="status"><b>${esc(c.enemy.name)}</b>“${esc(b.text)}”</div>` : '';
}

/** Dicas da primeira luta da primeira campanha, uma por rodada: apresentam as camadas do combate na hora em que importam. */
const COACH = [
  'Dica: o quadro no canto direito mostra o próximo golpe do inimigo. Golpe pesado chegando? Defenda.',
  'Dica: jogadas vistosas animam a multidão; repetir a mesma ação a esfria. Com a multidão em 100, a Glória da sua classe libera.',
  'Dica: acertar o ponto fraco abala a postura. Sem postura, o inimigo perde a vez e sofre mais dano.',
  'Dica: a arena também ataca. O aviso no canto esquerdo conta as rodadas, e Defender protege dos efeitos.',
];
function coach(g: GameState, c: CombatState, animating: boolean): string {
  const run = g.run!;
  const tip = COACH[c.round - 1];
  if (!tip || animating || c.outcome || g.save.runs > 0 || stageOf(run) > 0 || run.encounter > 0) return '';
  return `<p class="coach" role="note">${tip}</p>`;
}

function continueLabel(c: CombatState, isBoss: boolean, nextArena?: string): string {
  if (c.outcome === 'fled' || (c.outcome === 'victory' && !isBoss)) return 'Voltar ao acampamento';
  if (c.outcome === 'victory' && nextArena) return `Campeão! Seguir para ${nextArena}`;
  return 'Ver resumo da campanha';
}

/** Páginas da bandeja de ações no celular (no desktop habilidades, básico e itens aparecem juntos e o registro fica ao lado). */
export const TRAY_PAGES = ['skills', 'basic', 'items', 'log'] as const;
export type TrayPage = typeof TRAY_PAGES[number];
const TRAY_LABEL: Record<TrayPage, string> = { skills: 'Habilidades', basic: 'Básico', items: 'Itens', log: 'Registro' };

/**
 * Fim da luta vencida com itens no chão: o jogador escolhe o que leva entre os caídos e a própria bolsa (no máximo BAG_SIZE).
 * Índices em `bolsa + caídos`, os mesmos da ação `continue`.
 */
function lootModal(c: CombatState, keep: number[]): string {
  const pool = [...c.player.bag, ...c.enemy.bag];
  const own = c.player.bag.length;
  const full = keep.length >= BAG_SIZE;
  const card = (i: number) => {
    const it = ITEMS[pool[i]], on = keep.includes(i);
    return `<button class="loot-item${on ? ' on' : ''}" data-a="keep" data-v="${i}" aria-pressed="${on}" ${!on && full ? 'disabled' : ''}>
      <b>${on ? '✓ ' : ''}${it.name}</b><small>${isQuickItem(it.id) ? 'Defesa' : 'Ataque'} · ${it.desc}</small></button>`;
  };
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => card(a + k)).join('');
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="loot-title">
    <div class="sketch modal-box">
      <h2 id="loot-title">Itens caídos</h2>
      <p class="dim loot-intro">${esc(c.enemy.name)} deixou isto na areia. Toque para escolher o que levar.</p>
      <p class="${full ? 'warn' : 'dim'} loot-count">Bolsa ${keep.length}/${BAG_SIZE}${full ? ' · cheia: solte um item para pegar outro' : ''}</p>
      <div class="loot-list scroll">
        <h3>No chão</h3><div class="loot-grid">${range(own, pool.length)}</div>
        ${own ? `<h3>Sua bolsa</h3><div class="loot-grid">${range(0, own)}</div>` : ''}
      </div>
      <div class="modal-actions"><button data-a="leave">Deixar no chão</button><button class="primary" data-a="continue">Levar e seguir</button></div>
    </div>
  </div>`;
}

export function combatView(g: GameState, c: CombatState, shown: number | null, tray: TrayPage = 'skills', keep: number[] | null = null): string {
  const run = g.run!;
  const arena = arenaById(run.arenaId);
  const isBoss = isBossFight(run);
  const animating = shown !== null;
  const visible = c.log.slice(0, shown ?? c.log.length);
  const last = visible[visible.length - 1];
  const fresh = animating ? last : null;
  const [pHp, eHp] = last.hp;
  // Energia: durante a animação, a do evento (o custo cai na hora); parada, a atual (já com a regeneração do fim da rodada).
  const [pEn, eEn] = animating ? last.en : [c.player.energy, c.enemy.energy];

  let banner: string;
  if (animating) banner = `<div class="turn-banner wait" aria-live="polite">Resolvendo a rodada ${c.round}…</div>`;
  else if (c.outcome === 'victory') banner = `<div class="turn-banner win" aria-live="polite">${c.verdict === 'executed' ? `Você executou ${esc(c.enemy.name)}.` : c.verdict === 'spared' ? `Você poupou ${esc(c.enemy.name)}.` : `Vitória! ${esc(c.enemy.name)} caiu.`}</div>`;
  else if (c.outcome === 'fled') banner = `<div class="turn-banner mine" aria-live="polite">Você escapou da arena!${isBoss ? ' O chefe vai esperar.' : ''}</div>`;
  else if (c.outcome) banner = `<div class="turn-banner lose" aria-live="polite">${c.outcome === 'draw' ? 'Ambos caíram: a arena não aceita empates.' : 'Você foi derrotado.'}</div>`;
  else {
    const stunned = hasStatus(c.player, 'stun') ? ' · atordoado: a ação será perdida' : '';
    banner = `<div class="turn-banner mine" aria-live="polite">Rodada ${c.round} · <b>Sua vez</b>${stunned}</div>`;
  }

  const shake = !!fresh && (fresh.crit || (fresh.sfx === 'crowd-roar' && fresh.target === 'enemy'));
  const stageClass = `stage${shake ? ' shake' : ''}${pHp > 0 && pHp <= c.player.stats.maxHp * 0.25 ? ' lowhp' : ''}`;
  const iv = animating || c.outcome ? null : intentView(c);
  const enemyStunned = hasStatus(c.enemy, 'stun');
  const heavy = !!iv && iv.kind !== 'prep' && !!SKILLS[iv.skill].windup && !enemyStunned;
  const cv = crowdView(c);
  const hz = animating ? null : hazardView(c);
  const statusHazard = !!hz && hz.in <= 1 && !!c.hazard?.effects?.length;

  const allyReady = !!c.player.ally && canUse(c, c.player.ally);
  const button = (id: string, i: number) => {
    const s = SKILLS[id];
    const extra = id === 'flee' ? ` · ${Math.round(fleeChance(c.player, c.enemy) * 100)}%` : '';
    const suggest = (heavy || statusHazard) && id === 'defend';
    const hintText = heavy && statusHazard ? 'Golpe pesado e perigo da arena' : heavy ? 'Golpe pesado chegando' : 'Perigo da arena: Defender protege';
    const item = isItem(id);
    const short = s.cost - c.player.energy; // falta de energia: diz quanto falta em vez de só apagar o botão
    const cost = item ? `Item ×${c.player.bag.filter((x) => x === id).length} · ${isQuickItem(id) ? 'age primeiro' : 'segue a velocidade'}`
      : s.glory && c.crowd < 100 ? 'Requer multidão 100'
      : s.ally ? (c.allyUsed ? 'Já veio nesta luta' : c.crowd < ALLY.crowdAt ? `Requer multidão ${ALLY.crowdAt}` : 'sem custo · 1x por luta')
      : short > 0 && !c.outcome ? `${s.cost} energia · faltam ${short}` : s.cost ? `${s.cost} energia` : 'sem custo';
    const cls = `action${id === 'flee' ? ' flee' : ''}${item ? ' item-act' : ''}${suggest ? ' suggest' : ''}${s.glory ? ` glory-btn${cv.gloryReady ? ' ready' : ''}` : ''}${s.ally ? ` glory-btn ally-btn${allyReady ? ' ready' : ''}` : ''}`;
    return `<button class="${cls}" data-a="act" data-v="${id}" title="${s.desc}" ${animating || !canUse(c, id) ? 'disabled' : ''}>
      <span class="a-top">${id === 'flee' ? statusArt('flee') : ''}<b>${s.name}</b> ${attrTag(s.attr)}<kbd>${i + 1}</kbd></span>
      <span class="cost${short > 0 && !item ? ' short' : ''}">${cost}${extra}</span>
      ${suggest ? `<em class="hint">${hintText}</em>` : `<small>${s.desc}</small>`}</button>`;
  };
  const indexed = actionsFor(c.player, c).map((id, i) => [id, i] as const);
  const verdict = indexed.filter(([id]) => SKILLS[id].type === 'verdict');
  const skills = indexed.filter(([id]) => c.player.skills.includes(id));
  const basic = indexed.filter(([id]) => SKILLS[id].type !== 'verdict' && !c.player.skills.includes(id) && !isItem(id));
  const bag = indexed.filter(([id]) => isItem(id));
  const logList = `<ol>${visible.map((l, i) => `<li class="${l.kind}${l.bark ? ' bark' : ''}${animating && i === visible.length - 1 ? ' fresh' : ''}"><span class="rd">R${l.round}</span>${l.bark ? `${esc(c.enemy.name)}: “${esc(l.text)}”` : esc(l.text)}</li>`).join('')}</ol>`;
  // Aba com aviso: Básico quando Defender é sugerido ou a Glória está pronta.
  // Itens: quando a vida está baixa e há cura na bolsa.
  const lowHeal = c.player.hp <= c.player.stats.maxHp * 0.35 && bag.some(([id]) => SKILLS[id].heal);
  const alert: Partial<Record<TrayPage, boolean>> = { basic: (heavy || statusHazard || cv.gloryReady || allyReady) && !animating, items: lowHeal && !animating };
  const tabs = TRAY_PAGES.map((p) => `<button class="tab${p === tray ? ' on' : ''}${alert[p] ? ' alert' : ''}${p === 'items' && !bag.length ? ' empty' : ''}" data-a="tray" data-v="${p}" role="tab" aria-selected="${p === tray}">${TRAY_LABEL[p]}${p === 'items' ? ` ${c.player.bag.length}` : ''}</button>`).join('');
  const controls = c.outcome && !animating
    ? `<div class="tray"><button class="primary wide" data-a="continue">${continueLabel(c, isBoss, nextArena(run)?.name)}</button></div>`
    : `<div class="tray">
        ${verdict.length ? `<div class="verdict"><p><b>Polegar</b> · a multidão aguarda o seu veredito</p><div class="actions">${verdict.map(([id, i]) => button(id, i)).join('')}</div></div>` : ''}
        <nav class="tray-tabs" role="tablist" aria-label="Ações">${tabs}</nav>
        <div class="tray-pages" data-page="${tray}">
          <div class="tpage skills actions" role="tabpanel" aria-label="Habilidades">${skills.map(([id, i]) => button(id, i)).join('')}</div>
          <div class="tpage basic actions" role="tabpanel" aria-label="Básico">${basic.map(([id, i]) => button(id, i)).join('')}</div>
          <div class="tpage items actions${bag.length ? '' : ' empty'}" role="tabpanel" aria-label="Itens">${bag.length ? bag.map(([id, i]) => button(id, i)).join('') : '<p class="dim">Bolsa vazia. Compre no mercador ou vença quem carrega itens.</p>'}</div>
          <div class="tpage log" role="tabpanel" aria-label="Registro de combate">${logList}</div>
        </div>
      </div>`;

  const items = run.items.map(itemChip).join('');
  const dv = demandView(c);
  const demandChip = dv ? `<span class="chip demand ${dv.state}" title="Exigência da Plebe: ${GOALS[dv.goal].text}. Cumprir rende ouro.">${dv.state === 'done' ? '✓' : dv.state === 'failed' ? '✗' : '⚑'} ${GOALS[dv.goal].text}</span>` : '';
  const crowdChips = `${demandChip}${cv.ovation ? `<span class="chip ovation">Ovação +${Math.round(CROWD.ovationBonus * 100)}%</span>` : ''}${cv.lastStandReady ? '<span class="chip exige">Exige mais</span>' : ''}`;
  const pFirst = playerActsFirst(c);
  const carry = c.enemy.bag.map((id) => `<span class="chip carry" title="Na bolsa de ${esc(c.enemy.name)}: ${esc(ITEMS[id].desc)}">⚗ ${ITEMS[id].name}</span>`).join('');

  return `<section class="screen combat-screen">
    <header class="topbar">
      <div class="tb-title"><b>${arena.name}</b> <span class="dim">${stageLabel(run.arenaId)} · Luta ${run.encounter + 1}/${run.enemies.length}</span>${isBoss ? ` ${bossTag()}` : ''}${rivalFight(run) ? ` ${bossTag('RIVAL')}` : ''}${items ? `<span class="chips tb-items">${items}</span>` : ''}</div>
      ${banner}
    </header>
    ${crowdMeter(c, last.crowd, fresh)}
    <div class="${stageClass}" style="background-image:url(${assetUrl(`bg-${arena.id}`)})">
      ${actor(c.player, pHp, fresh, run.classId, run.classId)}
      ${actor(c.enemy, eHp, fresh, run.enemies[run.encounter], isBoss ? 'boss' : 'enemy', isBoss, c.phased)}
      ${fresh?.ally && c.player.ally ? `<div class="ally-charge" aria-hidden="true">${art(SKILLS[c.player.ally].art ?? '', 'sprite')}</div>` : ''}
      ${bubble(c, fresh, animating)}
      ${animating ? '' : hazardBadge(c)}
      ${iv ? intentBadge(iv, enemyStunned) : ''}
      ${coach(g, c, animating)}
    </div>
    <div class="huds">
      ${fighterHud(c.player, pHp, pEn, animating, pFirst && !c.outcome, crowdChips)}
      ${fighterHud(c.enemy, eHp, eEn, animating, !pFirst && !c.outcome, carry, `${postureRow(c)}${iv ? `<p class="inext${iv.lost ? ' lost' : ''}">Próxima: ${intentText(iv, enemyStunned)}</p>` : ''}`)}
    </div>
    ${controls}
    <aside class="sketch log side-log" aria-label="Registro de combate"><h3>Registro</h3>${logList}</aside>
    ${c.outcome === 'victory' && !animating && c.enemy.bag.length ? lootModal(c, keep ?? defaultKeep(c.player.bag.length + c.enemy.bag.length)) : ''}
  </section>`;
}
