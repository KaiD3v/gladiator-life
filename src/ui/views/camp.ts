// Acampamento (vida fora das batalhas).
import { ATTR_INFO, BAG_SIZE, BET, BETS, ENEMIES, GOALS, ITEMS, MAX_SKILLS, NPCS, REST_FREE, REST_PAID, RIVAL, SKILLS, type ServiceDef, type ServiceKind } from '../../data';
import { isQuickItem } from '../../engine/combat';
import { buyBlock } from '../../engine/items';
import { arenaById, betBoost, campOf, foeName, freeDays, isBossFight, rivalFight, learnBlock, maxHp, npcOf, playerBuild, restPrice, trainPrice, useBlock, type GameState, type RunState } from '../../state';
import { ATTRS, art, assetUrl, bar, bossTag, esc, goldPill, itemChip, skillList, stageLabel, statLine } from '../components';


const STAT_LABEL = { maxHp: 'Vida', maxEnergy: 'Energia', regen: 'Regen.', atk: 'Atq', mag: 'Mag', def: 'Def', speed: 'Vel', crit: 'Crít' };
type ShownStat = keyof typeof STAT_LABEL;
const fmt = (k: ShownStat, v: number) => (k === 'crit' ? `${Math.round(v * 100)}%` : `${v}`);
/** O que muda na build com a compra ou o treino: "Vel 4 → 7 · Atq 12 → 13" (vazio se nada muda nos números). */
function statDiff(run: RunState, after: RunState): string {
  const a = playerBuild(run).stats, b = playerBuild(after).stats;
  const diff = (Object.keys(STAT_LABEL) as ShownStat[]).filter((k) => a[k] !== b[k])
    .map((k) => `${STAT_LABEL[k]} ${fmt(k, a[k])} → <b>${fmt(k, b[k])}</b>`).join(' · ');
  return diff ? `<p class="gain">${diff}</p>` : '';
}
/** Rótulo do botão quando falta ouro: diz quanto falta. */
const priceLabel = (run: RunState, verb: string, price: number, note = '') =>
  run.gold < price ? `Faltam ${price - run.gold} ouro${note}` : `${verb}${price} ouro${note}`;

function offerCard(pic: string, title: string, body: string, button: string, opts: { a: string; v?: string; disabled?: boolean; poor?: boolean }): string {
  return `<div class="sketch offer">
    ${art(pic, 'offer-art', '')}
    <div><h3>${title}</h3>${body}</div>
    <button data-a="${opts.a}" data-v="${opts.v ?? ''}" class="${opts.poor ? 'poor' : ''}" ${opts.disabled ? 'disabled' : ''}>${button}</button>
  </div>`;
}

const dayNote = (run: RunState) => (freeDays(run) <= 0 ? ' · último dia!' : ' · 1 dia');

