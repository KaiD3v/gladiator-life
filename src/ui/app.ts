// Interface: estado da página, despacho de ações, render e eventos. Nenhuma regra de jogo aqui.
import { isMuted, playSfx, setTrack, toggleMute, type Track } from './audio';
import { type Attr, type ClassId, type NpcId } from '../data';
import { actionsFor } from '../engine/combat';
import { SAVE_KEY, initialState, isBossFight, parseSave, reduce, type GameAction, type GameState, type SaveData } from '../state';
import { icon } from './components';
import { titleView } from './views/title';
import { createView, type CreateForm } from './views/create';
import { combatView } from './views/combat';
import { campView } from './views/camp';
import { summaryView } from './views/summary';
import { preloadScenes, sceneTrack, sceneView } from './views/scene';

const app = document.getElementById('app')!;
const form: CreateForm = { name: '', classId: 'warrior' };
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

function render() {
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
function trackFor(state: GameState): Track {
  if (state.screen.name === 'scene') return sceneTrack(state.screen.queue);
  if (state.screen.name !== 'combat' || !state.run) return 'menu';
  return isBossFight(state.run) ? 'boss' : 'battle';
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
