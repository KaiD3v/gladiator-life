// Engrenagem de opções (fora do #app: sobrevive aos re-renders) com Música, Recomeçar o ato e Escolher ato.
import { isMuted, toggleMute } from './audio';
import { actOf } from '../state';
import { actName, esc } from './components';
import { dispatch, state } from './store';

/** Janela de opções aberta: os atalhos de teclado do jogo ficam desligados (ver `onKey` em events.ts). */
export const settingsOpen = () => dlg.open;

const dlg = document.createElement('dialog');
dlg.className = 'settings';
dlg.setAttribute('aria-labelledby', 'settings-title');
/** Ação de campanha aguardando confirmação (as duas abandonam a run atual). */
let confirming: 'act' | 'title' | null = null;

function paint() {
  const on = !isMuted();
  const g = state(), run = g.run;
  const act = run ? actOf(run.arenaId) : -1;
  const canRestart = !!g.save.story[act];
  const lost = 'A campanha atual conta como derrota: o XP já ganho fica.';
  dlg.innerHTML = `<div class="sketch settings-box">
    <h2 id="settings-title">Opções</h2>
    ${confirming ? `
      <p>${confirming === 'act'
        ? `Recomeçar o <b>${actName(act)}</b>? ${lost} Você volta ao início do ato com a build de quando entrou nele.`
        : `Voltar à escolha de atos? ${lost} Os atos liberados de <b>${esc(run?.name ?? '')}</b> continuam disponíveis no início.`}</p>
      <div class="modal-actions"><button data-s="cancel">Voltar</button><button class="primary danger" data-s="confirm">${confirming === 'act' ? 'Recomeçar' : 'Sair da campanha'}</button></div>`
    : `
      <button role="switch" aria-checked="${on}" data-s="music">Música e sons <span class="pill">${on ? 'Ligados' : 'Desligados'}</span></button>
      <button data-s="act"${canRestart ? '' : ' disabled'}>Recomeçar ${run && act >= 0 ? `o ${actName(act)}` : 'o ato'}</button>
      <button data-s="title"${run ? '' : ' disabled'}>Escolher ato</button>
      ${run ? '' : '<p class="dim">Nenhuma campanha em andamento.</p>'}
      <button class="primary" data-s="close">Fechar</button>`}
  </div>`;
  dlg.querySelector<HTMLElement>(confirming ? '[data-s="cancel"]' : '[data-s]')?.focus();
}

export function mountSettings() {
  const btn = document.createElement('button');
  btn.className = 'settings-btn';
  btn.textContent = '⚙️';
  btn.setAttribute('aria-label', 'Opções');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.addEventListener('click', () => {
    confirming = null;
    paint();
    dlg.showModal();
  });

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) return dlg.close(); // toque no fundo escuro fecha
    const action = (e.target as Element).closest<HTMLButtonElement>('button[data-s]')?.dataset.s;
    if (action === 'music') toggleMute();
    else if (action === 'close') return dlg.close();
    else if (action === 'act' || action === 'title') confirming = action;
    else if (action === 'cancel') confirming = null;
    else if (action === 'confirm' && confirming) {
      const before = state();
      dispatch(confirming === 'act' ? { type: 'restartAct', seed: (Math.random() * 2 ** 32) | 0 } : { type: 'abandon' });
      if (state() !== before) return dlg.close(); // ignorado se uma rodada ainda está animando: continua aberto
    } else return;
    paint();
  });

  document.body.append(btn, dlg);
}
