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
| `src/engine/` | Motores puros: `combat` (rodada inteira em `resolveRound`; ver "Combate" abaixo), `characters` (pipeline de modificadores, `buildPlayer`, `createPlayerFighter`, `createEnemyFighter`), `items` (`acquireItem`, `withMaxHpGrowth`, `buyBlock`, `rollShop`, `rollLoot`, `addToBag`), `scenes` (`scenesFor`, `beatView`, `sceneAssets`, `sceneTrack`, `sceneAmbience`). | Funções puras, testadas. |
| `src/state/` | `types.ts` (`RunState`, `Screen`, `GameAction`), `save.ts` (save + nível), `run.ts` (regras da run usadas pela UI), `camp.ts`, `campaign.ts`, `scenes.ts` e `reducer.ts`. | `reduce(g, action)` é a **única** forma de mudar o estado do jogo. |
| `src/ui/` | `store.ts` (estado da página, `dispatch`, render, animação do log), `events.ts` (tabela `data-a` → ação, teclado), `components.ts` (peças HTML), `views/<tela>.ts`, `audio.ts`. | Views são funções `(estado) => string HTML`; não guardam estado. |

## Combate

Tudo em `engine/combat.ts`, com os números em `data/balance.ts` (`CROWD`, `POSTURE`). Camadas, todas visíveis ao jogador:

- **Intenção**: o inimigo segue um `pattern` cíclico (sem `rand`) e anuncia a próxima ação (`CombatState.intent`,
  `intentView`). Habilidade com `windup` gasta uma rodada preparando (`prep`) e acerta na seguinte. Quem consome um
  atordoamento fica `steady` (imune) na rodada seguinte.
- **Multidão** (`crowd` 0..100, `crowdView`): sobe com jogo vistoso, cai com repetição e covardia. Ovação (+dano), Golpe de
  Glória da classe (`ClassDef.glory`, só com 100), "A multidão exige mais" (salva da morte 1x) e veredito Executar/Poupar
  em luta comum com o inimigo ≤15% (`verdictAvailable`). O favor multiplica o ouro em `afterCombat`.
- **Postura** (`posture`/`weak` do inimigo, `postureView`): golpes e efeitos no ponto fraco abalam; em 0 fica `broken`
  (perde a vez, +50% de dano) e recompõe ao acabar. Pontos fracos descobertos vão para `RunState.bestiary`.
- **Chefes**: `phase2` (troca de padrão e fala ao cruzar a vida indicada) e `barks` (falas, `LogEntry.bark`).
- **Perigo da arena** (`ArenaDef.hazard`, `hazardView`): avisado uma rodada antes, age no fim da rodada; Defender protege
  dos efeitos de status.
- **Bolsa** (`Fighter.bag`, `RunState.bag`, até `BAG_SIZE`): consumíveis viram ações de custo 0 (a habilidade de mesmo id,
  gerada em `data/skills.ts` a partir de `ItemDef.use`). Item sem efeito no inimigo é de defesa e age primeiro (como Defender);
  item de ataque segue a velocidade. O inimigo sorteia a bolsa do seu `loot` (`rollLoot`, com RNG derivado por `fork`: não
  mexe nos sorteios da run nem do combate) e só usa item no lugar de ataque básico/defesa, por regra fixa anunciada na
  intenção (`kind: 'item'`). O que ele não usou fica no chão: na vitória a janela "Itens caídos" deixa o jogador escolher o
  que leva entre os caídos e a própria bolsa (`continue` com `keep`, índices em `bolsa + caídos`, validados por `chooseBag`;
  sem `keep`, leva a bolsa e o que couber). Fora da luta só cura (`use`); a bolsa abre pelo botão do topo do acampamento.
- `actionsFor(f, s)` tem ordem estável (atalhos 1..n): ataque, habilidades, glória, defender, fugir, itens da bolsa, veredito. Passe sempre
  o estado `s`. `LogEntry` guarda `hp` e `crowd` por evento para a UI animar, e `sfx` para o som.

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
  Variante mais forte de um inimigo (as arenas 2 e 3 só usam variantes): espalhe o original em `data/enemies.ts`
  (`{ ...wolf, id, name, desc, stats: { ...wolf.stats, atk: 9 }, pattern, ... }`) e sobrescreva só o que muda; a escala por
  `tier` continua por cima. Precisa de sprite `<id>` (prompt em `scripts/asset-prompts/`, tamanho em `SIZES`).
  Consumível: `use` no item (`heal`, `energy`, `cleanse`, `effects`); para um inimigo carregá-lo, ponha o id no `loot` dele.
  Habilidade de treinador precisa de `attr`, `req` e `price`. Inimigo precisa de `pattern`, `posture` e `weak` (chefe:
  `phase2` e `barks`, falas em linguagem neutra sobre o herói). Classe precisa de `glory`.
