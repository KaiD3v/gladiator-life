# Arena dos Gladiadores

RPG de gladiadores para navegador: combate por turnos, campanha roguelike em 3 arenas consecutivas, acampamento entre lutas
(loja, treino, descanso, prazo em dias) e cenas de história. Vite + TypeScript estrito, sem framework e sem dependências de
runtime. Interface, textos e comentários em **português**; identificadores de código e mensagens de commit em inglês.

## Comandos

```bash
npm test          # Vitest (testes ficam ao lado do módulo: src/**/x.test.ts)
npm run build     # tsc --noEmit (strict, noUnusedLocals/Parameters) + vite build
npm run dev       # servidor local
```

Antes de dar uma tarefa por concluída: `npm test` e `npm run build` passando. Mudança visível ao jogador também precisa ser
vista no navegador (build de produção via `npx vite preview`), incluindo largura de celular (375px).

## Arquitetura

Camadas com dependência em um só sentido: **`ui → state → engine → data/core`**. Nada fora de `src/ui/` toca o DOM.

| Pasta | Contém | Regra |
| --- | --- | --- |
| `src/data/` | Conteúdo puro, um arquivo por domínio (`classes`, `enemies`, `items`, `skills`, `arenas`, `npcs`, `statuses`, `attributes`, `balance`, `story`) e os tipos em `types.ts`. `index.ts` reexporta tudo. | Só dados. Sem funções com regra. |
| `src/core/rng.ts` | `rand(s)` (mulberry32 com a semente guardada no próprio estado) e `pick`. | Toda aleatoriedade passa por aqui. |
| `src/engine/` | Motores puros: `combat` (rodada inteira em `resolveRound`), `characters` (pipeline de modificadores, `buildPlayer`, `createPlayerFighter`, `createEnemyFighter`), `items` (`acquireItem`, `withMaxHpGrowth`, `buyBlock`, `rollShop`), `scenes` (`scenesFor`, `beatView`, `sceneAssets`, `sceneTrack`). | Funções puras, testadas. |
| `src/state/` | `types.ts` (`RunState`, `Screen`, `GameAction`), `save.ts` (save + nível), `run.ts` (regras da run usadas pela UI), `camp.ts`, `campaign.ts`, `scenes.ts` e `reducer.ts`. | `reduce(g, action)` é a **única** forma de mudar o estado do jogo. |
| `src/ui/` | `store.ts` (estado da página, `dispatch`, render, animação do log), `events.ts` (tabela `data-a` → ação, teclado), `components.ts` (peças HTML), `views/<tela>.ts`, `audio.ts`. | Views são funções `(estado) => string HTML`; não guardam estado. |

## Invariantes (não quebre)

- **Ação inválida devolve o mesmo objeto de estado.** `reduce` e `resolveRound` retornam a referência original quando a ação
  não vale para a tela atual; a UI e os testes dependem disso (impede ação dupla no mesmo turno).
- **Estado imutável por fora**: cada transição faz `structuredClone` da run/combate e muta só a cópia.
- **Ordem das chamadas a `rand` importa.** Os testes usam sementes fixas; adicionar, remover ou reordenar `rand` muda resultados.
  Se for intencional, ajuste os testes conscientemente, nunca "até passar".
- **Balanceamento é calibrado.** Números em `data/` (stats, preços, prazos, escala de inimigos em `balance.ts`) foram ajustados
  por simulação. Refatoração não muda números; mudança de balanceamento é uma tarefa explícita (ver "Balanceamento").
- **Escape de HTML**: todo texto vindo do jogador (nome do gladiador) passa por `esc()` antes de entrar em HTML.
- **Save**: só progressão permanente (`SaveData` em `state/save.ts`). Mudou o formato? Suba `version` e escreva a migração em
  `parseSave` mantendo o progresso de quem já joga; save inválido volta ao padrão com aviso, nunca quebra o jogo.
- **Assets são locais** (`public/assets/*.webp`, `public/audio/`). Imagem que falha cai no ícone SVG (`data-fb`) ou some.

## Como fazer mudanças comuns

