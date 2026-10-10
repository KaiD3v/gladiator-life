// Trilha sonora: uma faixa em loop por contexto, com fade entre elas e botão de mudo. Só interface, nenhuma regra de jogo.
// Arquivos em public/audio/<faixa>.mp3 e efeitos em public/audio/sfx/<efeito>.mp3; o mudo vale para os dois. Se um arquivo faltar ou o navegador bloquear o áudio, o jogo segue em silêncio.

export type Track = 'menu' | 'battle' | 'boss';

const BASE = `${import.meta.env.BASE_URL}audio/`;
const VOLUME = 0.45;
const SFX_VOLUME = 0.7;
const FADE_MS = 700;
const MUTE_KEY = 'arena-dos-gladiadores:muted';

const players = new Map<Track, HTMLAudioElement>();
const fades = new Map<HTMLAudioElement, number>();
let current: Track | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function player(t: Track): HTMLAudioElement {
  let a = players.get(t);
  if (!a) {
    a = new Audio(`${BASE}${t}.mp3`);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    players.set(t, a);
  }
  return a;
}

function fade(a: HTMLAudioElement, to: number, done?: () => void) {
  clearInterval(fades.get(a));
  const from = a.volume;
  const start = performance.now();
  fades.set(a, window.setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / FADE_MS);
    a.volume = from + (to - from) * k;
    if (k === 1) {
      clearInterval(fades.get(a));
      done?.();
    }
  }, 40));
}

function start(t: Track, restart: boolean) {
  const a = player(t);
  if (restart) a.currentTime = 0;
  // play() rejeita antes do primeiro gesto do usuário (política de autoplay) ou sem arquivo: tenta de novo no próximo clique.
  a.play().then(() => fade(a, VOLUME)).catch(() => {});
}

/** Troca a faixa tocando. Chamar a cada render: repetir a mesma faixa não reinicia nada. */
export function setTrack(t: Track | null) {
  if (t === current) {
    if (t && !muted && player(t).paused) start(t, false);
    return;
  }
  const old = current;
  current = t;
  if (old) {
    const a = player(old);
    fade(a, 0, () => a.pause());
  }
  if (t && !muted) start(t, true);
}

export const isMuted = () => muted;

export function toggleMute(): boolean {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* preferência só nesta sessão */ }
  if (!current) return muted;
  const a = player(current);
  if (muted) fade(a, 0, () => a.pause());
  else start(current, false);
  return muted;
}

/** Efeito curto, sem loop. Instâncias novas a cada chamada para poderem se sobrepor (o navegador cacheia o arquivo). */
export function playSfx(name: string) {
  if (muted) return;
  const a = new Audio(`${BASE}sfx/${name}.mp3`);
  a.volume = SFX_VOLUME;
  a.play().catch(() => {});
}
