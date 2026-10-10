import { beatView, sceneAssets } from '../../engine/scenes';
import type { GameState, ScreenOf } from '../../state';
import { art, assetUrl, esc } from '../components';

export { sceneAmbience, sceneTrack } from '../../engine/scenes';

export function sceneView(g: GameState, s: ScreenOf<'scene'>): string {
  // No epílogo a campanha já foi encerrada: o herói vem do resumo que espera depois da cena.
  const run = g.run ?? (s.next.name === 'summary' ? s.next.summary.run : null);
  const v = beatView(s.queue, s.beat, run);
  const name = esc(v.speaker);
  const text = esc(v.text);
  return `<section class="screen scene-wrap">
    <div class="scene" style="background-image:url(${assetUrl(v.bg)})">
      <span class="scene-title">${v.title}</span>
      ${v.portrait ? art(v.portrait, `scene-portrait ${v.side}`, name) : ''}
    </div>
    <div class="sketch scene-box${v.narrator ? ' narration' : ''}" aria-live="polite">
      ${v.narrator ? '' : `<b class="speaker ${v.side}">${name}</b>`}
      <p class="line">${v.narrator ? text : `“${text}”`}</p>
      <div class="row scene-controls">
        <span class="dim">${v.remaining > 0 ? `${v.remaining} fala(s) restante(s)` : 'Fim da cena'}</span>
        <button data-a="skip">Pular cenas</button>
        <button class="primary" data-a="next" id="next">Continuar ▸</button>
      </div>
    </div>
  </section>`;
}

/** Baixa fundos e retratos das cenas da fila antes de aparecerem (evita retrato surgindo atrasado). */
const preloaded = new Set<string>();
export function preloadScenes(queue: string[]) {
  for (const name of sceneAssets(queue)) {
    if (preloaded.has(name)) continue;
    preloaded.add(name);
    new Image().src = assetUrl(name);
  }
}
