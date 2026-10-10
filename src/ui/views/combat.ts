import { ARENAS, CROWD, SKILLS, STATUS_INFO, WEAK_INFO } from '../../data';
import { actionsFor, canUse, crowdView, fleeChance, hasStatus, hazardView, intentView, playerActsFirst, postureView, type CombatState, type Fighter, type IntentView, type LogEntry } from '../../engine/combat';
import { arenaById, isBossFight, nextArena, stageOf, type GameState } from '../../state';
import { art, assetUrl, attrTag, bar, bossTag, esc, itemChip, statusArt } from '../components';

const GLYPH: Record<IntentView['kind'], string> = { attack: '⚔', magic: '✦', defend: '◈', buff: '▲', prep: '⚠' };

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
    <div class="row between"><b>Multidão</b><span>${v.label} · ${value}</span></div>
    <div class="crowd-track" role="meter" aria-label="Multidão: ${v.label}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <i class="crowd-fill" style="width:${value}%"></i>
      <u class="tick t50" title="Ovação"></u><u class="tick t80" title="A multidão exige mais"></u><u class="tick t100" title="Glória"></u>
      ${d ? `<span class="float crowd-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</span>` : ''}
    </div>
    <div class="crowd-marks" aria-hidden="true"><span class="m50">Ovação</span><span class="m80">Exige mais</span><span class="m100">Glória</span></div>
  </div>`;
}

function postureRow(c: CombatState): string {
  const p = postureView(c);
  if (!p.max) return '';
  const pips = Array.from({ length: p.max }, (_, i) => `<i class="${i < p.value ? 'on' : ''}"></i>`).join('');
  const weak = p.weak.map((t) => (t ? `<span class="chip weak" title="${WEAK_INFO[t].desc}">${WEAK_INFO[t].name}</span>` : '<span class="chip weak unknown" title="Ponto fraco ainda não descoberto">?</span>')).join('');
  return `<div class="posture${p.broken ? ' broken' : ''}">
    <div class="row between"><b>Postura</b>${p.broken ? '<span class="broken-tag">DESEQUILIBRADO</span>' : ''}</div>
    <div class="pips" role="meter" aria-label="Postura ${p.value}/${p.max}" aria-valuenow="${p.value}" aria-valuemin="0" aria-valuemax="${p.max}">${pips}</div>
    ${weak ? `<div class="chips"><span class="dim">Fraco:</span>${weak}</div>` : ''}
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

function fighterCard(f: Fighter, hp: number, animating: boolean, intent = '', crowdChips = '', extra = ''): string {
  const chips = [
    crowdChips,
    animating && f.defending ? `<span class="chip defending">${statusArt('defend')}Defendendo</span>` : '',
    ...f.statuses.map((s) => {
      const info = STATUS_INFO[s.id];
      const detail = s.id === 'stun' ? '' : s.id === 'poison' || s.id === 'burn' ? ` ${s.power}/rod · ${s.turns}` : ` ${s.turns}`;
      return `<span class="chip ${s.id}" title="${info.desc}">${statusArt(s.id)}${info.name}${detail}</span>`;
    }),
  ].join('');
  return `<div class="sketch fighter ${f.side}">
    <div class="info">
      <div class="row between"><span class="name">${esc(f.name)}</span><span class="statline">Vel ${f.stats.speed} · Def ${f.stats.def}</span></div>
      ${bar('hp', hp, f.stats.maxHp, `Vida ${hp}/${f.stats.maxHp}`)}
      ${bar('en', f.energy, f.stats.maxEnergy, `Energia ${f.energy}/${f.stats.maxEnergy}`)}
      <div class="chips">${chips}</div>
      ${extra}
      ${intent}
    </div>
  </div>`;
}

