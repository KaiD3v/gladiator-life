import { ARENAS, CLASSES, HP_PER_LEVEL } from '../../data';
import { levelOf, xpForLevel, type GameState } from '../../state';
import { art, assetUrl, bar, esc } from '../components';

export function titleView(g: GameState): string {
  const { save } = g;
  const lvl = levelOf(save.xp);
  const into = save.xp - xpForLevel(lvl);
  const span = xpForLevel(lvl + 1) - xpForLevel(lvl);
  return `<section class="stack center">
    <div class="hero" style="background-image:url(${assetUrl('bg-title')})">
      <h1>Arena dos Gladiadores</h1>
      <div class="cast">${(['warrior', 'mage', 'assassin'] as const).map((id) => art(id, 'cast-sprite', CLASSES[id].name)).join('')}</div>
    </div>
    <p class="dim">Escolha sua classe, monte sua build e sobreviva até o chefe.</p>
    ${g.notice ? `<p class="sketch notice" role="alert">${esc(g.notice)}</p>` : ''}
    <div class="sketch" style="max-width:440px;margin:24px auto;text-align:left">
      <h3>Seu legado</h3>
      <p>Nível <b>${lvl}</b> <span class="dim">(+${HP_PER_LEVEL * (lvl - 1)} de vida inicial)</span></p>
      ${bar('xp', into, span, `${into}/${span} XP até o nível ${lvl + 1}`)}
      <p class="dim" style="margin-top:8px">Campanhas: ${save.runs} · Completas: ${save.wins} · Recorde: ${save.best}/${ARENAS.length} títulos</p>
    </div>
    <button class="primary" data-a="new">Nova campanha</button>
    <div class="sketch" style="max-width:600px;margin:28px auto 0;text-align:left">
      <h3>Como jogar</h3>
      <p>Cada rodada você escolhe <b>uma</b> ação; quem tem mais velocidade age primeiro, mas <b>Defender</b> sempre vem antes.
      Habilidades gastam energia e ficam mais fortes com o atributo ligado a elas (Força, Destreza ou Sabedoria).
      Entre as lutas, no acampamento, gaste ouro com itens, treino e descanso, mas cuidado: o chefe precisa cair antes do fim da temporada.
      Dá para fugir de uma luta numa disputa de Destreza. XP e arenas ficam salvos neste navegador.</p>
    </div>
  </section>`;
}
