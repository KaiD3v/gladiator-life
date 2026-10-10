// Estado da página: jogo (`g`), formulário de criação, persistência, animação do log e render.
import { playSfx, setAmbience, setAmbienceLevel, setTrack, type Ambience, type Track } from './audio';
import { SAVE_KEY, initialState, isBossFight, parseSave, reduce, type GameAction, type GameState, type SaveData } from '../state';
import { titleView } from './views/title';
import { createView, type CreateForm } from './views/create';
import { combatView, type TrayPage } from './views/combat';
import { campView } from './views/camp';
import { summaryView } from './views/summary';
import { preloadScenes, sceneAmbience, sceneTrack, sceneView } from './views/scene';

export const app = document.getElementById('app')!;
export const form: CreateForm = { name: '', classId: 'warrior' };
/** Página da bandeja de ações no celular (só interface; volta para as habilidades a cada luta nova). */
export const ui: { tray: TrayPage } = { tray: 'skills' };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP_MS = REDUCED ? 120 : 520;
const CRIT_EXTRA_MS = REDUCED ? 0 : 250; // pausa no golpe crítico (hit-stop)

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
  if (g.screen.name === 'combat' && prev.screen.name !== 'combat') ui.tray = 'skills';
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
    const e = g.screen.combat.log[shown!++];
    if (e.sfx) playSfx(e.sfx);
    if (e.crit && e.kind === 'player') playSfx('crowd-gasp');
    render();
    setTimeout(step, STEP_MS + (e.crit ? CRIT_EXTRA_MS : 0));
  };
  step();
}

export function render() {
  const s = g.screen;
  app.innerHTML =
    s.name === 'title' ? titleView(g)
    : s.name === 'create' ? createView(form)
    : s.name === 'combat' ? combatView(g, s.combat, shown, ui.tray)
    : s.name === 'camp' ? campView(g, s.npc, s.line, s.news)
    : s.name === 'scene' ? sceneView(g, s)
    : summaryView(s.summary);
  setTrack(trackFor(g));
  setAmbience(ambienceFor(g));
  const log = s.name === 'combat' ? s.combat.log : null;
  setAmbienceLevel(log ? 0.35 + 0.65 * (log[Math.max(0, (shown ?? log.length) - 1)].crowd / 100) : 1);
  if (s.name === 'scene') {
    preloadScenes(s.queue);
    document.getElementById('next')?.focus({ preventScroll: true });
  }
}

/** Ambiente: cenas têm o seu; no combate, a torcida (volume segue o favor); fora disso, silêncio. */
export const ambienceFor = (state: GameState): Ambience | null =>
  state.screen.name === 'scene' ? sceneAmbience(state.screen.queue, state.screen.beat) : state.screen.name === 'combat' ? 'arena-crowd' : null;

/** Combate comum, chefe ou ambiente (menus, acampamento e resumo). */
export function trackFor(state: GameState): Track {
  if (state.screen.name === 'scene') return sceneTrack(state.screen.queue);
  if (state.screen.name === 'create') return 'first-scene'; // o registro fica entre as duas cenas do prólogo: a música continua
  if (state.screen.name !== 'combat' || !state.run) return 'menu';
  return isBossFight(state.run) ? 'boss' : 'battle';
}
