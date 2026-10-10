// Monta a interface: botão de som, eventos e primeiro render. Nenhuma regra de jogo aqui.
import { isMuted, setTrack, toggleMute } from './audio';
import { bindEvents } from './events';
import { render, state, trackFor } from './store';

// Botão de som (música e efeitos) fora do #app: sobrevive aos re-renders.
function mountMuteButton() {
  const btn = document.createElement('button');
  btn.className = 'mute';
  const paint = () => {
    btn.textContent = isMuted() ? '🔇 Som' : '🔊 Som';
    btn.setAttribute('aria-pressed', String(!isMuted()));
    btn.setAttribute('aria-label', isMuted() ? 'Ligar som' : 'Desligar som');
  };
  btn.addEventListener('click', () => { toggleMute(); paint(); });
  paint();
  document.body.append(btn);
}

mountMuteButton();
// O navegador só libera áudio após um gesto: o primeiro clique/tecla retoma a faixa atual.
for (const ev of ['pointerdown', 'keydown'] as const) document.addEventListener(ev, () => setTrack(trackFor(state())), { once: true });
bindEvents();
render();
