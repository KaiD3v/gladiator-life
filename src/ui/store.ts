// Estado da página: jogo (`g`), formulário de criação, persistência, animação do log e render.
import { playSfx, setTrack, type Track } from './audio';
import { SAVE_KEY, initialState, isBossFight, parseSave, reduce, type GameAction, type GameState, type SaveData } from '../state';
import { titleView } from './views/title';
import { createView, type CreateForm } from './views/create';
import { combatView } from './views/combat';
import { campView } from './views/camp';
import { summaryView } from './views/summary';
import { preloadScenes, sceneTrack, sceneView } from './views/scene';

export const app = document.getElementById('app')!;
export const form: CreateForm = { name: '', classId: 'warrior' };
const STEP_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 520;

let g: GameState = boot();
/** Quantas entradas do log já foram reveladas na animação da rodada; null = nada animando (entrada liberada). */
let shown: number | null = null;

export const state = () => g;

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

export function dispatch(a: GameAction) {
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

export function render() {
  const s = g.screen;
  app.innerHTML =
    s.name === 'title' ? titleView(g)
    : s.name === 'create' ? createView(form)
    : s.name === 'combat' ? combatView(g, s.combat, shown)
    : s.name === 'camp' ? campView(g, s.npc, s.line, s.news)
    : s.name === 'scene' ? sceneView(g, s)
    : summaryView(s.summary);
  setTrack(trackFor(g));
  if (s.name === 'scene') {
    preloadScenes(s.queue);
    document.getElementById('next')?.focus({ preventScroll: true });
  }
}

/** Combate comum, chefe ou ambiente (menus, acampamento e resumo). */
export function trackFor(state: GameState): Track {
  if (state.screen.name === 'scene') return sceneTrack(state.screen.queue);
  if (state.screen.name !== 'combat' || !state.run) return 'menu';
  return isBossFight(state.run) ? 'boss' : 'battle';
}
