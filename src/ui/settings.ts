// Engrenagem de opções (fora do #app: sobrevive aos re-renders) com janela de Música e Reiniciar campanha.
import { isMuted, toggleMute } from './audio';
import { esc } from './components';
import { dispatch, state } from './store';

/** Janela de opções aberta: os atalhos de teclado do jogo ficam desligados (ver `onKey` em events.ts). */
export const settingsOpen = () => dlg.open;

const dlg = document.createElement('dialog');
dlg.className = 'settings';
dlg.setAttribute('aria-labelledby', 'settings-title');
let confirming = false;

function paint() {
  const on = !isMuted();
  const hasRun = !!state().run;
  dlg.innerHTML = `<div class="sketch settings-box">
    <h2 id="settings-title">Opções</h2>
    ${confirming ? `
      <p>Abandonar a campanha de <b>${esc(state().run?.name ?? '')}</b>? Ela conta como derrota: o XP já ganho fica, o resto se perde.</p>
      <div class="modal-actions"><button data-s="cancel">Voltar</button><button class="primary danger" data-s="confirm">Reiniciar</button></div>`
    : `
      <button role="switch" aria-checked="${on}" data-s="music">Música e sons <span class="pill">${on ? 'Ligados' : 'Desligados'}</span></button>
      <button data-s="restart"${hasRun ? '' : ' disabled'}>Reiniciar campanha</button>
      ${hasRun ? '' : '<p class="dim">Nenhuma campanha em andamento.</p>'}
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
    confirming = false;
    paint();
    dlg.showModal();
  });

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) return dlg.close(); // toque no fundo escuro fecha
    const action = (e.target as Element).closest<HTMLButtonElement>('button[data-s]')?.dataset.s;
    if (action === 'music') toggleMute();
    else if (action === 'close') return dlg.close();
    else if (action === 'restart' || action === 'cancel') confirming = action === 'restart';
    else if (action === 'confirm') {
      const before = state();
      dispatch({ type: 'restart' });
      if (state() !== before) return dlg.close(); // ignorado se uma rodada ainda está animando: continua aberto
    } else return;
    paint();
  });

  document.body.append(btn, dlg);
}
