import { describe, expect, it } from 'vitest';
import { ARENAS, CLASSES, ENEMIES, ITEMS, MAX_SKILLS, NPCS, REST_FREE, REST_PAID, SKILLS, START_GOLD } from './data';
import {
  defaultSave, freeDays, initialState, learnBlock, levelOf, maxHp, parseSave, playerBuild, reduce, restPrice, trainPrice,
  type GameState, type RunState,
} from './run';

/** Pula a fila de cenas de história, se houver. */
const skip = (g: GameState) => reduce(g, { type: 'skip' });

const start = (classId: 'warrior' | 'mage' | 'assassin' = 'warrior', g = initialState(defaultSave())) =>
  skip(reduce(skip(reduce(g, { type: 'newGame' })), { type: 'startRun', name: '  Spartacus ', classId, seed: 42 }));

const withRun = (g: GameState, patch: Partial<RunState>): GameState => ({ ...g, run: { ...g.run!, ...patch } });

/** Do acampamento: entra na arena, força o resultado e volta (ou encerra a run). */
function fightAs(g: GameState, outcome: 'victory' | 'defeat' | 'draw' | 'fled'): GameState {
  g = skip(reduce(g, { type: 'fight' }));
  if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
  return skip(reduce({ ...g, screen: { name: 'combat', combat: { ...g.screen.combat, outcome } } }, { type: 'continue' }));
}

describe('save', () => {
  it('sem save usa o padrão sem erro', () => {
    expect(parseSave(null)).toEqual({ save: defaultSave() });
  });

  it.each(['{lixo', '42', 'null', '{"version":3,"xp":0,"runs":0,"wins":0,"best":0}',
    '{"version":2,"xp":-5,"runs":0,"wins":0,"best":0}',
    '{"version":2,"xp":10,"runs":0,"wins":0,"best":9}',
    '{"version":2,"xp":"10","runs":0,"wins":0,"best":0}',
    '{"version":1,"xp":-1,"unlocked":["pit"],"runs":0,"wins":0}'])('save inválido %s volta ao padrão com aviso', (raw) => {
    const r = parseSave(raw);
    expect(r.save).toEqual(defaultSave());
    expect(r.error).toBeTruthy();
  });

  it('save válido é preservado', () => {
    const save = { version: 2, xp: 250, runs: 3, wins: 1, best: 2 };
    expect(parseSave(JSON.stringify(save))).toEqual({ save });
  });

  it('save v1 (arenas desbloqueáveis) migra mantendo XP e runs', () => {
    const r = parseSave(JSON.stringify({ version: 1, xp: 250, unlocked: ['pit', 'colosseum'], runs: 3, wins: 2 }));
    expect(r.error).toBeUndefined();
    expect(r.save).toEqual({ version: 2, xp: 250, runs: 3, wins: 0, best: 1 });
  });
});

describe('transições', () => {
  it('ações fora da tela correta são ignoradas', () => {
    const g = initialState(defaultSave());
    for (const a of [{ type: 'act', action: 'attack' }, { type: 'continue' }, { type: 'fight' }, { type: 'rest' },
      { type: 'buy', itemId: 'chippedSword' }, { type: 'train', attr: 'str' }] as const) {
      expect(reduce(g, a)).toBe(g);
    }
    const fighting = reduce(start(), { type: 'fight' });
    expect(reduce(fighting, { type: 'continue' })).toBe(fighting); // combate ainda não acabou
    expect(reduce(fighting, { type: 'rest' })).toBe(fighting); // não se descansa no meio da luta
  });

  it('não inicia run com nome vazio', () => {
    const create = skip(reduce(initialState(defaultSave()), { type: 'newGame' }));
    expect(reduce(create, { type: 'startRun', name: '   ', classId: 'mage', seed: 1 })).toBe(create);
  });

  it('a run começa no acampamento com atributos, habilidades, ouro e loja da classe', () => {
    const g = start('mage');
    expect(g.screen.name).toBe('camp');
    const run = g.run!;
    expect(run.name).toBe('Spartacus');
    expect(run.attrs).toEqual(CLASSES.mage.attrs);
    expect(run.skills).toEqual(CLASSES.mage.skills);
    expect(run).toMatchObject({ gold: START_GOLD, day: 1, encounter: 0 });
    expect(run.shop).toHaveLength(4);
    expect(run.enemies.at(-1)).toBe('tauros');
  });
});

