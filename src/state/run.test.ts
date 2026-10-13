import { describe, expect, it } from 'vitest';
import { ARENAS, CLASSES, CROWD, ENEMIES, ITEMS, MAX_SKILLS, NPCS, REST_FREE, REST_PAID, SHOP_CONSUMABLES, SHOP_SIZE, SKILLS, START_GOLD, type Attr } from '../data';
import {
  defaultSave, freeDays, initialState, learnBlock, levelOf, maxHp, parseSave, playerBuild, reduce, restPrice, trainPrice,
  type GameAction, type GameState, type RunState,
} from '.';

/** Serviços dos NPCs do Ato I (Cássio vende, Marta hospeda, Brutus/Lyra/Oren treinam o seu atributo). */
const TRAINER = { str: 'brutus', dex: 'lyra', wis: 'oren' } as const;
const buy = (itemId: string): GameAction => ({ type: 'service', npc: 'cassio', value: itemId });
const rest: GameAction = { type: 'service', npc: 'marta', value: 'rest' };
const train = (attr: Attr): GameAction => ({ type: 'service', npc: TRAINER[attr], value: 'train' });
const learn = (skill: string): GameAction => ({ type: 'service', npc: TRAINER[SKILLS[skill].attr!], value: skill });

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

  it.each(['{lixo', '42', 'null', '{"version":4,"xp":0,"runs":0,"wins":0,"best":0,"story":[]}',
    '{"version":2,"xp":-5,"runs":0,"wins":0,"best":0}',
    '{"version":2,"xp":10,"runs":0,"wins":0,"best":9}',
    '{"version":2,"xp":"10","runs":0,"wins":0,"best":0}',
    '{"version":1,"xp":-1,"unlocked":["pit"],"runs":0,"wins":0}', '{"version":3,"xp":0,"runs":0,"wins":0,"best":9,"story":[]}'])('save inválido %s volta ao padrão com aviso', (raw) => {
    const r = parseSave(raw);
    expect(r.save).toEqual(defaultSave());
    expect(r.error).toBeTruthy();
  });

  it('save válido é preservado, inclusive a história', () => {
    const save = { version: 3, xp: 250, runs: 3, wins: 1, best: 2, story: [] };
    expect(parseSave(JSON.stringify(save))).toEqual({ save });
    const withStory = start().save;
    expect(withStory.story).toHaveLength(1);
    expect(parseSave(JSON.stringify(withStory))).toEqual({ save: withStory });
  });

  it('save v2 (antes dos atos) migra mantendo tudo, sem história', () => {
    const r = parseSave(JSON.stringify({ version: 2, xp: 250, runs: 3, wins: 1, best: 2 }));
    expect(r).toEqual({ save: { version: 3, xp: 250, runs: 3, wins: 1, best: 2, story: [] } });
  });

  it('história inválida é descartada com aviso, mas o nível fica', () => {
    const save = { ...start().save, xp: 250 };
    const broken = [{ ...save.story[0], arenaId: 'colosseum' }]; // checkpoint do ato 1 fora da primeira arena
    for (const story of [broken, [{ nome: 'x' }], 'lixo']) {
      const r = parseSave(JSON.stringify({ ...save, story }));
      expect(r.save).toEqual({ ...save, story: [] });
      expect(r.error).toBeTruthy();
    }
  });

  it('save v1 (arenas desbloqueáveis) migra mantendo XP e runs', () => {
    const r = parseSave(JSON.stringify({ version: 1, xp: 250, unlocked: ['pit', 'colosseum'], runs: 3, wins: 2 }));
    expect(r.error).toBeUndefined();
    expect(r.save).toEqual({ version: 3, xp: 250, runs: 3, wins: 0, best: 1, story: [] });
  });
});

