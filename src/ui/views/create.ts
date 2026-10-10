import { ARENAS, CLASSES, ENEMIES, SKILLS, type ClassId } from '../../data';
import { art, assetUrl, attrLine, attrTag, esc, statLine } from '../components';

export interface CreateForm { name: string; classId: ClassId }

export function createView(form: CreateForm): string {
  const classes = (Object.values(CLASSES)).map((c) => {
    const sel = c.id === form.classId;
    return `<button type="button" class="sketch choice${sel ? ' selected' : ''}" data-a="class" data-v="${c.id}" aria-pressed="${sel}">
      <div class="row">${art(c.id, 'portrait', c.name, c.id)}<div><b class="name">${c.name}</b><p class="dim">${c.tagline}</p></div></div>
      <p class="attrs">${attrLine(c.attrs)}</p>
      <p class="statline">${statLine(c.stats)}</p>
      <p>${c.passive}</p>
      <ul class="skill-list">${c.skills.map((id) => `<li>${attrTag(SKILLS[id].attr)} <b>${SKILLS[id].name}</b> (${SKILLS[id].cost} en.): ${SKILLS[id].desc}</li>`).join('')}</ul>
    </button>`;
  }).join('');
  const arenas = ARENAS.map((a, i) => `<div class="sketch arena-card"
      style="background-image:linear-gradient(90deg, rgba(20,18,14,.92) 45%, rgba(20,18,14,.35)), url(${assetUrl(`bg-${a.id}`)})">
      ${art(a.boss, 'arena-boss', ENEMIES[a.boss].name)}
      <span class="stage-no">Fase ${i + 1}</span>
      <b class="name">${a.name}</b>
      <p class="dim">${a.desc}</p>
      <p class="statline">${a.fights} lutas + chefe ${ENEMIES[a.boss].name} · prazo ${a.days} dias</p>
    </div>`).join('<span class="stage-arrow" aria-hidden="true">➜</span>');
  return `<form id="create" class="stack" autocomplete="off">
    <h2>Registro do ludus</h2>
    <p class="dim">O escrivão do general molha a pena na tinta, sem levantar os olhos: “Nome? E como você luta?”</p>
    <label>Nome do gladiador<br><input id="name" type="text" maxlength="16" required placeholder="Ex.: Spartacus" value="${esc(form.name)}"></label>
    <h3>Classe</h3><div class="grid">${classes}</div>
    <h3>Campanha</h3>
    <p class="dim">Todo gladiador começa no Fosso. Vença o chefe para virar campeão e ser transferido para a próxima arena, levando sua build.
      Se cair, o próximo gladiador recomeça do zero.</p>
    <div class="campaign">${arenas}</div>
    <div class="row"><button type="button" data-a="title">Voltar</button>
    <button type="submit" class="primary" id="start" ${form.name.trim() ? '' : 'disabled'}>Entrar na arena</button></div>
  </form>`;
}
