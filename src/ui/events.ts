// Eventos da página: tabela `data-a` → ação, mais entrada de texto, envio do formulário e atalhos de teclado.
import { BAG_SIZE, type ClassId } from '../data';
import { actionsFor } from '../engine/combat';
import { defaultKeep } from '../engine/items';
import type { GameAction } from '../state';
import { icon } from './components';
import { settingsOpen } from './settings';
import { TRAY_PAGES, type TrayPage } from './views/combat';
import { app, dispatch, form, render, state, ui } from './store';

/** Serviço do NPC com quem se está conversando (os botões das ofertas só aparecem com a conversa aberta). */
function serve(value: string): GameAction | void {
  const s = state().screen;
  if (s.name === 'camp' && s.npc) return { type: 'service', npc: s.npc, value };
}

/** Cada `data-a` vira uma ou mais ações do jogo (`v` = `data-v` do botão); void = tratada na própria página. */
const ACTIONS: Record<string, (v: string) => GameAction | GameAction[] | void> = {
  new: () => ({ type: 'newGame' }),
  title: () => ({ type: 'toTitle' }),
  story: (v) => ({ type: 'startAct', act: Number(v), seed: (Math.random() * 2 ** 32) | 0 }),
  again: () => [{ type: 'toTitle' }, { type: 'newGame' }],
  class: (v) => { form.classId = v as ClassId; render(); },
  act: (v) => ({ type: 'act', action: v }),
  tray: (v) => { ui.tray = v as TrayPage; render(); },
  continue: () => ({ type: 'continue', keep: ui.keep ?? undefined }),
  leave: () => {
    const s = state().screen;
    if (s.name === 'combat') return { type: 'continue', keep: s.combat.player.bag.map((_, i) => i) }; // só a própria bolsa
  },
  keep: (v) => {
    const s = state().screen;
    if (s.name !== 'combat') return;
    const c = s.combat, i = Number(v);
    const sel = ui.keep ?? defaultKeep(c.player.bag.length + c.enemy.bag.length);
    ui.keep = sel.includes(i) ? sel.filter((x) => x !== i) : sel.length < BAG_SIZE ? [...sel, i] : sel;
    render();
  },
  bag: () => { ui.bag = !ui.bag; render(); },
  next: () => ({ type: 'next' }),
  skip: () => ({ type: 'skip' }),
  talk: (v) => {
    ui.bag = false;
    return { type: 'talk', npc: v || null };
  },
  buy: (v) => serve(v),
  use: (v) => ({ type: 'use', itemId: v }),
  train: () => serve('train'),
  learn: (v) => serve(v),
  rest: () => serve('rest'),
  fight: () => ({ type: 'fight' }),
};

/**
 * No toque não existe tooltip: tocar num elemento com `title` (status, ponto fraco, item, marca da multidão) mostra o texto
 * num balão perto dele. Fica fora do #app, então sobrevive ao render; some no próximo toque ou sozinho.
 */
const NO_HOVER = matchMedia('(hover: none)');
const tip = document.createElement('div');
tip.className = 'tip';
tip.setAttribute('role', 'tooltip');
tip.hidden = true;
let tipTimer = 0;
function showTip(el: HTMLElement) {
  tip.textContent = el.title;
  tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8}px`;
  clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => { tip.hidden = true; }, 4000);
}

export function bindEvents() {
  document.body.append(tip);
  document.addEventListener('pointerdown', () => { tip.hidden = true; }, true);
  app.addEventListener('click', (e) => {
    const titled = (e.target as Element).closest<HTMLElement>('[title]');
    if (NO_HOVER.matches && titled && !titled.closest('button') && titled.title) showTip(titled);
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-a]');
    if (!btn || btn.disabled) return;
    const result = ACTIONS[btn.dataset.a!]?.(btn.dataset.v!);
    if (result) [result].flat().forEach(dispatch);
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

  // Deslizar a bandeja de ações para os lados troca de página (celular).
  let touch: { x: number; y: number } | null = null;
  app.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touch = (e.target as Element).closest('.tray-pages') ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  app.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const i = TRAY_PAGES.indexOf(ui.tray) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= TRAY_PAGES.length) return;
    ui.tray = TRAY_PAGES[i];
    render();
  });

  document.addEventListener('keydown', onKey);
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || settingsOpen()) return; // a janela de opções cuida das próprias teclas
  const { screen } = state();
  if (screen.name === 'camp' && e.key === 'Escape') {
    // Esc fecha a bolsa ou a conversa aberta
    if (ui.bag) { ui.bag = false; render(); } else if (screen.npc) dispatch({ type: 'talk', npc: null });
    return;
  }
  if (screen.name === 'scene') {
    // Enter/Espaço num botão já viram clique; aqui só atalhos fora de botões.
    if (e.key === 'Escape') dispatch({ type: 'skip' });
    else if (e.key === 'ArrowRight' || ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLButtonElement))) {
      e.preventDefault();
      dispatch({ type: 'next' });
    }
    return;
  }
  if (screen.name !== 'combat') return;
  // Setas trocam de aba quando o foco está na bandeja (padrão de tablist)
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target instanceof HTMLElement && e.target.classList.contains('tab')) {
    const i = TRAY_PAGES.indexOf(ui.tray) + (e.key === 'ArrowRight' ? 1 : -1);
    ui.tray = TRAY_PAGES[(i + TRAY_PAGES.length) % TRAY_PAGES.length];
    render();
    app.querySelector<HTMLElement>(`.tab[data-v="${ui.tray}"]`)?.focus();
    return;
  }
  const id = actionsFor(screen.combat.player, screen.combat)[Number(e.key) - 1];
  if (id) dispatch({ type: 'act', action: id });
}