describe('transições', () => {
  it('ações fora da tela correta são ignoradas', () => {
    const g = initialState(defaultSave());
    for (const a of [{ type: 'act', action: 'attack' }, { type: 'continue' }, { type: 'fight' }, rest, buy('chippedSword'), train('str')] as GameAction[]) {
      expect(reduce(g, a)).toBe(g);
    }
    const fighting = reduce(start(), { type: 'fight' });
    expect(reduce(fighting, { type: 'continue' })).toBe(fighting); // combate ainda não acabou
    expect(reduce(fighting, rest)).toBe(fighting); // não se descansa no meio da luta
  });

  it('escolher ato abandona a campanha (vale como derrota) e volta ao título, com a história intacta', () => {
    const g = initialState(defaultSave());
    expect(reduce(g, { type: 'abandon' })).toBe(g); // sem campanha em andamento
    const playing = withRun(reduce(start(), { type: 'fight' }), { xp: 40 }); // até no meio da luta
    const r = reduce(playing, { type: 'abandon' });
    expect(r.run).toBeNull();
    expect(r.screen.name).toBe('title');
    expect(r.save).toMatchObject({ xp: 40, runs: 1, wins: 0 });
    expect(r.save.story).toEqual(playing.save.story);
    expect(reduce(r, { type: 'startAct', act: 0, seed: 1 }).run).toMatchObject({ name: 'Spartacus', arenaId: 'pit' });
  });

  it('recomeçar o ato abandona a campanha e volta ao checkpoint do ato atual', () => {
    const g = initialState(defaultSave());
    expect(reduce(g, { type: 'restartAct', seed: 1 })).toBe(g); // sem campanha em andamento
    let playing = start();
    const checkpoint = playing.save.story[0];
    playing = withRun(fightAs(playing, 'victory'), { gold: 999, items: ['chippedSword'] });
    const r = reduce(playing, { type: 'restartAct', seed: 1 });
    expect(r.screen.name).toBe('camp');
    expect(r.run).toMatchObject({ arenaId: 'pit', encounter: 0, day: 1, gold: checkpoint.gold, items: [] });
    expect(r.save).toMatchObject({ runs: 1, wins: 0 });
    expect(r.save.xp).toBe(playing.run!.xp);
    // run sem checkpoint do ato (gravada antes dos atos): nada muda
    const orphan = { ...playing, save: { ...playing.save, story: [] } };
    expect(reduce(orphan, { type: 'restartAct', seed: 1 })).toBe(orphan);
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
    expect(run.shop).toHaveLength(SHOP_SIZE + SHOP_CONSUMABLES);
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
    // Torcida inicial (favor 30) paga ouro × (1 + 30/200) por vitória forçada, sem ação do jogador
    expect(g.run!.gold).toBe(START_GOLD + g.run!.kills.reduce((n, id) => n + Math.round(ENEMIES[id].gold * (1 + CROWD.start / CROWD.goldDivisor)), 0));
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
    expect(g.screen.summary.run.titles).toEqual(ARENAS.map((a) => a.id));
    expect(g.save).toMatchObject({ runs: 1, wins: 1, best: ARENAS.length });
    expect(g.save.xp).toBe(g.screen.summary.xpGained);
    expect(parseSave(JSON.stringify(g.save)).save).toEqual(g.save);
  });

  it('morrer na arena 2 volta ao início do ato com o herói como entrou; gladiador novo apaga a história', () => {
    let g = start();
    const checkpoint = g.save.story[0];
    expect(checkpoint).toMatchObject({ name: 'Spartacus', classId: 'warrior', arenaId: 'pit', gold: START_GOLD });
    g = withRun(g, { gold: 500, items: ['chippedSword'] });
    for (let i = 0; i < 4; i++) g = fightAs(g, 'victory');
    expect(g.run!.arenaId).toBe('colosseum');
    g = fightAs(g, 'defeat');
    if (g.screen.name !== 'summary') throw new Error();
    expect(g.screen.summary.result).toBe('defeat');
    expect(g.save).toMatchObject({ runs: 1, wins: 0, best: 1 });
    expect(g.save.story).toEqual([checkpoint]); // a história continua no ato 1

    const retry = reduce(g, { type: 'startAct', act: 0, seed: 7 });
    expect(retry.screen.name).toBe('camp');
    expect(retry.run).toMatchObject({ name: 'Spartacus', classId: 'warrior', arenaId: 'pit', titles: [], items: [], gold: START_GOLD, encounter: 0, day: 1, seed: expect.any(Number) });
    expect(retry.run!.level).toBe(levelOf(g.save.xp)); // o XP da tentativa conta
    expect(retry.run!.hp).toBe(maxHp(retry.run!));
    expect(reduce(g, { type: 'startAct', act: 1, seed: 7 })).toBe(g); // ato não liberado
    expect(reduce(retry, { type: 'startAct', act: 0, seed: 7 })).toBe(retry); // só do título ou do resumo

    const fromTitle = reduce(reduce(g, { type: 'toTitle' }), { type: 'startAct', act: 0, seed: 7 });
    expect(fromTitle.run).toEqual(retry.run);

    const next = start('mage', reduce(g, { type: 'toTitle' }));
    expect(next.run).toMatchObject({ arenaId: 'pit', titles: [], items: [], gold: START_GOLD + 10 * (levelOf(g.save.xp) - 1) });
    expect(next.save.story).toEqual([expect.objectContaining({ name: 'Spartacus', classId: 'mage' })]);
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
    expect(reduce(g, rest)).toBe(g);
    expect(reduce(g, train('str'))).toBe(g);
    expect(reduce(g, learn('warCry'))).toBe(g);
    expect(reduce(g, { type: 'fight' }).screen.name).toBe('combat');
  });
});

