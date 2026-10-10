import { ARENAS, CLASSES, ENEMIES, SKILLS } from '../../data';
import { arenaById, stageOf, type Summary } from '../../state';
import { art, attrLine, esc, itemLabel } from '../components';

export function summaryView(s: Summary): string {
  const r = s.run;
  const title = { victory: 'Vitória!', defeat: 'Derrota', draw: 'Queda mútua', timeout: 'Fim da temporada' }[s.result];
  const fought = r.kills.length + r.fled.length + (s.result === 'defeat' || s.result === 'draw' ? 1 : 0);
  const total = ARENAS.reduce((n, a) => n + a.fights + 1, 0);
  return `<section class="screen summary-screen center">
    ${art(s.result === 'victory' ? 'victory' : 'defeat', 'summary-art', '')}
    <h1 class="summary-title ${s.result === 'victory' ? 'win' : 'lose'}">${title}</h1>
    <div class="row centered">${art(r.classId, `portrait${s.result === 'victory' ? '' : ' fallen'}`, CLASSES[r.classId].name, r.classId)}<p class="hero-line">${esc(r.name)}, ${CLASSES[r.classId].name}<br><span class="dim">${s.result === 'victory'
      ? `conquistou todas as ${ARENAS.length} arenas!` : `caiu em ${arenaById(r.arenaId).name} (fase ${stageOf(r) + 1}/${ARENAS.length})`}</span></p></div>
    ${r.titles.length ? `<p class="sketch unlock">${r.titles.map((id) => `Campeão de <b>${arenaById(id).name}</b>`).join(' · ')}</p>` : ''}
    ${s.result !== 'victory' ? '<p class="dim">O próximo gladiador recomeça do Fosso de Areia. Só o XP (nível) é mantido.</p>' : ''}
    <div class="sketch report scroll">
      <dl class="kv">
        <dt>Lutas</dt><dd>${r.kills.length} vencidas de ${fought} disputadas (a campanha tem ${total})</dd>
        <dt>Derrotados</dt><dd>${r.kills.map((id) => ENEMIES[id].name).join(', ') || 'ninguém'}</dd>
        <dt>Dias</dt><dd>${r.daysSpent} no total${s.result === 'timeout' ? ` (o prazo de ${arenaById(r.arenaId).name} acabou antes do chefe cair)` : ''}</dd>
        <dt>Fugas</dt><dd>${r.fled.length}</dd>
        <dt>Rodadas</dt><dd>${r.rounds}</dd>
        <dt>Ouro ganho</dt><dd>${r.goldEarned}</dd>
        <dt>Atributos</dt><dd>${attrLine(r.attrs)}</dd>
        <dt>Habilidades</dt><dd>${r.skills.map((id) => SKILLS[id].name).join(', ')}</dd>
        <dt>Dano causado</dt><dd>${r.dealt}</dd>
        <dt>Dano recebido</dt><dd>${r.taken}</dd>
        <dt>Itens</dt><dd>${r.items.map(itemLabel).join(', ') || 'nenhum'}</dd>
        <dt>XP ganho</dt><dd class="gold-text">+${s.xpGained}</dd>
        <dt>Nível</dt><dd>${s.levelBefore}${s.levelAfter > s.levelBefore ? ` → <b class="gold-text">${s.levelAfter}</b> (subiu de nível!)` : ''}</dd>
      </dl>
    </div>
    <div class="row centered"><button data-a="title">Início</button><button class="primary" data-a="again">Nova campanha</button></div>
  </section>`;
}
