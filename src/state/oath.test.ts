import { describe, expect, it } from 'vitest';
import { ACTS, NPCS } from '../data';
import { campOf, defaultSave, initialState, npcOf, parseResume, parseSave, reduce, resumeSnapshot, type GameState } from '.';

const skip = (g: GameState) => reduce(g, { type: 'skip' });
const start = () =>
  skip(reduce(skip(reduce(initialState(defaultSave()), { type: 'newGame' })), { type: 'startRun', name: 'Ana', classId: 'warrior', seed: 5 }));

/** Do acampamento: entra na luta atual, força o resultado (e o veredito) e devolve a fila de cenas que tocou depois. */
function fightAs(g: GameState, verdict?: 'spared' | 'executed') {
  g = skip(reduce(g, { type: 'fight' }));
  if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
  const after = reduce({ ...g, screen: { name: 'combat', combat: { ...g.screen.combat, outcome: 'victory', verdict } } }, { type: 'continue' });
  return { g: skip(after), scenes: after.screen.name === 'scene' ? after.screen.queue : [] };
}

/** Vence todo o Ato I e chega ao acampamento do Ato II. */
function toAct2(): GameState {
  let g = start();
  for (const a of ACTS[0].arenas) for (let i = 0; i <= a.fights; i++) g = fightAs(g).g;
  return g;
}

describe('Ato II: O Juramento', () => {
  it('fim do Ato I: epílogo, abertura do Ato II e o acampamento novo da Subura', () => {
    let g = start();
    for (const a of ACTS[0].arenas) for (let i = 0; i < a.fights; i++) g = fightAs(g).g;
    for (let i = 0; i < 2; i++) g = fightAs(g).g; // Tauros e Serpente
    const last = fightAs(g);
    expect(last.scenes).toEqual(['boss-defeat-emperor', 'epilogue', 'act2-opening']);
    g = last.g;
    expect(g.run!.arenaId).toBe('naumachia');
    expect(g.screen.name === 'camp' && g.screen.news).toContain('Ato II: O Juramento');
    expect(campOf(g.run!).npcs).toEqual(['sabina', 'tauros', 'lyra', 'oren', 'marta']);
    expect(campOf(start().run!).npcs).toEqual(['cassio', 'brutus', 'lyra', 'oren', 'marta']);
    expect(npcOf('sabina')).toMatchObject({ name: 'Sabina', art: 'npc-sabina', services: [{ kind: 'shop' }, { kind: 'bookie' }] });
    expect(npcOf('tauros')).toMatchObject({ name: 'Tauros', art: 'npc-tauros', services: [{ kind: 'trainer', attr: 'str' }] });
    const talk = reduce(g, { type: 'talk', npc: 'sabina' }).screen;
    if (talk.name !== 'camp') throw new Error('saiu do acampamento');
    expect(NPCS.sabina.lines.greet).toContain(talk.line); // sem veredito na run: só falas sem condição
    // Quem não está no acampamento do ato não atende
    expect(reduce(g, { type: 'talk', npc: 'cassio' })).toBe(g);
    expect(reduce(g, { type: 'service', npc: 'cassio', value: g.run!.shop[0] })).toBe(g);
    expect(reduce(g, { type: 'service', npc: 'sabina', value: g.run!.shop[0] }).screen).toMatchObject({ npc: 'sabina' });
  });

  it('recomeçar o Ato II volta à abertura do ato (cenas) antes do acampamento', () => {
    const g = fightAs(toAct2()).g; // uma luta no Ato II
    const r = reduce(g, { type: 'restartAct', seed: 3 });
    expect(r.screen).toMatchObject({ name: 'scene', queue: ['act2-opening'], beat: 0, next: { name: 'camp' } });
    expect(skip(r).run).toMatchObject({ arenaId: 'naumachia', encounter: 0, day: 1 });
  });

  it('poupar Nerissa fica na run e no checkpoint seguinte, e toca a cena da clemência', () => {
    let g = toAct2();
    expect(g.save.story).toHaveLength(2);
    for (let i = 0; i < ACTS[1].arenas[0].fights; i++) g = fightAs(g).g;
    const spared = fightAs(g, 'spared');
    expect(spared.scenes).toEqual(['boss-spared-nerissa', 'transfer-venatio']);
    expect(spared.g.run!.verdicts).toEqual({ nerissa: 'spared' });
    const killed = fightAs(g);
    expect(killed.scenes).toEqual(['boss-executed-nerissa', 'transfer-venatio']);
    expect(killed.g.run!.verdicts).toEqual({ nerissa: 'executed' });
  });

  it('falas condicionais: depois de poupar Nerissa os NPCs comentam a clemência, nunca a execução', () => {
    let g = toAct2();
    for (let i = 0; i < ACTS[1].arenas[0].fights; i++) g = fightAs(g).g;
    g = fightAs(g, 'spared').g;
    const texts = (verdict: 'spared' | 'executed') => NPCS.sabina.lines.greet.flatMap((l) => (typeof l !== 'string' && l.when.verdict === verdict ? [l.text] : []));
    const heard = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const s = reduce(g, { type: 'talk', npc: 'sabina' });
      if (s.screen.name === 'camp') heard.add(s.screen.line);
      g = { ...g, run: s.run }; // a semente avança: outra fala na próxima conversa
    }
    expect(texts('spared').some((t) => heard.has(t))).toBe(true);
    expect(texts('executed').some((t) => heard.has(t))).toBe(false);
  });

  it('snapshot com conversa no formato antigo (por papel) volta com a conversa fechada', () => {
    const g = toAct2();
    const snap = JSON.parse(resumeSnapshot(g)!);
    const r = parseResume(JSON.stringify({ ...snap, screen: { ...snap.screen, npc: 'merchant', line: 'oi' } }));
    expect(r.error).toBeUndefined();
    expect(r.resume!.screen).toMatchObject({ name: 'camp', npc: null, line: '' });
  });

  it('run e história gravadas antes do veredito em chefe migram com verdicts vazio', () => {
    const g = toAct2();
    const { verdicts: _, ...old } = g.run!;
    const resume = parseResume(JSON.stringify({ ...JSON.parse(resumeSnapshot(g)!), run: old }));
    expect(resume.error).toBeUndefined();
    expect(resume.resume!.run.verdicts).toEqual({});
    const save = parseSave(JSON.stringify({ ...g.save, story: g.save.story.map(({ verdicts: _v, ...r }) => r) }));
    expect(save.error).toBeUndefined();
    expect(save.save.story.every((r) => r.verdicts && !Object.keys(r.verdicts).length)).toBe(true);
  });
});