describe('run completa, dias e fuga', () => {
  it('campeão é transferido para a próxima arena levando a build; vencer a última completa a campanha', () => {
    let g = start();
    for (let i = 0; i < 3; i++) {
      g = fightAs(g, 'victory');
      expect(g.screen.name).toBe('camp');
      expect(g.run!.day).toBe(i + 2);
    }
    expect(g.run!.gold).toBe(START_GOLD + g.run!.kills.reduce((n, id) => n + ENEMIES[id].gold, 0));
    // Build montada antes de virar campeão
    g = withRun(g, { items: ['chippedSword'], attrs: { str: 9, dex: 3, wis: 2 }, skills: ['shieldBash', 'ironStance', 'warCry'], hp: 20 });
    g = fightAs(g, 'victory'); // chefe do Fosso
    expect(g.screen.name).toBe('camp');
    const run = g.run!;
    expect(run).toMatchObject({ arenaId: 'colosseum', titles: ['pit'], encounter: 0, day: 1, items: ['chippedSword'], skills: ['shieldBash', 'ironStance', 'warCry'] });
    expect(run.attrs.str).toBe(9);
    expect(run.hp).toBe(maxHp(run)); // chega curado
    expect(run.enemies.at(-1)).toBe('serpent');
    expect(g.screen.name === 'camp' && g.screen.news).toContain('Campeão de Fosso de Areia');
    expect(g.save.runs).toBe(0); // a campanha continua: nada gravado ainda

    for (const arena of ARENAS.slice(1)) {
      expect(g.run!.arenaId).toBe(arena.id);
      for (let i = 0; i <= arena.fights; i++) g = fightAs(g, 'victory');
    }
    if (g.screen.name !== 'summary') throw new Error();
    expect(g.screen.summary.result).toBe('victory');
    expect(g.screen.summary.run.titles).toEqual(['pit', 'colosseum', 'crimson']);
    expect(g.save).toMatchObject({ runs: 1, wins: 1, best: 3 });
    expect(g.save.xp).toBe(g.screen.summary.xpGained);
    expect(parseSave(JSON.stringify(g.save)).save).toEqual(g.save);
  });

  it('morrer na arena 2 encerra a campanha; o próximo gladiador recomeça da arena 1', () => {
    let g = start();
    for (let i = 0; i < 4; i++) g = fightAs(g, 'victory');
    expect(g.run!.arenaId).toBe('colosseum');
    g = fightAs(g, 'defeat');
    if (g.screen.name !== 'summary') throw new Error();
    expect(g.screen.summary.result).toBe('defeat');
    expect(g.save).toMatchObject({ runs: 1, wins: 0, best: 1 });
    const next = start('mage', reduce(g, { type: 'toTitle' }));
    expect(next.run).toMatchObject({ arenaId: 'pit', titles: [], items: [], gold: START_GOLD + 10 * (levelOf(g.save.xp) - 1) });
  });

  it('derrota guarda XP das vitórias; empate conta como derrota', () => {
    let g = fightAs(start(), 'victory');
    const firstXp = ENEMIES[g.run!.enemies[0]].xp;
    g = fightAs(g, 'draw');
    if (g.screen.name !== 'summary') throw new Error();
    expect(g.screen.summary.result).toBe('draw');
    expect(g.save).toMatchObject({ runs: 1, wins: 0, best: 0, xp: firstXp });
  });

  it('fugir de um inimigo comum pula o encontro sem ouro nem XP', () => {
    const g = fightAs(start(), 'fled');
    expect(g.screen.name).toBe('camp');
    expect(g.run).toMatchObject({ encounter: 1, gold: START_GOLD, xp: 0, day: 2 });
    expect(g.run!.fled).toHaveLength(1);
  });

  it('fugir do chefe mantém o chefe como próximo adversário', () => {
    const g = fightAs(withRun(start(), { encounter: 3 }), 'fled');
    expect(g.run!.encounter).toBe(3);
    expect(g.screen.name).toBe('camp');
  });

  it('passar do prazo sem derrotar o chefe encerra a temporada', () => {
    const deadline = ARENAS[0].days;
    const g = fightAs(withRun(start(), { encounter: 3, day: deadline }), 'fled');
    if (g.screen.name !== 'summary') throw new Error();
    expect(g.screen.summary.result).toBe('timeout');
    expect(g.save.wins).toBe(0);
  });

  it('no último dia só se luta: descanso, treino e aprendizado ficam bloqueados', () => {
    const g = withRun(start(), { day: ARENAS[0].days, hp: 10, gold: 999 });
    expect(freeDays(g.run!)).toBe(0);
    expect(reduce(g, { type: 'rest' })).toBe(g);
    expect(reduce(g, { type: 'train', attr: 'str' })).toBe(g);
    expect(reduce(g, { type: 'learn', skill: 'warCry' })).toBe(g);
    expect(reduce(g, { type: 'fight' }).screen.name).toBe('combat');
  });
});

