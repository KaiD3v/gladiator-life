// Eventos da página: tabela `data-a` → ação, mais entrada de texto, envio do formulário e atalhos de teclado.
import type { Attr, ClassId, NpcId } from '../data';
import { actionsFor } from '../engine/combat';
import type { GameAction } from '../state';
import { icon } from './components';
import { app, dispatch, form, render, state } from './store';

/** Cada `data-a` vira uma ou mais ações do jogo (`v` = `data-v` do botão); void = tratada na própria página. */
const ACTIONS: Record<string, (v: string) => GameAction | GameAction[] | void> = {
  new: () => ({ type: 'newGame' }),
  title: () => ({ type: 'toTitle' }),
  again: () => [{ type: 'toTitle' }, { type: 'newGame' }],
  class: (v) => { form.classId = v as ClassId; render(); },
  act: (v) => ({ type: 'act', action: v }),
  continue: () => ({ type: 'continue' }),
  next: () => ({ type: 'next' }),
  skip: () => ({ type: 'skip' }),
  talk: (v) => ({ type: 'talk', npc: (v || null) as NpcId | null }),
  buy: (v) => ({ type: 'buy', itemId: v }),
  train: (v) => ({ type: 'train', attr: v as Attr }),
  learn: (v) => ({ type: 'learn', skill: v }),
  rest: () => ({ type: 'rest' }),
  fight: () => ({ type: 'fight' }),
};

export function bindEvents() {
  app.addEventListener('click', (e) => {
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

  document.addEventListener('keydown', onKey);
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement) return;
  const { screen } = state();
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
  const id = actionsFor(screen.combat.player)[Number(e.key) - 1];
  if (id) dispatch({ type: 'act', action: id });
}