/** Sprite no palco: avança quando ataca, pisca ao sofrer dano, brilha ao curar, cai ao ser derrotado. */
function actor(f: Fighter, hp: number, fresh: LogEntry | null, sprite: string, fb: string, boss = false, enraged = false): string {
  const dizzy = f.statuses.some((x) => x.id === 'stun' || x.id === 'broken');
  const hit = fresh?.target === f.side && fresh.amount ? fresh : null;
  const state = hp <= 0 ? 'down' : hit ? (hit.heal ? 'healed' : 'hurt') : fresh?.kind === f.side && fresh.target && fresh.target !== f.side ? 'lunge' : '';
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

function continueLabel(c: CombatState, isBoss: boolean, nextArena?: string): string {
  if (c.outcome === 'fled' || (c.outcome === 'victory' && !isBoss)) return 'Voltar ao acampamento';
  if (c.outcome === 'victory' && nextArena) return `Campeão! Seguir para ${nextArena}`;
  return 'Ver resumo da campanha';
}

export function combatView(g: GameState, c: CombatState, shown: number | null): string {
  const run = g.run!;
  const arena = arenaById(run.arenaId);
  const isBoss = isBossFight(run);
  const animating = shown !== null;
  const visible = c.log.slice(0, shown ?? c.log.length);
  const last = visible[visible.length - 1];
  const fresh = animating ? last : null;
  const [pHp, eHp] = last.hp;

  let banner: string;
  if (animating) banner = `<div class="sketch turn-banner wait" aria-live="polite">Resolvendo a rodada ${c.round}…</div>`;
  else if (c.outcome === 'victory') banner = `<div class="sketch turn-banner win" aria-live="polite">${c.verdict === 'executed' ? `Você executou ${esc(c.enemy.name)}.` : c.verdict === 'spared' ? `Você poupou ${esc(c.enemy.name)}.` : `Vitória! ${esc(c.enemy.name)} caiu.`}</div>`;
  else if (c.outcome === 'fled') banner = `<div class="sketch turn-banner mine" aria-live="polite">Você escapou da arena!${isBoss ? ' O chefe vai esperar.' : ''}</div>`;
  else if (c.outcome) banner = `<div class="sketch turn-banner lose" aria-live="polite">${c.outcome === 'draw' ? 'Ambos caíram: a arena não aceita empates.' : 'Você foi derrotado.'}</div>`;
  else {
    const stunned = hasStatus(c.player, 'stun') ? ' Você está atordoado: a ação desta rodada será perdida.' : '';
    banner = `<div class="sketch turn-banner mine" aria-live="polite">Rodada ${c.round} · <b>Sua vez</b>: escolha 1 ação.${stunned}</div>`;
  }
  const order = playerActsFirst(c)
    ? `Você age primeiro (Vel ${c.player.stats.speed} × ${c.enemy.stats.speed}).`
    : `${esc(c.enemy.name)} age primeiro (Vel ${c.enemy.stats.speed} × ${c.player.stats.speed}).`;

  const shake = !!fresh && (fresh.crit || (fresh.sfx === 'crowd-roar' && fresh.target === 'enemy'));
  const stageClass = `stage${shake ? ' shake' : ''}${pHp > 0 && pHp <= c.player.stats.maxHp * 0.25 ? ' lowhp' : ''}`;
  const iv = animating || c.outcome ? null : intentView(c);
  const enemyStunned = hasStatus(c.enemy, 'stun');
  const heavy = !!iv && iv.kind !== 'prep' && !!SKILLS[iv.skill].windup && !enemyStunned;

  const cv = crowdView(c);
  const hz = animating ? null : hazardView(c);
  const button = (id: string, i: number) => {
    const s = SKILLS[id];
    const extra = id === 'flee' ? ` · chance ${Math.round(fleeChance(c.player, c.enemy) * 100)}%` : '';
    const statusHazard = !!hz && hz.in <= 1 && !!c.hazard?.effects?.length;
    const suggest = (heavy || statusHazard) && id === 'defend';
    const hintText = heavy && statusHazard ? 'Golpe pesado e perigo da arena' : heavy ? 'Golpe pesado chegando' : 'Perigo da arena: Defender protege';
    const cost = s.glory && c.crowd < 100 ? 'Requer multidão 100' : s.cost ? `${s.cost} energia` : 'sem custo';
    const cls = `action${id === 'flee' ? ' flee' : ''}${suggest ? ' suggest' : ''}${s.glory ? ` glory-btn${cv.gloryReady ? ' ready' : ''}` : ''}`;
    return `<button class="${cls}" data-a="act" data-v="${id}" ${animating || !canUse(c, id) ? 'disabled' : ''}>
      <span>${id === 'flee' ? statusArt('flee') : ''}<b>${s.name}</b> ${attrTag(s.attr)}<kbd>${i + 1}</kbd></span>
      <span class="cost">${cost}${extra}</span>
      <small>${s.desc}</small>${suggest ? `<em class="hint">${hintText}</em>` : ''}</button>`;
  };
  const indexed = actionsFor(c.player, c).map((id, i) => [id, i] as const);
  const verdict = indexed.filter(([id]) => SKILLS[id].type === 'verdict');
  const regular = indexed.filter(([id]) => SKILLS[id].type !== 'verdict');
  const controls = c.outcome && !animating
    ? `<button class="primary wide" data-a="continue">${continueLabel(c, isBoss, nextArena(run)?.name)}</button>`
    : `${verdict.length ? `<div class="sketch verdict"><p class="center"><b>Polegar</b> · A multidão aguarda o seu veredito</p><div class="actions">${verdict.map(([id, i]) => button(id, i)).join('')}</div></div>` : ''}
      <div class="actions">${regular.map(([id, i]) => button(id, i)).join('')}</div>`;

  const items = run.items.length ? run.items.map(itemChip).join('') :'<span class="dim">sem itens</span>';

  return `<section class="stack">
    <div class="row between"><h3 class="flush">Fase ${stageOf(run) + 1}/${ARENAS.length} · ${arena.name} · Luta ${run.encounter + 1}/${run.enemies.length}${isBoss ? ` · ${bossTag()}` : ''}</h3>
    <div class="chips">${items}</div></div>
    ${banner}
    <div class="combat">
      <div class="stack">
        ${crowdMeter(c, last.crowd, fresh)}
        <div class="${stageClass}" style="background-image:url(${assetUrl(`bg-${arena.id}`)})">
          ${actor(c.player, pHp, fresh, run.classId, run.classId)}
          ${actor(c.enemy, eHp, fresh, run.enemies[run.encounter], isBoss ? 'boss' : 'enemy', isBoss, c.phased)}
          ${bubble(c, fresh, animating)}
          ${animating ? '' : hazardBadge(c)}
          ${iv ? intentBadge(iv, enemyStunned) : ''}
        </div>
        <div class="cards">${fighterCard(c.player, pHp, animating, '', `${cv.ovation ? `<span class="chip ovation">Ovação +${Math.round(CROWD.ovationBonus * 100)}% dano</span>` : ''}${cv.lastStandReady ? '<span class="chip exige">A multidão exige mais</span>' : ''}`)}${fighterCard(c.enemy, eHp, animating, iv ? `<p class="inext${iv.lost ? ' lost' : ''}">Próxima ação: ${intentText(iv, enemyStunned)}</p>` : '', '', postureRow(c))}</div>
        <p class="dim center small">${order} Defender só protege na rodada em que é usado e sempre age antes.</p>
        ${controls}
      </div>
      <div class="sketch log" aria-label="Registro de combate"><h3>Registro</h3><ol>
        ${visible.map((l, i) => `<li class="${l.kind}${l.bark ? ' bark' : ''}${animating && i === visible.length - 1 ? ' fresh' : ''}"><span class="rd">R${l.round}</span>${l.bark ? `${esc(c.enemy.name)}: “${esc(l.text)}”` : esc(l.text)}</li>`).join('')}
      </ol></div>
    </div>
  </section>`;
}
