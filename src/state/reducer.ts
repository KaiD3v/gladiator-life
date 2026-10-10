// Única porta de entrada para mudar o estado. Cada ação é delegada ao módulo do seu domínio;
// ação inválida para a tela atual => estado inalterado (mesmo objeto).
import { buy, learn, rest, talk, train } from './camp';
import { act, afterCombat, fight, newGame, startRun, toTitle } from './campaign';
import { nextBeat, skipScenes } from './scenes';
import type { GameAction, GameState } from './types';
import type { SaveData } from './save';

export const initialState = (save: SaveData, notice?: string): GameState => ({ screen: { name: 'title' }, save, run: null, notice });

export function reduce(g: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'newGame': return newGame(g);
    case 'toTitle': return toTitle(g);
    case 'startRun': return startRun(g, a);
    case 'act': return act(g, a);
    case 'fight': return fight(g);
    case 'continue': return afterCombat(g);
    case 'next': return nextBeat(g);
    case 'skip': return skipScenes(g);
    case 'talk': return talk(g, a);
    case 'buy': return buy(g, a);
    case 'train': return train(g, a);
    case 'learn': return learn(g, a);
    case 'rest': return rest(g);
  }
}
