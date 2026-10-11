// Monta a interface: botão de som, eventos e primeiro render. Nenhuma regra de jogo aqui.
import { isMuted, setAmbience, setTrack, toggleMute } from './audio';
import { bindEvents } from './events';
import { ambienceFor, render, state, trackFor } from './store';

// Botão de som (música e efeitos) fora do #app: sobrevive aos re-renders.
function mountMuteButton() {
  const btn = document.createElement('button');
  btn.className = 'mute';
  const paint = () => {
    btn.textContent = isMuted() ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(!isMuted()));
    btn.setAttribute('aria-label', isMuted() ? 'Ligar som' : 'Desligar som');
  };
  btn.addEventListener('click', () => { toggleMute(); paint(); });
  paint();
  document.body.append(btn);
}

mountMuteButton();
// O navegador só libera áudio após um gesto: o primeiro clique/tecla retoma a faixa e o ambiente atuais.
for (const ev of ['pointerdown', 'keydown'] as const) {
  document.addEventListener(ev, () => { setTrack(trackFor(state())); setAmbience(ambienceFor(state())); }, { once: true });
}
// Alguns navegadores móveis não suportam dvh (ou o atualizam tarde) e caem para 100vh, que passa por baixo da barra do
// navegador. innerHeight é a altura visível de verdade: vira --app-h, usada pelo #app.
const syncAppHeight = () => document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.addEventListener('orientationchange', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);
bindEvents();
render();