/** Vitrine de cada tipo de serviço (a regra fica em state/services.ts). Os `data-a` viram a ação `service` do NPC aberto. */
const SERVICE_VIEWS: { [K in ServiceKind]: (run: RunState, svc: Extract<ServiceDef, { kind: K }>) => string } = {
  shop: (run) => {
    if (!run.shop.length) return '<p class="dim">Estoque esgotado. Volte depois da próxima luta.</p>';
    return run.shop.map((id) => {
      const it = ITEMS[id];
      const full = buyBlock(run, id) === 'bag';
      const body = `<p>${it.use ? `<span class="cost">Consumível</span> · ` : ''}${it.desc}</p>${it.use ? '' : statDiff(run, { ...run, items: [...run.items, id] })}`;
      return offerCard(id, `${it.name}${it.relic ? ' <span class="chip relic">Relíquia</span>' : ''}`, body, full ? `Bolsa cheia (${BAG_SIZE})` : priceLabel(run, 'Comprar · ', it.price), { a: 'buy', v: id, disabled: full, poor: run.gold < it.price });
    }).join('');
  },
  inn: (run) => {
    const max = maxHp(run);
    const price = restPrice(run);
    const paid = run.gold >= price;
    const gain = Math.min(max - run.hp, Math.round(max * (paid ? REST_PAID : REST_FREE)));
    const body = `<p>${paid ? `Quarto com ensopado: recupera ${Math.round(REST_PAID * 100)}% da vida.` : `Sem ouro para o quarto (${price}): o estábulo recupera só ${Math.round(REST_FREE * 100)}%.`}</p>
      <p class="dim">Vida ${run.hp}/${max}${gain > 0 ? ` → +${gain}` : ''}</p>`;
    return offerCard('rest', paid ? 'Descansar no quarto' : 'Dormir no estábulo', body,
      `${paid ? `${price} ouro` : 'Grátis'}${dayNote(run)}`, { a: 'rest', disabled: freeDays(run) <= 0 });
  },
  bookie: (run) => BETS.map((b) => {
    const stakes = BET.stakes.map((st, i) => {
      const mine = run.bet?.id === b.id && run.bet.stake === i;
      const foe = st.boost ? `adversário +${Math.round(st.boost * 100)}%` : 'luta normal';
      const label = mine ? 'Aposta feita' : run.gold < st.gold ? `Faltam ${st.gold - run.gold} ouro` : `${st.gold} → ${Math.round(st.gold * b.odds)} ouro`;
      return `<button data-a="bet" data-v="bet:${b.id}:${i}" class="${run.gold < st.gold ? 'poor' : ''}${mine ? ' selected' : ''}" ${run.bet ? 'disabled' : ''}>${label}<small>${foe}</small></button>`;
    }).join('');
    return `<div class="sketch offer bet-offer">
      ${art('gold', 'offer-art', '')}
      <div><h3>Aposta: ${GOALS[b.goal].text}</h3><p>Na próxima luta. Paga ${b.odds}× o valor; quanto mais alto, mais forte o adversário. Fugir perde a aposta.</p></div>
      <div class="bet-stakes">${stakes}</div>
    </div>`;
  }).join(''),
  trainer: (run, { attr: a }) => {
    const noDays = freeDays(run) <= 0;
    const info = ATTR_INFO[a];
    const price = trainPrice(run, a);
    const train = offerCard(`attr-${a}`, `Treinar ${info.name}: ${run.attrs[a]} → ${run.attrs[a] + 1}`,
      `<p>${info.desc}</p>${statDiff(run, { ...run, attrs: { ...run.attrs, [a]: run.attrs[a] + 1 } })}`,
      priceLabel(run, '', price, dayNote(run)), { a: 'train', v: a, disabled: noDays, poor: run.gold < price });
    const skills = Object.values(SKILLS).filter((sk) => sk.attr === a && sk.price).map((sk) => {
      const block = learnBlock(run, sk.id);
      const reqOk = run.attrs[a] >= sk.req!;
      const body = `<p><span class="cost">${sk.cost} energia</span> · ${sk.desc}</p>
        <p class="${reqOk ? 'dim' : 'warn'}">Requer ${info.short} ${sk.req}${block === 'slots' ? ' · sem espaço livre' : ''}</p>`;
      const label = block === 'known' ? 'Conhecida' : priceLabel(run, 'Aprender · ', sk.price!, dayNote(run));
      return offerCard(`attr-${a}`, sk.name, body, label,
        { a: 'learn', v: sk.id, disabled: block === 'known' || block === 'days', poor: block === 'gold' || block === 'req' || block === 'slots' });
    }).join('');
    return train + skills;
  },
};

/** Todas as vitrines dos serviços do NPC, em ordem. */
const npcOffers = (run: RunState, services: ServiceDef[]) =>
  services.map((svc) => (SERVICE_VIEWS[svc.kind] as (run: RunState, svc: ServiceDef) => string)(run, svc)).join('');

/** Bolsa aberta pelo botão do topo: cada consumível com quantidade, tipo, descrição e uso (só cura fora da luta). */
function bagPanel(run: RunState, loot: string[]): string {
  const cards = [...new Set(run.bag)].map((id) => {
    const it = ITEMS[id], heal = SKILLS[id].heal;
    const n = run.bag.filter((x) => x === id).length;
    const block = useBlock(run, id);
    const kind = isQuickItem(id) ? 'Defesa' : 'Ataque';
    const label = !heal ? 'Só em combate' : block === 'full' ? 'Vida cheia' : `Usar · +${heal} vida`;
    return offerCard(id, `${it.name} ×${n}${loot.includes(id) ? ' <span class="chip new">Novo</span>' : ''}`,
      `<p><span class="cost">${kind}</span> · ${it.desc}</p>`, label, { a: 'use', v: id, disabled: !!block });
  }).join('');
  return `<div class="sketch npc-panel bag-panel" aria-live="polite">
    <div class="dialog"><h3>Bolsa ${run.bag.length}/${BAG_SIZE}</h3><button class="close" data-a="bag" aria-label="Fechar bolsa">✕</button></div>
    <div class="offers">${cards || '<p class="dim">Vazia. Compre consumíveis no mercador ou vença quem os carrega.</p>'}</div>
  </div>`;
}

