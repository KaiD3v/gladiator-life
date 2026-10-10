// Camada de interface: renderiza GameState e traduz cliques em GameAction. Nenhuma regra de jogo aqui.
import './style.css';
import { isMuted, playSfx, setTrack, toggleMute, type Track } from './music';
import {
  ARENAS, ATTR_INFO, CLASSES, ENEMIES, HP_PER_LEVEL, ITEMS, MAX_SKILLS, NPCS, REST_FREE, REST_PAID, SKILLS, STATUS_INFO,
  type Attr, type Attrs, type ClassId, type NpcId,
} from './data';
import { actionsFor, canUse, fleeChance, hasStatus, playerActsFirst, type CombatState, type Fighter, type LogEntry } from './combat';
import {
  SAVE_KEY, arenaById, freeDays, stageOf, xpForLevel, initialState, learnBlock, levelOf, maxHp, parseSave, playerBuild, reduce, restPrice, trainPrice,
  type GameAction, type GameState, type RunState, type SaveData, type Summary,
} from './run';
import { SCENES, SPEAKERS } from './story';

const app = document.getElementById('app')!;
const form = { name: '', classId: 'warrior' as ClassId };
const STEP_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 520;

let g: GameState = boot();
/** Quantas entradas do log já foram reveladas na animação da rodada; null = nada animando (entrada liberada). */
let shown: number | null = null;

function boot(): GameState {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { /* armazenamento bloqueado: segue sem save */ }
  const { save, error } = parseSave(raw);
  if (error) persist(save);
  return initialState(save, error);
}

function persist(save: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* sem armazenamento: progresso só nesta sessão */ }
}

function dispatch(a: GameAction) {
  if (shown !== null) return; // uma rodada ainda está sendo mostrada: ignora cliques extras
  const prev = g;
  g = reduce(g, a);
  if (g === prev) return;
  if (g.save !== prev.save) persist(g.save);
  if (g.screen.name !== prev.screen.name) scrollTo(0, 0);
  if (a.type === 'act' && prev.screen.name === 'combat') animateFrom(prev.screen.combat.log.length);
  else render();
}

function animateFrom(start: number) {
  shown = start;
  const step = () => {
    if (g.screen.name !== 'combat' || shown! >= g.screen.combat.log.length) {
      shown = null;
      render();
      return;
    }
    const sfx = g.screen.combat.log[shown!++].sfx;
    if (sfx) playSfx(sfx);
    render();
    setTimeout(step, STEP_MS);
  };
  step();
}

// ---------- helpers de template ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));
const bar = (kind: string, v: number, max: number, label: string) =>
  `<div class="bar ${kind}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}" aria-label="${label}"><i style="width:${pct(v, max)}%"></i><span>${label}</span></div>`;

const ICONS: Record<string, string> = {
  warrior: '<path d="M10 54 L42 16 L50 12 L47 20 L16 58"/><path d="M12 46 l10 10 M8 58 l5-5"/><path d="M44 30c7 0 12 3 12 3c0 10-5 17-12 21c-7-4-12-11-12-21c0 0 5-3 12-3z"/>',
  mage: '<path d="M20 60 L40 22"/><circle cx="44" cy="15" r="7"/><path d="M55 5 l2 4 M60 17 l-4 1 M34 5 l2 3 M44 4 v-1"/><path d="M14 46 q6 2 10-2"/>',
  assassin: '<path d="M10 10 L40 40 M34 46 l12-12 M40 40 l12 12"/><path d="M54 10 L24 40 M30 46 l-12-12 M24 40 l-12 12"/>',
  enemy: '<path d="M14 30c0-14 10-21 18-21s18 7 18 21c0 6-4 9-6 11v8H20v-8c-2-2-6-5-6-11z"/><circle cx="25" cy="30" r="4"/><circle cx="39" cy="30" r="4"/><path d="M27 49v-5 M32 49v-5 M37 49v-5"/>',
  boss: '<path d="M14 32c0-14 10-21 18-21s18 7 18 21c0 6-4 9-6 11v8H20v-8c-2-2-6-5-6-11z"/><path d="M24 30l6 3 M40 30l-6 3"/><path d="M27 51v-5 M32 51v-5 M37 51v-5"/><path d="M18 20C9 18 6 10 8 3c2 7 7 10 12 10 M46 20c9-2 12-10 10-17c-2 7-7 10-12 10"/>',
};
const icon = (k: string, big = false) => `<svg class="icon${big ? ' big' : ''}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[k]}</svg>`;

