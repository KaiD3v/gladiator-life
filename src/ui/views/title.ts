import { ACTS, ARENAS, CLASSES, HP_PER_LEVEL } from '../../data';
import { levelOf, xpForLevel, type GameState } from '../../state';
import { actName, art, assetUrl, bar, esc } from '../components';

export function titleView(g: GameState): string {
  const { save } = g;
  const lvl = levelOf(save.xp);
  const into = save.xp - xpForLevel(lvl);
  const span = xpForLevel(lvl + 1) - xpForLevel(lvl);
  // História: o herói e os atos liberados (cada um recomeça do checkpoint de entrada). Continuar = o ato mais avançado.
  const story = save.story, hero = story[0], last = story.length - 1;
  const acts = story.length > 1
    ? `<div class="row centered acts">${story.map((_, i) => `<button data-a="story" data-v="${i}" title="${ACTS[i].name}">${actName(i)}</button>`).join('')}</div>` : '';
  const actions = hero
    ? `<button class="primary" data-a="story" data-v="${last}">Continuar · ${actName(last)}</button><button data-a="new">Novo gladiador</button>`
    : '<button class="primary" data-a="new">Nova campanha</button>';
  return `<section class="screen title-screen center">
    <div class="hero" style="background-image:url(${assetUrl('bg-title')})">
      <h1>Arena dos Gladiadores</h1>
      <div class="cast">${(['warrior', 'mage', 'assassin'] as const).map((id) => art(id, 'cast-sprite', CLASSES[id].name)).join('')}</div>
    </div>
    <p class="dim">Escolha sua classe, monte sua build e sobreviva até o chefe.</p>
    ${g.notice ? `<p class="sketch notice" role="alert">${esc(g.notice)}</p>` : ''}
    <div class="sketch legacy">
      <h3>Seu legado</h3>
      <p>Nível <b>${lvl}</b> <span class="dim">(+${HP_PER_LEVEL * (lvl - 1)} de vida inicial)</span></p>
      ${bar('xp', into, span, `${into}/${span} XP até o nível ${lvl + 1}`)}
      <p class="dim gap-top">Campanhas: ${save.runs} · Completas: ${save.wins} · Recorde: ${save.best}/${ARENAS.length} títulos</p>
      ${hero ? `<p class="gap-top">História de <b>${esc(hero.name)}</b>, ${CLASSES[hero.classId].name} <span class="dim">· ${story.length}/${ACTS.length} atos liberados</span></p>` : ''}
    </div>
    ${acts}
    <div class="row centered">${actions}</div>
    <details class="sketch howto">
      <summary>Como jogar</summary>
      <p>Cada rodada você escolhe <b>uma</b> ação; quem tem mais velocidade age primeiro, mas <b>Defender</b> sempre vem antes.
      Habilidades gastam energia e ficam mais fortes com o atributo ligado a elas (Força, Destreza ou Sabedoria).
      Entre as lutas, no acampamento, gaste ouro com itens, treino e descanso, mas cuidado: o chefe precisa cair antes do fim da temporada.
      Dá para fugir de uma luta numa disputa de Destreza. XP e arenas ficam salvos neste navegador.</p>
    </details>
  </section>`;
}