export function campView(g: GameState, npc: string | null, line: string, news: string, loot: string[] = [], bagOpen = false): string {
  const run = g.run!;
  const arena = arenaById(run.arenaId);
  const { stats } = playerBuild(run);
  const next = ENEMIES[run.enemies[run.encounter]];
  const isBoss = isBossFight(run);
  const free = freeDays(run);

  const camp = campOf(run);
  const npcButtons = camp.npcs.map((id) => {
    const n = npcOf(id);
    return `<button class="npc${npc === id ? ' selected' : ''}" data-a="talk" data-v="${id}" aria-pressed="${npc === id}">
      ${art(n.art, 'npc-sprite', n.name)}<span><b>${n.name}</b><small>${n.role}</small></span></button>`;
  }).join('');
  const talking = npc && NPCS[npc] ? npcOf(npc) : null;

  const panel = bagOpen ? bagPanel(run, loot)
    : talking
    ? `<div class="sketch npc-panel" aria-live="polite">
        <div class="dialog">${art(talking.art, 'npc-portrait', talking.name)}
          <div class="bubble"><b>${talking.name}</b> <span class="dim">· ${talking.role}</span><p>“${esc(line)}”</p></div>
          <button class="close" data-a="talk" data-v="" aria-label="Fechar conversa">✕</button></div>
        <div class="offers">${npcOffers(run, talking.services)}</div>
      </div>`
    : '';

  return `<section class="screen camp-screen">
    <header class="topbar">
      <h2>${camp.name} <span class="dim tb-sub">${stageLabel(run.arenaId)} · ${arena.name}</span></h2>
      <div class="row pills"><span class="pill">${art('day', 'ico', '')}Dia ${run.day}/${arena.days}</span>${goldPill(run.gold)}
        <button class="pill bag-btn${bagOpen ? ' selected' : ''}${loot.length ? ' new' : ''}" data-a="bag" aria-pressed="${bagOpen}" aria-label="Bolsa ${run.bag.length} de ${BAG_SIZE}${loot.length ? ', itens novos' : ''}">${art('chest', 'ico', '')}<span class="bag-word">Bolsa </span>${run.bag.length}/${BAG_SIZE}</button></div>
    </header>
    ${bar('hp', run.hp, stats.maxHp, `Vida ${run.hp}/${stats.maxHp}`)}
    ${news ? `<p class="sketch news" title="${esc(news)}">${esc(news)}</p>` : ''}
    <div class="town" style="background-image:url(${assetUrl(camp.bg)})">${npc || bagOpen ? '' : '<p class="town-hint">Toque em alguém para conversar, comprar, treinar ou descansar</p>'}${npcButtons}</div>
    <div class="camp-body scroll">
      ${panel}
      <div class="sketch ficha">
        <h3>Ficha de ${esc(run.name)}</h3>
        ${run.titles.length ? `<p class="titles">${run.titles.map((id) => `<span class="pill gold">${art('victory', 'ico', '')}Campeão de ${arenaById(id).name}</span>`).join(' ')}</p>` : ''}
        ${ATTRS.map((a) => `<div class="attr-row ${a}">${art(`attr-${a}`, 'attr-ico', '')}<div><b>${ATTR_INFO[a].name} ${run.attrs[a]}</b><small>${ATTR_INFO[a].desc}</small></div></div>`).join('')}
        <p class="statline">${statLine(stats)}</p>
        <h3>Habilidades ${run.skills.length}/${MAX_SKILLS}</h3>
        ${skillList(run.skills)}
        <h3>Equipamento</h3>
        <p>${run.items.length ? run.items.map(itemChip).join(' ') : '<span class="dim">Nenhum item ainda.</span>'}</p>
        <h3>Bolsa ${run.bag.length}/${BAG_SIZE}</h3>
        <p>${run.bag.length ? run.bag.map(itemChip).join(' ') : '<span class="dim">Vazia. Compre consumíveis no mercador ou vença quem os carrega.</span>'}</p>
      </div>
    </div>
    <div class="sketch next-card">
      ${art(next.id, 'foe-preview', next.name, isBoss ? 'boss' : 'enemy')}
      <div class="next-info">
        <h3>Próxima luta ${run.encounter + 1}/${run.enemies.length}</h3>
        <p><b>${esc(foeName(run))}</b>${isBoss ? ` ${bossTag('(CHEFE)')}` : ''}${rivalFight(run) ? ` ${bossTag('(RIVAL)')}` : ''}<span class="dim next-desc"> · ${rivalFight(run)
          ? `Já derrotou você. Patente ${run.rival!.rank}: mais forte, paga ${RIVAL.reward}× ouro e XP.` : next.desc}</span></p>
        ${run.bet ? `<p class="small gold-text">Aposta de ${BET.stakes[run.bet.stake].gold} ouro: ${GOALS[BETS.find((b) => b.id === run.bet!.id)!.goal].text}${betBoost(run) ? ` · adversário +${Math.round(betBoost(run) * 100)}%` : ''}</p>` : ''}
        <p class="${free <= 2 ? 'warn' : 'dim'} small">${free <= 0 ? 'Último dia: hoje só resta lutar!' : `${free} dia(s) livre(s) antes do prazo.`}</p>
      </div>
      <button class="primary" data-a="fight">Ir para a arena · 1 dia</button>
    </div>
  </section>`;
}
