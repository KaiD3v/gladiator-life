// Motor de cenas (puro): decide quais cenas tocam em cada evento e resolve cada fala para a UI.
import { CLASSES, SCENES, SPEAKERS, type ClassId, type SceneEvent } from '../data';

/** Gatilho e evento são o mesmo: mesmos campos com os mesmos valores (a ordem das chaves não importa). */
export function sameEvent(a: SceneEvent, b: SceneEvent): boolean {
  const ka = Object.keys(a) as (keyof SceneEvent)[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/** Cenas que casam com o evento, na ordem dos dados; cenas `once` já vistas ficam de fora. */
export function scenesFor(event: SceneEvent, seen: readonly string[] = []): string[] {
  return Object.values(SCENES)
    .filter((s) => sameEvent(s.trigger, event) && !(s.once && seen.includes(s.id)))
    .map((s) => s.id);
}

export interface Hero { name: string; classId: ClassId }

export interface BeatView {
  title: string;
  bg: string;
  speaker: string;
  portrait?: string;
  side: 'left' | 'right';
  narrator: boolean;
  text: string; // {nome}/{classe} resolvidos; sem escape de HTML
  remaining: number; // falas que ainda faltam na fila, depois desta
}

/** Fala `beat` da primeira cena da fila, pronta para exibir. Sem herói (ainda) o nome é "Você". */
export function beatView(queue: string[], beat: number, hero: Hero | null): BeatView {
  const sc = SCENES[queue[0]];
  const b = sc.beats[beat];
  const sp = SPEAKERS[b.who];
  const name = hero?.name ?? 'Você';
  const fill = (t: string) => t.replace(/\{nome\}/g, () => name).replace(/\{classe\}/g, () => (hero ? CLASSES[hero.classId].name : ''));
  return {
    title: sc.title,
    bg: sc.beats.slice(0, beat + 1).reduce((cur, x) => x.bg ?? cur, sc.bg),
    speaker: b.who === 'hero' ? name : sp.name,
    portrait: b.who === 'hero' ? hero?.classId : sp.art,
    side: sp.side,
    narrator: b.who === 'narrator',
    text: fill(b.text),
    remaining: queue.reduce((n, id) => n + SCENES[id].beats.length, 0) - beat - 1,
  };
}

/** Fundos e retratos das cenas da fila, sem repetição (o retrato do herói depende da classe e fica de fora). */
export function sceneAssets(queue: string[]): string[] {
  const names = queue.flatMap((id) => [SCENES[id].bg, ...SCENES[id].beats.map((b) => b.bg ?? SPEAKERS[b.who].art)]);
  return [...new Set(names.filter((n): n is string => !!n))];
}

/** Faixa de música da cena atual da fila. */
export const sceneTrack = (queue: string[]) => SCENES[queue[0]].music ?? 'menu';
