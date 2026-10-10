// Peças de template reutilizadas pelas telas (strings HTML).
import { ATTR_INFO, ITEMS, SKILLS, type Attr, type Attrs } from '../data';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));
export const bar = (kind: string, v: number, max: number, label: string) =>
  `<div class="bar ${kind}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}" aria-label="${esc(label)}"><i style="width:${pct(v, max)}%"></i><span>${esc(label)}</span></div>`;

const ICONS: Record<string, string> = {
  warrior: '<path d="M10 54 L42 16 L50 12 L47 20 L16 58"/><path d="M12 46 l10 10 M8 58 l5-5"/><path d="M44 30c7 0 12 3 12 3c0 10-5 17-12 21c-7-4-12-11-12-21c0 0 5-3 12-3z"/>',
  mage: '<path d="M20 60 L40 22"/><circle cx="44" cy="15" r="7"/><path d="M55 5 l2 4 M60 17 l-4 1 M34 5 l2 3 M44 4 v-1"/><path d="M14 46 q6 2 10-2"/>',
  assassin: '<path d="M10 10 L40 40 M34 46 l12-12 M40 40 l12 12"/><path d="M54 10 L24 40 M30 46 l-12-12 M24 40 l-12 12"/>',
  enemy: '<path d="M14 30c0-14 10-21 18-21s18 7 18 21c0 6-4 9-6 11v8H20v-8c-2-2-6-5-6-11z"/><circle cx="25" cy="30" r="4"/><circle cx="39" cy="30" r="4"/><path d="M27 49v-5 M32 49v-5 M37 49v-5"/>',
  boss: '<path d="M14 32c0-14 10-21 18-21s18 7 18 21c0 6-4 9-6 11v8H20v-8c-2-2-6-5-6-11z"/><path d="M24 30l6 3 M40 30l-6 3"/><path d="M27 51v-5 M32 51v-5 M37 51v-5"/><path d="M18 20C9 18 6 10 8 3c2 7 7 10 12 10 M46 20c9-2 12-10 10-17c-2 7-7 10-12 10"/>',
};
export const icon = (k: string, big = false) => `<svg class="icon${big ? ' big' : ''}" viewBox="0 0 64 64" aria-hidden="true">${ICONS[k]}</svg>`;

// Pixel art local em public/assets. Se uma imagem falhar, cai no ícone SVG (data-fb) ou some — o jogo segue funcionando.
const ASSETS = `${import.meta.env.BASE_URL}assets/`;
export const assetUrl = (name: string) => `${ASSETS}${name}.webp`;
export const art = (name: string, cls: string, alt = '', fb = '') =>
  `<img class="px ${cls}" src="${assetUrl(name)}" alt="${esc(alt)}" draggable="false"${fb ? ` data-fb="${fb}"` : ''}>`;
export const statusArt = (id: string) => art(`st-${id}`, 'st');
export const ATTRS: Attr[] = ['str', 'dex', 'wis'];
export const attrTag = (a?: Attr) => (a ? `<span class="tag ${a}">${ATTR_INFO[a].short}</span>` : '');
export const attrLine = (attrs: Attrs) => ATTRS.map((a) => `<span class="attr ${a}">${art(`attr-${a}`, 'ico', '')}${ATTR_INFO[a].short} ${attrs[a]}</span>`).join(' ');
export const goldPill = (n: number) => `<span class="pill gold">${art('gold', 'ico', '')}${n} ouro</span>`;

export const statLine = (s: { maxHp: number; maxEnergy: number; regen: number; atk: number; mag: number; def: number; speed: number; crit: number }) =>
  `Vida ${s.maxHp} · Energia ${s.maxEnergy} (+${s.regen}) · Atq ${s.atk} · Mag ${s.mag} · Def ${s.def} · Vel ${s.speed} · Crít ${Math.round(s.crit * 100)}%`;

// ---------- peças compostas (antes repetidas nas telas) ----------

/** Etiqueta vermelha de chefe; `text` permite variar o rótulo, ex.: "(CHEFE)". */
export const bossTag = (text = 'CHEFE') => `<span class="boss-tag">${text}</span>`;

/** Habilidade em lista: tag do atributo, nome, custo e descrição. */
export const skillLine = (id: string) => {
  const s = SKILLS[id];
  return `<li>${attrTag(s.attr)} <b>${s.name}</b> (${s.cost} en.): ${s.desc}</li>`;
};
export const skillList = (ids: string[]) => `<ul class="skill-list">${ids.map(skillLine).join('')}</ul>`;

/** Ícone + nome do item, sem moldura. */
export const itemLabel = (id: string) => `${art(id, 'ico', '')}${ITEMS[id].name}`;
/** Item como chip, com a descrição no tooltip. */
export const itemChip = (id: string) => `<span class="chip item" title="${esc(ITEMS[id].desc)}">${itemLabel(id)}</span>`;
