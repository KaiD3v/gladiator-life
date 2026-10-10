import { CLASSES, SCENES, SPEAKERS } from '../../data';
import type { GameState, ScreenOf } from '../../state';
import { art, assetUrl, esc } from '../components';

export function sceneView(g: GameState, s: ScreenOf<'scene'>): string {
  const sc = SCENES[s.queue[0]];
  const beat = sc.beats[s.beat];
  const bg = sc.beats.slice(0, s.beat + 1).reduce((cur, b) => b.bg ?? cur, sc.bg);
  // No epílogo a campanha já foi encerrada: o herói vem do resumo que espera depois da cena.
  const run = g.run ?? (s.next.name === 'summary' ? s.next.summary.run : null);
  const heroName = run ? esc(run.name) : 'Você';
  const fill = (t: string) => esc(t).replace(/\{nome\}/g, heroName).replace(/\{classe\}/g, run ? CLASSES[run.classId].name : '');
  const sp = SPEAKERS[beat.who];
  const narrator = beat.who === 'narrator';
  const name = beat.who === 'hero' ? heroName : sp.name;
  const portrait = beat.who === 'hero' ? run?.classId : sp.art;
  const total = s.queue.reduce((n, id) => n + SCENES[id].beats.length, 0) - s.beat - 1;
  return `<section class="stack scene-wrap">
    <div class="scene" style="background-image:url(${assetUrl(bg)})">
      <span class="scene-title">${sc.title}</span>
      ${portrait ? art(portrait, `scene-portrait ${sp.side}`, name) : ''}
    </div>
    <div class="sketch scene-box${narrator ? ' narration' : ''}" aria-live="polite">
      ${narrator ? '' : `<b class="speaker ${sp.side}">${name}</b>`}
      <p class="line">${narrator ? fill(beat.text) : `“${fill(beat.text)}”`}</p>
      <div class="row scene-controls">
        <span class="dim">${total > 0 ? `${total} fala(s) restante(s)` : 'Fim da cena'}</span>
        <button data-a="skip">Pular cenas</button>
        <button class="primary" data-a="next" id="next">Continuar ▸</button>
      </div>
    </div>
  </section>`;
}

/** Baixa fundos e retratos das cenas da fila antes de aparecerem (evita retrato surgindo atrasado). */
const preloaded = new Set<string>();
export function preloadScenes(queue: string[]) {
  for (const sc of queue.map((id) => SCENES[id])) {
    for (const name of [sc.bg, ...sc.beats.map((b) => b.bg ?? SPEAKERS[b.who].art)]) {
      if (!name || preloaded.has(name)) continue;
      preloaded.add(name);
      new Image().src = assetUrl(name);
    }
  }
}
