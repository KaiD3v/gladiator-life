// Trilha sonora: uma faixa em loop por contexto, com fade entre elas e botão de mudo. Só interface, nenhuma regra de jogo.
// Arquivos em public/audio/<faixa>.mp3, ambientes de cena em public/audio/amb/<nome>.mp3 e efeitos em public/audio/sfx/<efeito>.mp3; o mudo vale para todos. Se um arquivo faltar ou o navegador bloquear o áudio, o jogo segue em silêncio.

import type { Ambience, MusicTrack } from '../data';

export type Track = MusicTrack;
export type { Ambience };

const BASE = `${import.meta.env.BASE_URL}audio/`;
const VOLUME = 0.45;
const AMB_VOLUME = 0.2; // os loops de ambiente são mais altos que as músicas: ficam por baixo
const SFX_VOLUME = 0.7;
const FADE_MS = 700;
const MUTE_KEY = 'arena-dos-gladiadores:muted';

/** Um loop por vez com fade na troca: um canal para a música e outro para o ambiente das cenas, tocando juntos. */
interface Channel { dir: string; volume: number; current: string | null }
const music: Channel = { dir: '', volume: VOLUME, current: null };
const ambience: Channel = { dir: 'amb/', volume: AMB_VOLUME, current: null };

const players = new Map<string, HTMLAudioElement>();
const fades = new Map<HTMLAudioElement, number>();
let muted = readMuted();

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function player(path: string): HTMLAudioElement {
  let a = players.get(path);
  if (!a) {
    a = new Audio(`${BASE}${path}.mp3`);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    players.set(path, a);
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

function start(ch: Channel, restart: boolean) {
  const a = player(ch.dir + ch.current);
  if (restart) a.currentTime = 0;
  // play() rejeita antes do primeiro gesto do usuário (política de autoplay) ou sem arquivo: tenta de novo no próximo clique.
  a.play().then(() => fade(a, ch.volume)).catch(() => {});
}

function stop(ch: Channel) {
  if (!ch.current) return;
  const a = player(ch.dir + ch.current);
  fade(a, 0, () => a.pause());
}

/** Troca o loop do canal. Chamar a cada render: repetir o mesmo nome não reinicia nada. */
function switchTo(ch: Channel, name: string | null) {
  if (name === ch.current) {
    if (name && !muted && player(ch.dir + name).paused) start(ch, false);
    return;
  }
  stop(ch);
  ch.current = name;
  if (name && !muted) start(ch, true);
}

export const setTrack = (t: Track | null) => switchTo(music, t);
/** Som ambiente por baixo da música (só nas cenas); null silencia. */
export const setAmbience = (n: Ambience | null) => switchTo(ambience, n);

/** Escala o volume do ambiente (0..1) com fade; vale também para o próximo loop. Mudo continua mudo. */
export function setAmbienceLevel(k: number) {
  const v = AMB_VOLUME * Math.max(0, Math.min(1, k));
  if (Math.abs(v - ambience.volume) < 0.005) return;
  ambience.volume = v;
  if (ambience.current && !muted) {
    const a = player(ambience.dir + ambience.current);
    if (!a.paused) fade(a, v);
  }
}

export const isMuted = () => muted;

export function toggleMute(): boolean {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* preferência só nesta sessão */ }
  for (const ch of [music, ambience]) {
    if (!ch.current) continue;
    if (muted) stop(ch);
    else start(ch, false);
  }
  return muted;
}

/** Efeito curto, sem loop. Instâncias novas a cada chamada para poderem se sobrepor (o navegador cacheia o arquivo). */
export function playSfx(name: string) {
  if (muted) return;
  const a = new Audio(`${BASE}sfx/${name}.mp3`);
  a.volume = SFX_VOLUME;
  a.play().catch(() => {});
}