describe('acampamento', () => {
  it('comprar item gasta ouro, aplica o item e tira da loja; sem ouro o mercador recusa', () => {
    const g = withRun(start(), { gold: 100, shop: ['titanHeart', 'chippedSword'], hp: 50 });
    const after = reduce(g, { type: 'buy', itemId: 'titanHeart' });
    expect(after.run).toMatchObject({ gold: 100 - ITEMS.titanHeart.price, items: ['titanHeart'], shop: ['chippedSword'], hp: 75 });
    expect(after.screen.name === 'camp' && after.screen.npc).toBe('merchant');
    expect(after.run!.day).toBe(1); // comprar não gasta dia

    const broke = reduce(withRun(g, { gold: 0 }), { type: 'buy', itemId: 'titanHeart' });
    expect(broke.run!.items).toEqual([]);
    expect(broke.screen.name === 'camp' && NPCS.merchant.poor).toContain(broke.screen.name === 'camp' && broke.screen.line);
    expect(reduce(g, { type: 'buy', itemId: 'warHorn' })).toBe(g); // fora do estoque
  });

  it('treinar sobe o atributo, encarece o próximo treino, gasta 1 dia e Força aumenta a vida', () => {
    const g = withRun(start(), { gold: 200 });
    const price = trainPrice(g.run!, 'str');
    const hpBefore = g.run!.hp;
    const after = reduce(g, { type: 'train', attr: 'str' });
    const run = after.run!;
    expect(run.attrs.str).toBe(CLASSES.warrior.attrs.str + 1);
    expect(run.gold).toBe(200 - price);
    expect(run.day).toBe(2);
    expect(trainPrice(run, 'str')).toBeGreaterThan(price);
    expect(run.hp).toBe(hpBefore + 5);
    expect(playerBuild(run).stats.atk).toBe(CLASSES.warrior.stats.atk + 1);

    expect(reduce(withRun(g, { gold: 0 }), { type: 'train', attr: 'str' }).run!.attrs.str).toBe(CLASSES.warrior.attrs.str);
  });

  it('aprender habilidade exige atributo, espaço e ouro', () => {
    const g = withRun(start('mage'), { gold: 500 });
    expect(learnBlock(g.run!, 'cleave')).toBe('req'); // mago tem FOR 2, precisa 7
    const denied = reduce(g, { type: 'learn', skill: 'cleave' });
    expect(denied.run!.skills).toEqual(CLASSES.mage.skills);
    expect(denied.screen.name === 'camp' && denied.screen.npc).toBe('str');

    const learned = reduce(g, { type: 'learn', skill: 'mend' });
    expect(learned.run!.skills).toContain('mend');
    expect(learned.run!.gold).toBe(500 - SKILLS.mend.price!);
    expect(learned.run!.day).toBe(2);
    expect(learnBlock(learned.run!, 'mend')).toBe('known');

    const full = withRun(g, { skills: ['fireball', 'frostRay', 'mend', 'lightning'] });
    expect(full.run!.skills).toHaveLength(MAX_SKILLS);
    expect(learnBlock(full.run!, 'ironStance')).toBe('slots');
  });

  it('descansar pagando cura 50%; sem ouro cura só 20%; com vida cheia não gasta o dia', () => {
    const g = withRun(start(), { hp: 10, gold: 100 });
    const max = maxHp(g.run!);
    const paid = reduce(g, { type: 'rest' });
    expect(paid.run).toMatchObject({ hp: 10 + Math.round(max * REST_PAID), gold: 100 - restPrice(g.run!), day: 2 });

    const free = reduce(withRun(g, { gold: 0 }), { type: 'rest' });
    expect(free.run).toMatchObject({ hp: 10 + Math.round(max * REST_FREE), gold: 0, day: 2 });

    const full = reduce(withRun(g, { hp: max }), { type: 'rest' });
    expect(full.run!.day).toBe(1);
    expect(full.screen.name === 'camp' && NPCS.inn.denied).toContain(full.screen.name === 'camp' && full.screen.line);
  });

  it('nível vem do XP; atributos e itens somam estatísticas', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(99)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelOf(299)).toBe(2);
    expect(levelOf(300)).toBe(3);
    expect(levelOf(1400)).toBe(5); // ~1 campanha completa
    const attrs = { ...CLASSES.assassin.attrs, dex: CLASSES.assassin.attrs.dex + 2 };
    const b = playerBuild({ classId: 'assassin', level: 3, items: ['serratedDagger', 'vampireChalice'], attrs });
    expect(b.stats.maxHp).toBe(CLASSES.assassin.stats.maxHp + 8);
    expect(b.stats.speed).toBe(CLASSES.assassin.stats.speed + 2);
    expect(b.stats.crit).toBeCloseTo(0.25 + 0.1 + 0.06);
    expect(b.perks.lifesteal).toBe(ITEMS.vampireChalice.perks!.lifesteal);
  });
});