// Pixel art local em public/assets. Se uma imagem falhar, cai no ícone SVG (data-fb) ou some — o jogo segue funcionando.
const ASSETS = `${import.meta.env.BASE_URL}assets/`;
const assetUrl = (name: string) => `${ASSETS}${name}.webp`;
const art = (name: string, cls: string, alt = '', fb = '') =>
  `<img class="px ${cls}" src="${assetUrl(name)}" alt="${esc(alt)}" draggable="false"${fb ? ` data-fb="${fb}"` : ''}>`;
const statusArt = (id: string) => art(`st-${id}`, 'st');
const ATTRS: Attr[] = ['str', 'dex', 'wis'];
const attrTag = (a?: Attr) => (a ? `<span class="tag ${a}">${ATTR_INFO[a].short}</span>` : '');
const attrLine = (attrs: Attrs) => ATTRS.map((a) => `<span class="attr ${a}">${art(`attr-${a}`, 'ico', '')}${ATTR_INFO[a].short} ${attrs[a]}</span>`).join(' ');
const goldPill = (n: number) => `<span class="pill gold">${art('gold', 'ico', '')}${n} ouro</span>`;

const statLine = (s: { maxHp: number; maxEnergy: number; regen: number; atk: number; mag: number; def: number; speed: number; crit: number }) =>
  `Vida ${s.maxHp} · Energia ${s.maxEnergy} (+${s.regen}) · Atq ${s.atk} · Mag ${s.mag} · Def ${s.def} · Vel ${s.speed} · Crít ${Math.round(s.crit * 100)}%`;

// ---------- telas ----------

function titleView(): string {
  const { save } = g;
  const lvl = levelOf(save.xp);
  const into = save.xp - xpForLevel(lvl);
  const span = xpForLevel(lvl + 1) - xpForLevel(lvl);
  return `<section class="stack center">
    <div class="hero" style="background-image:url(${assetUrl('bg-title')})">
      <h1>Arena dos Gladiadores</h1>
      <div class="cast">${(['warrior', 'mage', 'assassin'] as const).map((id) => art(id, 'cast-sprite', CLASSES[id].name)).join('')}</div>
    </div>
    <p class="dim">Escolha sua classe, monte sua build e sobreviva até o chefe.</p>
    ${g.notice ? `<p class="sketch notice" role="alert">${esc(g.notice)}</p>` : ''}
    <div class="sketch" style="max-width:440px;margin:24px auto;text-align:left">
      <h3>Seu legado</h3>
      <p>Nível <b>${lvl}</b> <span class="dim">(+${HP_PER_LEVEL * (lvl - 1)} de vida inicial)</span></p>
      ${bar('xp', into, span, `${into}/${span} XP até o nível ${lvl + 1}`)}
      <p class="dim" style="margin-top:8px">Campanhas: ${save.runs} · Completas: ${save.wins} · Recorde: ${save.best}/${ARENAS.length} títulos</p>
    </div>
    <button class="primary" data-a="new">Nova campanha</button>
    <div class="sketch" style="max-width:600px;margin:28px auto 0;text-align:left">
      <h3>Como jogar</h3>
      <p>Cada rodada você escolhe <b>uma</b> ação; quem tem mais velocidade age primeiro, mas <b>Defender</b> sempre vem antes.
      Habilidades gastam energia e ficam mais fortes com o atributo ligado a elas (Força, Destreza ou Sabedoria).
      Entre as lutas, no acampamento, gaste ouro com itens, treino e descanso, mas cuidado: o chefe precisa cair antes do fim da temporada.
      Dá para fugir de uma luta numa disputa de Destreza. XP e arenas ficam salvos neste navegador.</p>
    </div>
  </section>`;
}

