import { ARENAS, SKILLS, STATUS_INFO } from '../../data';
import { actionsFor, canUse, fleeChance, hasStatus, intentView, playerActsFirst, type CombatState, type Fighter, type IntentView, type LogEntry } from '../../engine/combat';
import { arenaById, isBossFight, nextArena, stageOf, type GameState } from '../../state';
import { art, assetUrl, attrTag, bar, bossTag, esc, itemChip, statusArt } from '../components';

const GLYPH: Record<IntentView['kind'], string> = { attack: '⚔', magic: '✦', defend: '◈', buff: '▲', prep: '⚠' };

/** Resumo em texto da intenção: "Pancada 12–15×2 · Atordoar 40%". */
function intentText(v: IntentView, stunned: boolean): string {
  const dmg = v.dmg ? ` ${v.dmg[0]}–${v.dmg[1]}${v.hits && v.hits > 1 ? `×${v.hits}` : ''}` : '';
  const fx = v.effects.length ? ` · ${v.effects.join(', ')}` : '';
  return `${v.label}${dmg}${fx}${v.kind === 'prep' ? ' (golpe na próxima rodada)' : ''}${stunned ? ' (atordoado: perde a vez)' : ''}`;
}

function intentBadge(v: IntentView, stunned: boolean): string {
  const dmg = v.dmg ? `<b class="idmg">${v.dmg[0]}–${v.dmg[1]}${v.hits && v.hits > 1 ? `×${v.hits}` : ''}</b>` : '';
  const fx = v.effects.map((e) => `<span class="itag">${e}</span>`).join('');
  const note = stunned ? '<small>Atordoado: perde a vez</small>' : v.kind === 'prep' ? `<small>${v.warning ?? ''} Na próxima rodada.</small>` : '';
  return `<div class="intent ${v.kind}${stunned ? ' stunned' : ''}" role="status" aria-label="Próxima ação do inimigo: ${intentText(v, stunned)}">
    <span class="iglyph" aria-hidden="true">${GLYPH[v.kind]}</span><span class="ilabel">${v.label}</span>${dmg}${fx}${note}
  </div>`;
}

function fighterCard(f: Fighter, hp: number, animating: boolean, intent = ''): string {
  const chips = [
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
      ${intent}
    </div>
  </div>`;
}

/** Sprite no palco: avança quando ataca, pisca ao sofrer dano, brilha ao curar, cai ao ser derrotado. */
function actor(f: Fighter, hp: number, fresh: LogEntry | null, sprite: string, fb: string, boss = false): string {
  const hit = fresh?.target === f.side && fresh.amount ? fresh : null;
  const state = hp <= 0 ? 'down' : hit ? (hit.heal ? 'healed' : 'hurt') : fresh?.kind === f.side && fresh.target && fresh.target !== f.side ? 'lunge' : '';
  return `<div class="actor ${f.side} ${state}${boss ? ' boss' : ''}">
    ${hit ? `<span class="float ${hit.heal ? 'heal' : hit.crit ? 'crit' : 'dmg'}">${hit.heal ? '+' : '-'}${hit.amount}</span>` : ''}
    ${art(sprite, 'sprite', f.name, fb)}
  </div>`;
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
  else if (c.outcome === 'victory') banner = `<div class="sketch turn-banner win" aria-live="polite">Vitória! ${esc(c.enemy.name)} caiu.</div>`;
  else if (c.outcome === 'fled') banner = `<div class="sketch turn-banner mine" aria-live="polite">Você escapou da arena!${isBoss ? ' O chefe vai esperar.' : ''}</div>`;
  else if (c.outcome) banner = `<div class="sketch turn-banner lose" aria-live="polite">${c.outcome === 'draw' ? 'Ambos caíram: a arena não aceita empates.' : 'Você foi derrotado.'}</div>`;
  else {
    const stunned = hasStatus(c.player, 'stun') ? ' Você está atordoado: a ação desta rodada será perdida.' : '';
    banner = `<div class="sketch turn-banner mine" aria-live="polite">Rodada ${c.round} · <b>Sua vez</b>: escolha 1 ação.${stunned}</div>`;
  }
  const order = playerActsFirst(c)
    ? `Você age primeiro (Vel ${c.player.stats.speed} × ${c.enemy.stats.speed}).`
    : `${esc(c.enemy.name)} age primeiro (Vel ${c.enemy.stats.speed} × ${c.player.stats.speed}).`;

  const iv = animating || c.outcome ? null : intentView(c);
  const enemyStunned = hasStatus(c.enemy, 'stun');
  const heavy = !!iv && iv.kind !== 'prep' && !!SKILLS[iv.skill].windup && !enemyStunned;

  const controls = c.outcome && !animating
    ? `<button class="primary wide" data-a="continue">${continueLabel(c, isBoss, nextArena(run)?.name)}</button>`
    : `<div class="actions">${actionsFor(c.player).map((id, i) => {
        const s = SKILLS[id];
        const extra = id === 'flee' ? ` · chance ${Math.round(fleeChance(c.player, c.enemy) * 100)}%` : '';
        const suggest = heavy && id === 'defend';
        return `<button class="action${id === 'flee' ? ' flee' : ''}${suggest ? ' suggest' : ''}" data-a="act" data-v="${id}" ${animating || !canUse(c, id) ? 'disabled' : ''}>
          <span>${id === 'flee' ? statusArt('flee') : ''}<b>${s.name}</b> ${attrTag(s.attr)}<kbd>${i + 1}</kbd></span>
          <span class="cost">${s.cost ? `${s.cost} energia` : 'sem custo'}${extra}</span>
          <small>${s.desc}</small>${suggest ? '<em class="hint">Golpe pesado chegando</em>' : ''}</button>`;
      }).join('')}</div>`;

  const items = run.items.length ? run.items.map(itemChip).join('') :'<span class="dim">sem itens</span>';

  return `<section class="stack">
    <div class="row between"><h3 class="flush">Fase ${stageOf(run) + 1}/${ARENAS.length} · ${arena.name} · Luta ${run.encounter + 1}/${run.enemies.length}${isBoss ? ` · ${bossTag()}` : ''}</h3>
    <div class="chips">${items}</div></div>
    ${banner}
    <div class="combat">
      <div class="stack">
        <div class="stage" style="background-image:url(${assetUrl(`bg-${arena.id}`)})">
          ${actor(c.player, pHp, fresh, run.classId, run.classId)}
          ${actor(c.enemy, eHp, fresh, run.enemies[run.encounter], isBoss ? 'boss' : 'enemy', isBoss)}
          ${iv ? intentBadge(iv, enemyStunned) : ''}
        </div>
        <div class="cards">${fighterCard(c.player, pHp, animating)}${fighterCard(c.enemy, eHp, animating, iv ? `<p class="inext">Próxima ação: ${intentText(iv, enemyStunned)}</p>` : '')}</div>
        <p class="dim center small">${order} Defender só protege na rodada em que é usado e sempre age antes.</p>
        ${controls}
      </div>
      <div class="sketch log" aria-label="Registro de combate"><h3>Registro</h3><ol>
        ${visible.map((l, i) => `<li class="${l.kind}${animating && i === visible.length - 1 ? ' fresh' : ''}"><span class="rd">R${l.round}</span>${esc(l.text)}</li>`).join('')}
      </ol></div>
    </div>
  </section>`;
}