**Conteúdo novo (o caso mais frequente, só dados):**
- Item / inimigo / classe / habilidade: uma entrada em `data/items.ts`, `data/enemies.ts`, `data/classes.ts` ou `data/skills.ts`.
  Efeitos de item são `mods` (stats) e `perks`; o motor de personagens aplica, e item que aumenta vida máxima cura o mesmo tanto.
  Habilidade de treinador precisa de `attr`, `req` e `price`.
- Cena: uma entrada em `data/story.ts` com `trigger` (`campaign-start`, `run-start`, `boss-intro`, `boss-defeat`,
  `arena-enter`, `campaign-won`) e `once: true` se só pode tocar uma vez por campanha. Falas aceitam `{nome}` e `{classe}`.
  Personagens que falam ficam em `SPEAKERS`. O herói pode ser de qualquer gênero: escreva falas sobre ele em linguagem neutra.
- Arena nova: entrada em `data/arenas.ts` (ordem do array = ordem da campanha) + cenas `boss-intro`/`boss-defeat`/`arena-enter`
  + fundo `bg-<id>`. `data/story.test.ts` falha se faltar cena ou asset.

**Nova mecânica / regra:**
1. Tipos em `data/types.ts` (conteúdo) ou `state/types.ts` (estado/ações).
2. Regra pura no motor certo em `engine/` (ou em `state/run.ts` se for regra da run que a UI precisa consultar, como preços e
   bloqueios no formato `xxxBlock(run) → motivo | null`).
3. Nova ação: variante em `GameAction`, função no módulo de domínio de `state/` (valida a tela, clona, aplica) e um `case` em
   `state/reducer.ts` que só delega.
4. UI: botão com `data-a="<nome>"` (+ `data-v`) e uma linha na tabela `ACTIONS` de `ui/events.ts`.
5. Testes no mesmo diretório do módulo.

**Nova tela:** variante em `Screen`, view em `ui/views/<tela>.ts`, um ramo em `render()` de `ui/store.ts` e a música em `trackFor`.

**UI:** reutilize `components.ts` (`bar`, `art`, `skillList`, `itemChip`, `bossTag`, `goldPill`…) antes de escrever markup novo.
Sem `style=""` estático (só valores dinâmicos, como `background-image` e largura de barra): crie classe em `src/style.css`.
Preserve classes/atributos usados por automação: valores de `data-a`, `#name`, `#start`, `#next`, `.turn-banner`, `.town`,
`.scene`, `.summary-title`, `.bar.hp` (com `aria-valuenow/max`). Botões ≥ 48px de altura; nada de rolagem horizontal no celular.

## Arte e áudio

Pixel art medieval gerada pelo Codex CLI (`codex exec`, recurso `image_generation`) a partir dos prompts em
`scripts/asset-prompts/`; o estilo comum está na 1ª linha de cada prompt. Sprites são gerados sobre fundo magenta `#FF00FF` e
convertidos com `python scripts/process_assets.py <pasta-dos-png>` (recorte, redução, WebP). Registre tamanho/nome novo em
`SIZES` (ou na lista de fundos `bg-*`) e em `FLIP` se o sprite olhar para o lado errado (jogador → direita, inimigos → esquerda).
Música e efeitos ficam em `public/audio/` (`<faixa>.mp3`, `sfx/<efeito>.mp3`); efeitos de combate vêm do campo `sfx` do log.

## Balanceamento

Mudanças em números devem ser validadas por simulação: um teste temporário que joga centenas de campanhas com sementes fixas
via `reduce` (bot que usa o acampamento e escolhe ações) e mede a taxa de títulos por classe. Rode, compare com o estado
anterior, apague o arquivo antes de commitar. Referência atual (bot aleatório): Fosso vencível por todas as classes, curva de
dificuldade crescente entre as arenas, Guerreiro como classe mais difícil para o bot.

## Git

Branch `main`. Commits pequenos e descritivos em inglês. Trabalho paralelo com agentes: cada um num worktree
(`.claude/worktrees/`, ignorado) com arquivos de responsabilidade definidos para evitar conflito; revise e rode testes,
build e navegador antes de mesclar.