function createView(): string {
  const classes = (Object.values(CLASSES)).map((c) => {
    const sel = c.id === form.classId;
    return `<button type="button" class="sketch choice${sel ? ' selected' : ''}" data-a="class" data-v="${c.id}" aria-pressed="${sel}">
      <div class="row">${art(c.id, 'portrait', c.name, c.id)}<div><b class="name">${c.name}</b><p class="dim">${c.tagline}</p></div></div>
      <p class="attrs">${attrLine(c.attrs)}</p>
      <p class="statline">${statLine(c.stats)}</p>
      <p>${c.passive}</p>
      <ul class="skill-list">${c.skills.map((id) => `<li>${attrTag(SKILLS[id].attr)} <b>${SKILLS[id].name}</b> (${SKILLS[id].cost} en.): ${SKILLS[id].desc}</li>`).join('')}</ul>
    </button>`;
  }).join('');
  const arenas = ARENAS.map((a, i) => `<div class="sketch arena-card"
      style="background-image:linear-gradient(90deg, rgba(20,18,14,.92) 45%, rgba(20,18,14,.35)), url(${assetUrl(`bg-${a.id}`)})">
      ${art(a.boss, 'arena-boss', ENEMIES[a.boss].name)}
      <span class="stage-no">Fase ${i + 1}</span>
      <b class="name">${a.name}</b>
      <p class="dim">${a.desc}</p>
      <p class="statline">${a.fights} lutas + chefe ${ENEMIES[a.boss].name} · prazo ${a.days} dias</p>
    </div>`).join('<span class="stage-arrow" aria-hidden="true">➜</span>');
  return `<form id="create" class="stack" autocomplete="off">
    <h2>Registro do ludus</h2>
    <p class="dim">O escrivão do general molha a pena na tinta, sem levantar os olhos: “Nome? E como você luta?”</p>
    <label>Nome do gladiador<br><input id="name" type="text" maxlength="16" required placeholder="Ex.: Spartacus" value="${esc(form.name)}"></label>
    <h3>Classe</h3><div class="grid">${classes}</div>
    <h3>Campanha</h3>
    <p class="dim">Todo gladiador começa no Fosso. Vença o chefe para virar campeão e ser transferido para a próxima arena, levando sua build.
      Se cair, o próximo gladiador recomeça do zero.</p>
    <div class="campaign">${arenas}</div>
    <div class="row"><button type="button" data-a="title">Voltar</button>
    <button type="submit" class="primary" id="start" ${form.name.trim() ? '' : 'disabled'}>Entrar na arena</button></div>
  </form>`;
}

