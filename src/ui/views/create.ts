import { ARENAS, CLASSES, ENEMIES, type ClassDef, type ClassId } from '../../data';
import { art, assetUrl, attrLine, esc, skillList, statLine } from '../components';

export interface CreateForm { name: string; classId: ClassId }

const classDetails = (c: ClassDef) => `<p class="attrs">${attrLine(c.attrs)}</p>
      <p class="statline">${statLine(c.stats)}</p>
      <p>${c.passive}</p>
      ${skillList(c.skills)}`;

export function createView(form: CreateForm): string {
  // Cada cartão traz os detalhes (vistos no desktop); no celular os cartões viram um seletor e os detalhes da classe
  // escolhida aparecem num painel único que rola por dentro.
  const classes = (Object.values(CLASSES)).map((c) => {
    const sel = c.id === form.classId;
    return `<button type="button" class="sketch choice${sel ? ' selected' : ''}" data-a="class" data-v="${c.id}" aria-pressed="${sel}">
      <div class="row">${art(c.id, 'portrait', c.name, c.id)}<div><b class="name">${c.name}</b><p class="dim tagline">${c.tagline}</p></div></div>
      <div class="choice-details">${classDetails(c)}</div>
    </button>`;
  }).join('');
  const picked = CLASSES[form.classId];
  const arenas = ARENAS.map((a, i) => `<div class="sketch arena-card"
      style="background-image:linear-gradient(90deg, rgba(20,18,14,.92) 45%, rgba(20,18,14,.35)), url(${assetUrl(`bg-${a.id}`)})">
      ${art(a.boss, 'arena-boss', ENEMIES[a.boss].name)}
      <span class="stage-no">Fase ${i + 1}</span>
      <b class="name">${a.name}</b>
      <p class="statline">${a.fights} lutas + chefe ${ENEMIES[a.boss].name} · prazo ${a.days} dias</p>
    </div>`).join('<span class="stage-arrow" aria-hidden="true">➜</span>');
  return `<form id="create" class="screen create-screen" autocomplete="off">
    <header class="topbar"><h2>Registro do ludus</h2></header>
    <p class="dim flavor">O escrivão do general molha a pena na tinta, sem levantar os olhos: “Nome? E como você luta?”</p>
    <label class="name-field">Nome do gladiador<br><input id="name" type="text" maxlength="16" required placeholder="Ex.: Spartacus" value="${esc(form.name)}"></label>
    <div class="class-pick" role="group" aria-label="Classe">${classes}</div>
    <div class="sketch class-detail scroll" aria-live="polite"><b class="name">${picked.name}</b>${classDetails(picked)}</div>
    <div class="campaign-wrap">
      <p class="dim small">Todo gladiador começa no Fosso. Vença o chefe para ser transferido para a próxima arena, levando sua build.
        Se cair, o próximo gladiador recomeça do zero.</p>
      <div class="campaign">${arenas}</div>
    </div>
    <div class="row footer"><button type="button" data-a="title">Voltar</button>
    <button type="submit" class="primary" id="start" ${form.name.trim() ? '' : 'disabled'}>Entrar na arena</button></div>
  </form>`;
}
