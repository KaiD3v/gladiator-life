// Única porta de entrada para mudar o estado. Cada ação é delegada ao módulo do seu domínio;
// ação inválida para a tela atual => estado inalterado (mesmo objeto).
import { serve, talk, useItem } from './camp';
import { abandon, act, afterCombat, fight, newGame, restartAct, startAct, startRun, toTitle } from './campaign';
import { nextBeat, skipScenes } from './scenes';
import type { GameAction, GameState } from './types';
import type { SaveData } from './save';

export const initialState = (save: SaveData, notice?: string): GameState => ({ screen: { name: 'title' }, save, run: null, notice });

export function reduce(g: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'newGame': return newGame(g);
    case 'toTitle': return toTitle(g);
    case 'restartAct': return restartAct(g, a);
    case 'abandon': return abandon(g);
    case 'startRun': return startRun(g, a);
    case 'startAct': return startAct(g, a);
    case 'act': return act(g, a);
    case 'fight': return fight(g);
    case 'continue': return afterCombat(g, a);
    case 'next': return nextBeat(g);
    case 'skip': return skipScenes(g);
    case 'talk': return talk(g, a);
    case 'service': return serve(g, a);
    case 'use': return useItem(g, a);
  }
}