function fighterCard(f: Fighter, hp: number, animating: boolean): string {
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
      <div class="row" style="justify-content:space-between"><span class="name">${esc(f.name)}</span><span class="statline">Vel ${f.stats.speed} · Def ${f.stats.def}</span></div>
      ${bar('hp', hp, f.stats.maxHp, `Vida ${hp}/${f.stats.maxHp}`)}
      ${bar('en', f.energy, f.stats.maxEnergy, `Energia ${f.energy}/${f.stats.maxEnergy}`)}
      <div class="chips">${chips}</div>
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

function combatView(c: CombatState): string {
  const run = g.run!;
  const arena = arenaById(run.arenaId);
  const isBoss = run.encounter === run.enemies.length - 1;
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

  const controls = c.outcome && !animating
    ? `<button class="primary" data-a="continue" style="width:100%">${continueLabel(c, isBoss, ARENAS[stageOf(run) + 1]?.name)}</button>`
    : `<div class="actions">${actionsFor(c.player).map((id, i) => {
        const s = SKILLS[id];
        const extra = id === 'flee' ? ` · chance ${Math.round(fleeChance(c.player, c.enemy) * 100)}%` : '';
        return `<button class="action${id === 'flee' ? ' flee' : ''}" data-a="act" data-v="${id}" ${animating || !canUse(c, id) ? 'disabled' : ''}>
          <span>${id === 'flee' ? statusArt('flee') : ''}<b>${s.name}</b> ${attrTag(s.attr)}<kbd>${i + 1}</kbd></span>
          <span class="cost">${s.cost ? `${s.cost} energia` : 'sem custo'}${extra}</span>
          <small>${s.desc}</small></button>`;
      }).join('')}</div>`;

  const items = run.items.length ? run.items.map((id) => `<span class="chip item" title="${ITEMS[id].desc}">${art(id, 'ico', '')}${ITEMS[id].name}</span>`).join('') : '<span class="dim">sem itens</span>';

  return `<section class="stack">
    <div class="row" style="justify-content:space-between"><h3 style="margin:0">Fase ${stageOf(run) + 1}/${ARENAS.length} · ${arena.name} · Luta ${run.encounter + 1}/${run.enemies.length}${isBoss ? ' · <span style="color:var(--red)">CHEFE</span>' : ''}</h3>
    <div class="chips">${items}</div></div>
    ${banner}
    <div class="combat">
      <div class="stack">
        <div class="stage" style="background-image:url(${assetUrl(`bg-${arena.id}`)})">
          ${actor(c.player, pHp, fresh, run.classId, run.classId)}
          ${actor(c.enemy, eHp, fresh, run.enemies[run.encounter], isBoss ? 'boss' : 'enemy', isBoss)}
        </div>
        <div class="cards">${fighterCard(c.player, pHp, animating)}${fighterCard(c.enemy, eHp, animating)}</div>
        <p class="dim center" style="font-size:0.95rem">${order} Defender sempre age antes.</p>
        ${controls}
      </div>
      <div class="sketch log" aria-label="Registro de combate"><h3>Registro</h3><ol>
        ${visible.map((l, i) => `<li class="${l.kind}${animating && i === visible.length - 1 ? ' fresh' : ''}"><span class="rd">R${l.round}</span>${esc(l.text)}</li>`).join('')}
      </ol></div>
    </div>
  </section>`;
}

// ---------- Acampamento (vida fora das batalhas) ----------

const CAMP_NPCS: NpcId[] = ['merchant', 'str', 'dex', 'wis', 'inn'];

function offerCard(pic: string, title: string, body: string, button: string, opts: { a: string; v?: string; disabled?: boolean; poor?: boolean }): string {
  return `<div class="sketch offer">
    ${art(pic, 'offer-art', '')}
    <div><h3>${title}</h3>${body}</div>
    <button data-a="${opts.a}" data-v="${opts.v ?? ''}" class="${opts.poor ? 'poor' : ''}" ${opts.disabled ? 'disabled' : ''}>${button}</button>
  </div>`;
}

function npcOffers(run: RunState, npc: NpcId): string {
  const noDays = freeDays(run) <= 0;
  const dayNote = noDays ? ' · último dia!' : ' · 1 dia';
  if (npc === 'merchant') {
    if (!run.shop.length) return '<p class="dim">Estoque esgotado. Volte depois da próxima luta.</p>';
    return run.shop.map((id) => {
      const it = ITEMS[id];
      return offerCard(id, it.name, `<p>${it.desc}</p>`, `Comprar · ${it.price} ouro`, { a: 'buy', v: id, poor: run.gold < it.price });
    }).join('');
  }
  if (npc === 'inn') {
    const max = maxHp(run);
    const price = restPrice(run);
    const paid = run.gold >= price;
    const gain = Math.min(max - run.hp, Math.round(max * (paid ? REST_PAID : REST_FREE)));
    const body = `<p>${paid ? `Quarto com ensopado: recupera ${Math.round(REST_PAID * 100)}% da vida.` : `Sem ouro para o quarto (${price}): o estábulo recupera só ${Math.round(REST_FREE * 100)}%.`}</p>
      <p class="dim">Vida ${run.hp}/${max}${gain > 0 ? ` → +${gain}` : ''}</p>`;
    return offerCard('rest', paid ? 'Descansar no quarto' : 'Dormir no estábulo', body,
      `${paid ? `${price} ouro` : 'Grátis'}${dayNote}`, { a: 'rest', disabled: noDays });
  }
  const a = npc;
  const info = ATTR_INFO[a];
  const price = trainPrice(run, a);
  const train = offerCard(`attr-${a}`, `Treinar ${info.name}: ${run.attrs[a]} → ${run.attrs[a] + 1}`, `<p>${info.desc}</p>`,
    `${price} ouro${dayNote}`, { a: 'train', v: a, disabled: noDays, poor: run.gold < price });
  const skills = Object.values(SKILLS).filter((sk) => sk.attr === a && sk.price).map((sk) => {
    const block = learnBlock(run, sk.id);
    const reqOk = run.attrs[a] >= sk.req!;
    const body = `<p><span class="cost">${sk.cost} energia</span> · ${sk.desc}</p>
      <p class="${reqOk ? 'dim' : 'warn'}">Requer ${info.short} ${sk.req}${block === 'slots' ? ' · sem espaço livre' : ''}</p>`;
    const label = block === 'known' ? 'Conhecida' : `Aprender · ${sk.price} ouro${dayNote}`;
    return offerCard(`attr-${a}`, sk.name, body, label,
      { a: 'learn', v: sk.id, disabled: block === 'known' || block === 'days', poor: block === 'gold' || block === 'req' || block === 'slots' });
  }).join('');
  return train + skills;
}

function campView(npc: NpcId | null, line: string, news: string): string {
  const run = g.run!;
  const arena = arenaById(run.arenaId);
  const { stats } = playerBuild(run);
  const next = ENEMIES[run.enemies[run.encounter]];
  const isBoss = run.encounter === run.enemies.length - 1;
  const free = freeDays(run);

  const npcButtons = CAMP_NPCS.map((id) => `<button class="npc${npc === id ? ' selected' : ''}" data-a="talk" data-v="${id}" aria-pressed="${npc === id}">
      ${art(`npc-${id}`, 'npc-sprite', NPCS[id].name)}<span><b>${NPCS[id].name}</b><small>${NPCS[id].role}</small></span></button>`).join('');

  const panel = npc
    ? `<div class="sketch npc-panel" aria-live="polite">
        <div class="dialog">${art(`npc-${npc}`, 'npc-portrait', NPCS[npc].name)}
          <div class="bubble"><b>${NPCS[npc].name}</b> <span class="dim">· ${NPCS[npc].role}</span><p>“${esc(line)}”</p></div>
          <button class="close" data-a="talk" data-v="" aria-label="Fechar conversa">✕</button></div>
        <div class="offers">${npcOffers(run, npc)}</div>
      </div>`
    : '<p class="dim center">Clique em alguém do ludus para conversar, comprar, treinar ou descansar.</p>';

  return `<section class="stack">
    <div class="row" style="justify-content:space-between">
      <h2 style="margin:0">Acampamento · Fase ${stageOf(run) + 1}/${ARENAS.length} · ${arena.name}</h2>
      <div class="row pills"><span class="pill">${art('day', 'ico', '')}Dia ${run.day}/${arena.days}</span>${goldPill(run.gold)}</div>
    </div>
    ${bar('hp', run.hp, stats.maxHp, `Vida ${run.hp}/${stats.maxHp}`)}
    ${news ? `<p class="sketch news">${esc(news)}</p>` : ''}
    <div class="town" style="background-image:url(${assetUrl('bg-town')})">${npcButtons}</div>
    ${panel}
    <div class="camp-grid">
      <div class="sketch">
        <h3>Ficha de ${esc(run.name)}</h3>
        ${run.titles.length ? `<p class="titles">${run.titles.map((id) => `<span class="pill gold">${art('victory', 'ico', '')}Campeão de ${arenaById(id).name}</span>`).join(' ')}</p>` : ''}
        ${ATTRS.map((a) => `<div class="attr-row ${a}">${art(`attr-${a}`, 'attr-ico', '')}<div><b>${ATTR_INFO[a].name} ${run.attrs[a]}</b><small>${ATTR_INFO[a].desc}</small></div></div>`).join('')}
        <p class="statline">${statLine(stats)}</p>
        <h3>Habilidades ${run.skills.length}/${MAX_SKILLS}</h3>
        <ul class="skill-list">${run.skills.map((id) => `<li>${attrTag(SKILLS[id].attr)} <b>${SKILLS[id].name}</b> (${SKILLS[id].cost} en.): ${SKILLS[id].desc}</li>`).join('')}</ul>
        <h3>Itens</h3>
        <p>${run.items.length ? run.items.map((id) => `<span class="chip item" title="${ITEMS[id].desc}">${art(id, 'ico', '')}${ITEMS[id].name}</span>`).join(' ') : '<span class="dim">Nenhum item ainda.</span>'}</p>
      </div>
      <div class="sketch next-card">
        <h3>Próxima luta ${run.encounter + 1}/${run.enemies.length}</h3>
        ${art(next.id, 'foe-preview', next.name, isBoss ? 'boss' : 'enemy')}
        <p><b>${next.name}</b>${isBoss ? ' <span style="color:var(--red)">(CHEFE)</span>' : ''}<br><span class="dim">${next.desc}</span></p>
        <p class="${free <= 2 ? 'warn' : 'dim'}">${free <= 0 ? 'Último dia da temporada: hoje só resta lutar!' : `${free} dia(s) livre(s) antes do prazo.`}</p>
        <button class="primary" data-a="fight" style="width:100%">Ir para a arena · 1 dia</button>
      </div>
    </div>
  </section>`;
}

function summaryView(s: Summary): string {
  const r = s.run;
  const title = { victory: 'Vitória!', defeat: 'Derrota', draw: 'Queda mútua', timeout: 'Fim da temporada' }[s.result];
  const fought = r.kills.length + r.fled.length + (s.result === 'defeat' || s.result === 'draw' ? 1 : 0);
  const total = ARENAS.reduce((n, a) => n + a.fights + 1, 0);
  return `<section class="stack center">
    ${art(s.result === 'victory' ? 'victory' : 'defeat', 'summary-art', '')}
    <h1 class="summary-title ${s.result === 'victory' ? 'win' : 'lose'}">${title}</h1>
    <div class="row" style="justify-content:center">${art(r.classId, `portrait${s.result === 'victory' ? '' : ' fallen'}`, CLASSES[r.classId].name, r.classId)}<p style="font-size:1.3rem">${esc(r.name)}, ${CLASSES[r.classId].name}<br><span class="dim">${s.result === 'victory'
      ? `conquistou todas as ${ARENAS.length} arenas!` : `caiu em ${arenaById(r.arenaId).name} (fase ${stageOf(r) + 1}/${ARENAS.length})`}</span></p></div>
    ${r.titles.length ? `<p class="sketch unlock">${r.titles.map((id) => `Campeão de <b>${arenaById(id).name}</b>`).join(' · ')}</p>` : ''}
    ${s.result !== 'victory' ? '<p class="dim">O próximo gladiador recomeça do Fosso de Areia. Só o XP (nível) é mantido.</p>' : ''}
    <div class="sketch" style="max-width:560px;margin:0 auto;text-align:left">
      <dl class="kv">
        <dt>Lutas</dt><dd>${r.kills.length} vencidas de ${fought} disputadas (a campanha tem ${total})</dd>
        <dt>Derrotados</dt><dd>${r.kills.map((id) => ENEMIES[id].name).join(', ') || 'ninguém'}</dd>
        <dt>Dias</dt><dd>${r.daysSpent} no total${s.result === 'timeout' ? ` (o prazo de ${arenaById(r.arenaId).name} acabou antes do chefe cair)` : ''}</dd>
        <dt>Fugas</dt><dd>${r.fled.length}</dd>
        <dt>Rodadas</dt><dd>${r.rounds}</dd>
        <dt>Ouro ganho</dt><dd>${r.goldEarned}</dd>
        <dt>Atributos</dt><dd>${attrLine(r.attrs)}</dd>
        <dt>Habilidades</dt><dd>${r.skills.map((id) => SKILLS[id].name).join(', ')}</dd>
        <dt>Dano causado</dt><dd>${r.dealt}</dd>
        <dt>Dano recebido</dt><dd>${r.taken}</dd>
        <dt>Itens</dt><dd>${r.items.map((id) => `${art(id, 'ico', '')}${ITEMS[id].name}`).join(', ') || 'nenhum'}</dd>
        <dt>XP ganho</dt><dd style="color:var(--gold)">+${s.xpGained}</dd>
        <dt>Nível</dt><dd>${s.levelBefore}${s.levelAfter > s.levelBefore ? ` → <b style="color:var(--gold)">${s.levelAfter}</b> (subiu de nível!)` : ''}</dd>
      </dl>
    </div>
    <div class="row" style="justify-content:center"><button data-a="title">Início</button><button class="primary" data-a="again">Nova campanha</button></div>
  </section>`;
}

type SceneScreen = Extract<GameState['screen'], { name: 'scene' }>;

function sceneView(s: SceneScreen): string {
  const sc = SCENES[s.queue[0]];
  const beat = sc.beats[s.beat];
  const bg = sc.beats.slice(0, s.beat + 1).reduce((cur, b) => b.bg ?? cur, sc.bg);
  // No epílogo a campanha já foi encerrada: o herói vem do resumo que espera depois da cena.
  const run = g.run ?? (s.next.name === 'summary' ? s.next.summary.run : null);
  const heroName = run ? esc(run.name) : 'Você';
  const fill = (t: string) => esc(t).replace(/\{nome\}/g, heroName).replace(/\{classe\}/g, run ? CLASSES[run.classId].name : '');
  const sp = SPEAKERS[beat.who];
  const narrator = beat.who === 'narrator';
  const name = beat.who === 'hero' ? heroName : sp.name;
  const portrait = beat.who === 'hero' ? run?.classId : sp.art;
  const total = s.queue.reduce((n, id) => n + SCENES[id].beats.length, 0) - s.beat - 1;
  return `<section class="stack scene-wrap">
    <div class="scene" style="background-image:url(${assetUrl(bg)})">
      <span class="scene-title">${sc.title}</span>
      ${portrait ? art(portrait, `scene-portrait ${sp.side}`, name) : ''}
    </div>
    <div class="sketch scene-box${narrator ? ' narration' : ''}" aria-live="polite">
      ${narrator ? '' : `<b class="speaker ${sp.side}">${name}</b>`}
      <p class="line">${narrator ? fill(beat.text) : `“${fill(beat.text)}”`}</p>
      <div class="row scene-controls">
        <span class="dim">${total > 0 ? `${total} fala(s) restante(s)` : 'Fim da cena'}</span>
        <button data-a="skip">Pular cenas</button>
        <button class="primary" data-a="next" id="next">Continuar ▸</button>
      </div>
    </div>
  </section>`;
}

function render() {
  const s = g.screen;
  app.innerHTML =
    s.name === 'title' ? titleView()
    : s.name === 'create' ? createView()
    : s.name === 'combat' ? combatView(s.combat)
    : s.name === 'camp' ? campView(s.npc, s.line, s.news)
    : s.name === 'scene' ? sceneView(s)
    : summaryView(s.summary);
  setTrack(trackFor(g));
  if (s.name === 'scene') {
    preloadScenes(s.queue);
    document.getElementById('next')?.focus({ preventScroll: true });
  }
}

/** Baixa fundos e retratos das cenas da fila antes de aparecerem (evita retrato surgindo atrasado). */
const preloaded = new Set<string>();
function preloadScenes(queue: string[]) {
  for (const sc of queue.map((id) => SCENES[id])) {
    for (const name of [sc.bg, ...sc.beats.map((b) => b.bg ?? SPEAKERS[b.who].art)]) {
      if (!name || preloaded.has(name)) continue;
      preloaded.add(name);
      new Image().src = assetUrl(name);
    }
  }
}

/** Combate comum, chefe ou ambiente (menus, acampamento e resumo). */
function trackFor(state: GameState): Track {
  if (state.screen.name === 'scene') return SCENES[state.screen.queue[0]].music ?? 'menu';
  if (state.screen.name !== 'combat' || !state.run) return 'menu';
  return state.run.encounter === state.run.enemies.length - 1 ? 'boss' : 'battle';
}

// Botão de som (música e efeitos) fora do #app: sobrevive aos re-renders.
const muteBtn = document.createElement('button');
muteBtn.className = 'mute';
const paintMute = () => {
  muteBtn.textContent = isMuted() ? '🔇 Som' : '🔊 Som';
  muteBtn.setAttribute('aria-pressed', String(!isMuted()));
  muteBtn.setAttribute('aria-label', isMuted() ? 'Ligar som' : 'Desligar som');
};
muteBtn.addEventListener('click', () => { toggleMute(); paintMute(); });
paintMute();
document.body.append(muteBtn);
// O navegador só libera áudio após um gesto: o primeiro clique/tecla retoma a faixa atual.
for (const ev of ['pointerdown', 'keydown'] as const) document.addEventListener(ev, () => setTrack(trackFor(g)), { once: true });

// ---------- eventos ----------

app.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-a]');
  if (!btn || btn.disabled) return;
  const v = btn.dataset.v!;
  switch (btn.dataset.a) {
    case 'new': return dispatch({ type: 'newGame' });
    case 'title': return dispatch({ type: 'toTitle' });
    case 'again': dispatch({ type: 'toTitle' }); return dispatch({ type: 'newGame' });
    case 'class': form.classId = v as ClassId; return render();
    case 'act': return dispatch({ type: 'act', action: v });
    case 'continue': return dispatch({ type: 'continue' });
    case 'next': return dispatch({ type: 'next' });
    case 'skip': return dispatch({ type: 'skip' });
    case 'talk': return dispatch({ type: 'talk', npc: (v || null) as NpcId | null });
    case 'buy': return dispatch({ type: 'buy', itemId: v });
    case 'train': return dispatch({ type: 'train', attr: v as Attr });
    case 'learn': return dispatch({ type: 'learn', skill: v });
    case 'rest': return dispatch({ type: 'rest' });
    case 'fight': return dispatch({ type: 'fight' });
  }
});

// Imagem que não carregou: troca pelo ícone SVG equivalente, ou só remove.
app.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  if (t.dataset.fb) t.outerHTML = icon(t.dataset.fb);
  else t.remove();
}, true);

app.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id !== 'name') return;
  form.name = t.value;
  document.querySelector<HTMLButtonElement>('#start')!.disabled = !t.value.trim();
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  dispatch({ type: 'startRun', name: form.name, classId: form.classId, seed: (Math.random() * 2 ** 32) | 0 });
});

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (g.screen.name === 'scene') {
    // Enter/Espaço num botão já viram clique; aqui só atalhos fora de botões.
    if (e.key === 'Escape') dispatch({ type: 'skip' });
    else if (e.key === 'ArrowRight' || ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLButtonElement))) {
      e.preventDefault();
      dispatch({ type: 'next' });
    }
    return;
  }
  if (g.screen.name !== 'combat') return;
  const id = actionsFor(g.screen.combat.player)[Number(e.key) - 1];
  if (id) dispatch({ type: 'act', action: id });
});

render();