describe('acampamento', () => {
  it('comprar item gasta ouro, aplica o item e tira da loja; sem ouro o mercador recusa', () => {
    const g = withRun(start(), { gold: 100, shop: ['titanHeart', 'chippedSword'], hp: 50 });
    const after = reduce(g, buy('titanHeart'));
    expect(after.run).toMatchObject({ gold: 100 - ITEMS.titanHeart.price, items: ['titanHeart'], shop: ['chippedSword'], hp: 75 });
    expect(after.screen.name === 'camp' && after.screen.npc).toBe('cassio');
    expect(after.run!.day).toBe(1); // comprar não gasta dia

    const broke = reduce(withRun(g, { gold: 0 }), buy('titanHeart'));
    expect(broke.run!.items).toEqual([]);
    expect(broke.screen.name === 'camp' && NPCS.cassio.lines.poor).toContain(broke.screen.name === 'camp' && broke.screen.line);
    expect(reduce(g, buy('warHorn'))).toBe(g); // fora do estoque
  });

  it('treinar sobe o atributo, encarece o próximo treino, gasta 1 dia e Força aumenta a vida', () => {
    const g = withRun(start(), { gold: 200 });
    const price = trainPrice(g.run!, 'str');
    const hpBefore = g.run!.hp;
    const after = reduce(g, train('str'));
    const run = after.run!;
    expect(run.attrs.str).toBe(CLASSES.warrior.attrs.str + 1);
    expect(run.gold).toBe(200 - price);
    expect(run.day).toBe(2);
    expect(trainPrice(run, 'str')).toBeGreaterThan(price);
    expect(run.hp).toBe(hpBefore + 5);
    expect(playerBuild(run).stats.atk).toBe(CLASSES.warrior.stats.atk + 1);

    expect(reduce(withRun(g, { gold: 0 }), train('str')).run!.attrs.str).toBe(CLASSES.warrior.attrs.str);
  });

  it('aprender habilidade exige atributo, espaço e ouro', () => {
    const g = withRun(start('mage'), { gold: 500 });
    expect(learnBlock(g.run!, 'cleave')).toBe('req'); // mago tem FOR 2, precisa 7
    const denied = reduce(g, learn('cleave'));
    expect(denied.run!.skills).toEqual(CLASSES.mage.skills);
    expect(denied.screen.name === 'camp' && denied.screen.npc).toBe('brutus');

    const learned = reduce(g, learn('mend'));
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
    const paid = reduce(g, rest);
    expect(paid.run).toMatchObject({ hp: 10 + Math.round(max * REST_PAID), gold: 100 - restPrice(g.run!), day: 2 });

    const free = reduce(withRun(g, { gold: 0 }), rest);
    expect(free.run).toMatchObject({ hp: 10 + Math.round(max * REST_FREE), gold: 0, day: 2 });

    const full = reduce(withRun(g, { hp: max }), rest);
    expect(full.run!.day).toBe(1);
    expect(full.screen.name === 'camp' && NPCS.marta.lines.denied).toContain(full.screen.name === 'camp' && full.screen.line);
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

describe('recompensas da torcida', () => {
  /** Vence a próxima luta com o favor e o veredito dados. */
  function winWith(crowd: number, verdict?: 'executed' | 'spared') {
    const g = skip(reduce(start(), { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error();
    const combat = { ...g.screen.combat, outcome: 'victory' as const, crowd, verdict };
    const after = skip(reduce({ ...g, screen: { name: 'combat', combat } }, { type: 'continue' }));
    return { after, enemy: ENEMIES[g.run!.enemies[0]] };
  }

  it('ouro × (1 + favor/200)', () => {
    const { after, enemy } = winWith(100);
    expect(after.run!.gold - START_GOLD).toBe(Math.round(enemy.gold * (1 + 100 / CROWD.goldDivisor)));
    expect(after.run!.xp).toBe(enemy.xp);
    expect(after.screen.name === 'camp' && after.screen.news).toContain('moedas');
  });

  it('executar paga mais ouro; poupar paga menos ouro e mais XP', () => {
    const ex = winWith(40, 'executed');
    expect(ex.after.run!.gold - START_GOLD).toBe(Math.round(ex.enemy.gold * (1 + 40 / CROWD.goldDivisor) * CROWD.executeGold));
    expect(ex.after.screen.name === 'camp' && ex.after.screen.news).toContain('executou');
    const sp = winWith(40, 'spared');
    expect(sp.after.run!.gold - START_GOLD).toBe(Math.round(sp.enemy.gold * (1 + 40 / CROWD.goldDivisor) * CROWD.spareGold));
    expect(sp.after.run!.xp).toBe(Math.round(sp.enemy.xp * CROWD.spareXp));
    expect(sp.after.screen.name === 'camp' && sp.after.screen.news).toContain('poupou');
  });

  it('a luta contra o chefe nasce marcada como chefe (sem veredito)', () => {
    let g = start();
    for (let i = 0; i < 3; i++) g = fightAs(g, 'victory');
    g = skip(reduce(g, { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error();
    expect(g.screen.combat.boss).toBe(true);
    expect(g.screen.combat.player.glory).toBe(CLASSES.warrior.glory);
  });
});


describe('bolsa e espólio', () => {
  /** Entra em combate e força o fim com as bolsas indicadas. */
  function endWith(g: GameState, outcome: 'victory' | 'fled', playerBag: string[], enemyBag: string[], keep?: number[]): GameState {
    g = skip(reduce(g, { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
    const c = structuredClone(g.screen.combat);
    Object.assign(c, { outcome });
    c.player.bag = playerBag;
    c.enemy.bag = enemyBag;
    return skip(reduce({ ...g, screen: { name: 'combat', combat: c } }, { type: 'continue', keep }));
  }

  it('a luta começa com a bolsa da run; o inimigo traz o espólio sorteado', () => {
    const g = skip(reduce(withRun(start(), { bag: ['potion'] }), { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
    expect(g.screen.combat.player.bag).toEqual(['potion']);
    expect(g.screen.combat.enemy.bag.every((id) => ENEMIES[g.run!.enemies[0]].loot?.includes(id))).toBe(true);
  });

  it('vitória sem escolha: o gasto não volta, o que couber dos itens caídos vem junto e fica marcado como novo', () => {
    const g = endWith(withRun(start(), { bag: ['potion', 'tonic'] }), 'victory', ['tonic'], ['fireBomb', 'blindPowder', 'potion', 'potion']);
    expect(g.run!.bag).toEqual(['tonic', 'fireBomb', 'blindPowder', 'potion']);
    expect(g.screen.name === 'camp' && g.screen.loot).toEqual(['fireBomb', 'blindPowder', 'potion']);
  });

  it('vitória com escolha: troca item da bolsa por item caído ou deixa tudo na areia', () => {
    // bolsa + caídos = [tonic, tonic, fireBomb, potion]: solta um Tônico e leva só a Poção
    const swap = endWith(start(), 'victory', ['tonic', 'tonic'], ['fireBomb', 'potion'], [0, 3]);
    expect(swap.run!.bag).toEqual(['tonic', 'potion']);
    expect(swap.screen.name === 'camp' && swap.screen.loot).toEqual(['potion']);
    expect(endWith(start(), 'victory', ['tonic'], ['potion'], [0]).run!.bag).toEqual(['tonic']);
  });

  it('escolha inválida (repetida, fora da lista ou acima da capacidade) não fecha o combate', () => {
    let g = skip(reduce(start(), { type: 'fight' }));
    if (g.screen.name !== 'combat') throw new Error('não entrou em combate');
    const c = structuredClone(g.screen.combat);
    Object.assign(c, { outcome: 'victory' });
    c.player.bag = ['tonic', 'tonic', 'tonic'];
    c.enemy.bag = ['potion', 'potion'];
    g = { ...g, screen: { name: 'combat', combat: c } };
    for (const keep of [[0, 0], [7], [0, 1, 2, 3, 4], [-1], [0.5]]) expect(reduce(g, { type: 'continue', keep })).toBe(g);
  });

  it('fuga: guarda o que sobrou, sem espólio', () => {
    expect(endWith(withRun(start(), { bag: ['potion'] }), 'fled', [], ['fireBomb']).run!.bag).toEqual([]);
  });

  it('no acampamento a poção cura sem gastar dia; item de luta e vida cheia são recusados', () => {
    const g = withRun(start(), { bag: ['potion', 'fireBomb'], hp: 10 });
    const used = reduce(g, { type: 'use', itemId: 'potion' });
    expect(used.run).toMatchObject({ hp: 40, day: g.run!.day, bag: ['fireBomb'] });
    expect(reduce(g, { type: 'use', itemId: 'fireBomb' })).toBe(g);
    const full = withRun(start(), { bag: ['potion'] });
    expect(reduce(full, { type: 'use', itemId: 'potion' })).toBe(full);
  });

  it('consumível comprado vai para a bolsa; bolsa cheia recusa sem cobrar', () => {
    const g = withRun(start(), { gold: 100, shop: ['potion'] });
    expect(reduce(g, buy('potion')).run).toMatchObject({ gold: 100 - ITEMS.potion.price, bag: ['potion'], items: [] });
    const full = reduce(withRun(g, { bag: ['tonic', 'tonic', 'tonic', 'tonic'] }), buy('potion'));
    expect(full.run).toMatchObject({ gold: 100, shop: ['potion'] });
  });
});
