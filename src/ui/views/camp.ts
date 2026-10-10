// Acampamento (vida fora das batalhas).
import { ARENAS, ATTR_INFO, BAG_SIZE, ENEMIES, ITEMS, MAX_SKILLS, NPCS, REST_FREE, REST_PAID, SKILLS, type NpcId } from '../../data';
import { isQuickItem } from '../../engine/combat';
import { buyBlock } from '../../engine/items';
import { arenaById, freeDays, isBossFight, learnBlock, maxHp, playerBuild, restPrice, stageOf, trainPrice, useBlock, type GameState, type RunState } from '../../state';
import { ATTRS, art, assetUrl, bar, bossTag, esc, goldPill, itemChip, skillList, statLine } from '../components';

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
      const full = buyBlock(run, id) === 'bag';
      const body = `<p>${it.use ? `<span class="cost">Consumível</span> · ` : ''}${it.desc}</p>`;
      return offerCard(id, it.name, body, full ? `Bolsa cheia (${BAG_SIZE})` : `Comprar · ${it.price} ouro`, { a: 'buy', v: id, disabled: full, poor: run.gold < it.price });
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

export function campView(g: GameState, npc: NpcId | null, line: string, news: string, loot: string[] = [], bagOpen = false): string {
  const run = g.run!;
  const arena = arenaById(run.arenaId);
  const { stats } = playerBuild(run);
  const next = ENEMIES[run.enemies[run.encounter]];
  const isBoss = isBossFight(run);
  const free = freeDays(run);

  const npcButtons = CAMP_NPCS.map((id) => `<button class="npc${npc === id ? ' selected' : ''}" data-a="talk" data-v="${id}" aria-pressed="${npc === id}">
      ${art(`npc-${id}`, 'npc-sprite', NPCS[id].name)}<span><b>${NPCS[id].name}</b><small>${NPCS[id].role}</small></span></button>`).join('');

  const panel = bagOpen ? bagPanel(run, loot)
    : npc
    ? `<div class="sketch npc-panel" aria-live="polite">
        <div class="dialog">${art(`npc-${npc}`, 'npc-portrait', NPCS[npc].name)}
          <div class="bubble"><b>${NPCS[npc].name}</b> <span class="dim">· ${NPCS[npc].role}</span><p>“${esc(line)}”</p></div>
          <button class="close" data-a="talk" data-v="" aria-label="Fechar conversa">✕</button></div>
        <div class="offers">${npcOffers(run, npc)}</div>
      </div>`
    : '<p class="dim center small">Toque em alguém do ludus para conversar, comprar, treinar ou descansar.</p>';

  return `<section class="screen camp-screen">
    <header class="topbar">
      <h2>Acampamento <span class="dim tb-sub">Fase ${stageOf(run) + 1}/${ARENAS.length} · ${arena.name}</span></h2>
      <div class="row pills"><span class="pill">${art('day', 'ico', '')}Dia ${run.day}/${arena.days}</span>${goldPill(run.gold)}
        <button class="pill bag-btn${bagOpen ? ' selected' : ''}${loot.length ? ' new' : ''}" data-a="bag" aria-pressed="${bagOpen}" aria-label="Bolsa ${run.bag.length} de ${BAG_SIZE}${loot.length ? ', itens novos' : ''}">⚗ <span class="bag-word">Bolsa </span>${run.bag.length}/${BAG_SIZE}</button></div>
    </header>
    ${bar('hp', run.hp, stats.maxHp, `Vida ${run.hp}/${stats.maxHp}`)}
    ${news ? `<p class="sketch news" title="${esc(news)}">${esc(news)}</p>` : ''}
    <div class="town" style="background-image:url(${assetUrl('bg-town')})">${npcButtons}</div>
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
        <p><b>${next.name}</b>${isBoss ? ` ${bossTag('(CHEFE)')}` : ''}<span class="dim next-desc"> · ${next.desc}</span></p>
        <p class="${free <= 2 ? 'warn' : 'dim'} small">${free <= 0 ? 'Último dia: hoje só resta lutar!' : `${free} dia(s) livre(s) antes do prazo.`}</p>
      </div>
      <button class="primary" data-a="fight">Ir para a arena · 1 dia</button>
    </div>
  </section>`;
}