- Cena: uma entrada em `data/story.ts` com `trigger` (`campaign-start`, `run-start`, `boss-intro`, `boss-defeat`,
  `arena-enter`, `campaign-won`) e `once: true` se só pode tocar uma vez por campanha; `music` e `ambience` opcionais. Falas aceitam `{nome}` e `{classe}`.
  Personagens que falam ficam em `SPEAKERS`. O herói pode ser de qualquer gênero: escreva falas sobre ele em linguagem neutra.
- Arena nova: entrada em `data/arenas.ts` (ordem do array = ordem da campanha, com `hazard`) + cenas
  `boss-intro`/`boss-defeat`/`arena-enter` + fundo `bg-<id>`. `data/story.test.ts` falha se faltar cena ou asset.

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
**Toda tela cabe na janela, sem rolar a página** (de 360×640 a 1920×1080, inclusive celular deitado): cada view é um
`.screen` (coluna flex com a altura de `#app` = `100dvh`); só a parte flexível cresce/encolhe (palco, miolo do
acampamento, detalhes da classe, arte do título, relatório) e listas longas rolam por dentro (`.scroll`). Ações
principais ficam embaixo, sempre visíveis. Desktop (≥900px) e celular deitado usam `grid-template-areas` (não dependa
da contagem de filhos). No combate, abaixo de 900px as ações ficam numa bandeja com abas deslizáveis
(Habilidades | Básico | Itens | Registro, página em `ui.tray` no `store.ts`); acima disso tudo aparece junto e o registro vai
para a coluna lateral. Ao mexer em layout, confira as telas nessas resoluções no navegador.

## Arte e áudio

Pixel art medieval gerada pelo Codex CLI (`codex exec`, recurso `image_generation`) a partir dos prompts em
`scripts/asset-prompts/`; o estilo comum está na 1ª linha de cada prompt. Sprites são gerados sobre fundo magenta `#FF00FF` e
convertidos com `python scripts/process_assets.py <pasta-dos-png>` (recorte, redução, WebP). Registre tamanho/nome novo em
`SIZES` (ou na lista de fundos `bg-*`) e em `FLIP` se o sprite olhar para o lado errado (jogador → direita, inimigos → esquerda).
Música e efeitos ficam em `public/audio/` (`<faixa>.mp3`, `sfx/<efeito>.mp3`); efeitos de combate vêm do campo `sfx` do log.
Ambientes em loop ficam em `public/audio/amb/` e tocam num segundo canal, por baixo da música: nas cenas pelo campo
`ambience` (cena ou fala; `null` corta) e no combate a torcida, com volume que segue o favor. Sons novos foram gerados no
ElevenLabs (efeitos sonoros) e mixados com ffmpeg; geração custa créditos: estime e peça aprovação antes.

## Balanceamento

Mudanças em números devem ser validadas por simulação: um teste temporário que joga centenas de campanhas com sementes fixas
via `reduce` (bot que usa o acampamento e escolhe ações) e mede a taxa de títulos por classe. Rode, compare com o estado
anterior, apague o arquivo antes de commitar. Use ao menos três bots: aleatório (ações válidas ao acaso), guloso (sempre a
habilidade de dano mais cara, ignora a intenção) e informado (lê `intentView`: ataca no preparo, defende o golpe pesado,
usa Glória e Executar). Informação tem que render mais que jogar às cegas.

Referência atual (600 campanhas por classe, % de títulos nas arenas 1 / 2 / 3):

| Bot | Guerreiro | Mago | Assassino |
| --- | --- | --- | --- |
| aleatório | 33 / 9 / 1 | 13 / 0 / 0 | 18 / 2 / 0 |
| guloso | 87 / 66 / 16 | 55 / 26 / 4 | 44 / 23 / 2 |
| informado | 99 / 79 / 25 | 74 / 35 / 5 | 65 / 38 / 5 |

Metas: Fosso vencível por todas as classes, dificuldade crescente entre as arenas, Mago e Assassino no mesmo patamar.
O Guerreiro é a classe mais fácil para os bots.

## Git

Branch `main`. Commits pequenos e descritivos em inglês. Trabalho paralelo com agentes: cada um num worktree
(`.claude/worktrees/`, ignorado) com arquivos de responsabilidade definidos para evitar conflito; revise e rode testes,
build e navegador antes de mesclar. O Vitest também roda os testes dentro de `.claude/worktrees/`: enquanto houver worktree,
use `npx vitest run src` e remova cada worktree (`git worktree remove`) assim que mesclar. Um bom corte é motor
(`data`/`engine`/`state`) num agente e interface (`ui`/`style.css`) em outro, com a API combinada antes.
