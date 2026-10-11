// Estado da página: jogo (`g`), formulário de criação, persistência, animação do log e render.
import { playSfx, setAmbience, setAmbienceLevel, setTrack, type Ambience, type Track } from './audio';
import { SAVE_KEY, initialState, isBossFight, parseSave, reduce, type GameAction, type GameState, type RunState, type SaveData } from '../state';
import { ATTRS } from './components';
import { titleView } from './views/title';
import { createView, type CreateForm } from './views/create';
import { combatView, type TrayPage } from './views/combat';
import { campView } from './views/camp';
import { summaryView } from './views/summary';
import { preloadScenes, sceneAmbience, sceneTrack, sceneView } from './views/scene';

export const app = document.getElementById('app')!;
export const form: CreateForm = { name: '', classId: 'warrior' };
/**
 * Estado só da interface: página da bandeja no celular (volta para as habilidades a cada luta nova), painel da bolsa
 * aberto no acampamento e a escolha dos itens caídos no fim da luta (null = escolha padrão).
 */
export const ui: { tray: TrayPage; bag: boolean; keep: number[] | null } = { tray: 'skills', bag: false, keep: null };
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
  if (g.screen.name !== prev.screen.name) {
    scrollTo(0, 0);
    ui.bag = false;
  }
  if (g.screen.name === 'combat' && prev.screen.name !== 'combat') Object.assign(ui, { tray: 'skills', keep: null });
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

/** Run do render anterior: no acampamento, o que mudou (ouro, vida, atributo, bolsa) pisca para o jogador notar. */
let lastRun: RunState | null = null;

/**
 * Botão focado antes do render, para devolver o foco depois (o innerHTML recria a tela inteira). Se o foco caiu no body
 * (o botão ficou desabilitado durante a animação da rodada), tenta de novo o último alvo.
 */
let lastFocus: string | null = null;
function focusedButton(): string | null {
  if (document.activeElement === document.body) return lastFocus;
  const el = document.activeElement;
  if (!(el instanceof HTMLButtonElement) || !app.contains(el) || !el.dataset.a) return null;
  return `button[data-a="${CSS.escape(el.dataset.a)}"]${el.dataset.v !== undefined ? `[data-v="${CSS.escape(el.dataset.v)}"]` : ''}`;
}

function flashChanges(run: RunState, before: RunState) {
  const flash = (sel: string) => app.querySelector(sel)?.classList.add('flash');
  if (run.gold !== before.gold) flash('.topbar .pill.gold');
  if (run.hp !== before.hp) flash('.camp-screen > .bar.hp');
  if (run.bag.length !== before.bag.length) flash('.bag-btn');
  for (const a of ATTRS) if (run.attrs[a] !== before.attrs[a]) flash(`.attr-row.${a}`);
}

export function render() {
  const s = g.screen;
  const focus = focusedButton();
  app.innerHTML =
    s.name === 'title' ? titleView(g)
    : s.name === 'create' ? createView(form)
    : s.name === 'combat' ? combatView(g, s.combat, shown, ui.tray, ui.keep)
    : s.name === 'camp' ? campView(g, s.npc, s.line, s.news, s.loot, ui.bag)
    : s.name === 'scene' ? sceneView(g, s)
    : summaryView(s.summary);
  if (focus) app.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  lastFocus = focus;
  // Janela de itens caídos: o foco entra nela (quem usa teclado não fica preso atrás do fundo escuro)
  const modal = app.querySelector('.modal');
  if (modal && !modal.contains(document.activeElement)) modal.querySelector<HTMLElement>('.primary')?.focus({ preventScroll: true });
  if (s.name === 'camp' && g.run && lastRun && g.run !== lastRun) flashChanges(g.run, lastRun);
  lastRun = g.run;
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
