// Monta a interface: engrenagem de opções, eventos e primeiro render. Nenhuma regra de jogo aqui.
import { setAmbience, setTrack } from './audio';
import { bindEvents } from './events';
import { mountSettings } from './settings';
import { ambienceFor, firstRender, state, trackFor } from './store';

mountSettings();
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
firstRender();
