# Arena dos Gladiadores

RPG de gladiadores para navegador: combate por turnos, história em atos (cada um com 3 arenas consecutivas), acampamento entre lutas
(loja, treino, descanso, prazo em dias) e cenas de história. Vite + TypeScript estrito, sem framework; a única dependência de
runtime é `@vercel/analytics` (só em `ui/analytics.ts`). Interface, textos e comentários em **português**; identificadores de código e mensagens de commit em inglês.

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
| `src/data/` | Conteúdo puro, um arquivo por domínio (`classes`, `enemies`, `items`, `skills`, `arenas`, `characters`, `npcs`, `statuses`, `attributes`, `balance`, `story`) e os tipos em `types.ts`. `index.ts` reexporta tudo. | Só dados. Sem funções com regra. |
| `src/core/rng.ts` | `rand(s)` (mulberry32 com a semente guardada no próprio estado) e `pick`. | Toda aleatoriedade passa por aqui. |
| `src/engine/` | Motores puros: `combat` (rodada inteira em `resolveRound`; ver "Combate" abaixo), `characters` (pipeline de modificadores, `buildPlayer`, `createPlayerFighter`, `createEnemyFighter`), `items` (`acquireItem`, `withMaxHpGrowth`, `buyBlock`, `rollShop`, `rollLoot`, `addToBag`), `scenes` (`scenesFor`, `beatView`, `sceneAssets`, `sceneTrack`, `sceneAmbience`). | Funções puras, testadas. |
| `src/state/` | `types.ts` (`RunState`, `Screen`, `GameAction`), `save.ts` (save, nível e checkpoints da história), `resume.ts` (campanha em andamento), `run.ts` (regras da run usadas pela UI), `camp.ts` + `services.ts` (acampamento), `campaign.ts`, `scenes.ts` e `reducer.ts`. | `reduce(g, action)` é a **única** forma de mudar o estado do jogo. |
| `src/ui/` | `store.ts` (estado da página, `dispatch`, render, animação do log), `events.ts` (tabela `data-a` → ação, teclado), `components.ts` (peças HTML), `views/<tela>.ts`, `audio.ts`, `settings.ts` (engrenagem de opções), `analytics.ts` (Vercel Web Analytics: eventos derivados da diferença de estado em `dispatch`; nunca envie o nome do jogador). | Views são funções `(estado) => string HTML`; não guardam estado. |

## Combate

Tudo em `engine/combat.ts`, com os números em `data/balance.ts` (`CROWD`, `POSTURE`). Camadas, todas visíveis ao jogador:

- **Intenção**: o inimigo segue um `pattern` cíclico (sem `rand`) e anuncia a próxima ação (`CombatState.intent`,
  `intentView`). Habilidade com `windup` gasta uma rodada preparando (`prep`) e acerta na seguinte. Quem consome um
  atordoamento fica `steady` (imune) na rodada seguinte.
- **Multidão** (`crowd` 0..100, `crowdView`): sobe com jogo vistoso, cai com repetição e covardia. Ovação (+dano), Golpe de
  Glória da classe (`ClassDef.glory`, só com 100), "A multidão exige mais" (salva da morte 1x) e veredito Executar/Poupar
  em luta comum (ou contra chefe com `trial`) com o inimigo ≤15% (`verdictAvailable`). O favor multiplica o ouro em `afterCombat`.
  O destino de chefe com `trial` fica em `RunState.verdicts` (vencer sem veredito conta como `executed`) e escolhe cenas (`when`).
- **Postura** (`posture`/`weak` do inimigo, `postureView`): golpes e efeitos no ponto fraco abalam; em 0 fica `broken`
  (perde a vez, +50% de dano) e recompõe ao acabar. Pontos fracos descobertos vão para `RunState.bestiary`.
- **Chefes**: `phase2` (troca de padrão e fala ao cruzar a vida indicada) e `barks` (falas, `LogEntry.bark`).
- **Perigo da arena** (`ArenaDef.hazard`, `hazardView`): avisado uma rodada antes, age no fim da rodada; Defender protege
  dos efeitos de status. `gift` cura e `harm` fere o favorito da multidão (o jogador com favor ≥ `ovationAt`, senão o inimigo).
  O golpe marca `LogEntry.hazard` (id) e `target` (o favorito, se `gift`/`harm`): a UI toca `sfx/hazard-<id>.mp3` e mostra
  `fx-<id>` no palco (keyframe por id em `style.css`; sem keyframe, `hzPop` no centro). Perigo novo precisa dos dois arquivos (`story.test.ts`).
- **Camadas por ato** (`ActDef.features`; cada ato liga as suas, números em `balance.ts`):
  - **Relíquias** (Ato II): itens `relic` com perks de gatilho (`openingStun`, `dotHunter`, `brokenHunter`, `critCrowd`, `rally`,
    `insight`, `blockReflect`, `anchor`) aplicados em `combat.ts` (`opening`, `hit`, `reactions`, `hazardTick`). Perk novo:
    campo em `Perks`, zero em `NO_PERKS`, gatilho no motor; sorteio só quando o perk existe (não mexe nas sementes).
  - **Objetivos de luta** (`GOALS`, `goalMet`): `CombatState.feats` registra item usado, desequilíbrio e golpe pesado
    bloqueado. Base de duas coisas: **Exigências da Plebe** (`features.demands`: objetivo sorteado com `fork` pela semente da
    luta comum, `demandView` na UI, ouro `DEMAND.gold × tier` em `afterCombat`) e **apostas** (serviço `bookie` da Sabina,
    `RunState.bet` = objetivo + valor em `BET.stakes`; paga valor × odds na próxima luta e, quanto maior o valor, mais forte
    o adversário dessa luta via `boost` de `createEnemyFighter`; fugir perde).
  - **Aliado** (`features.ally` = id da habilidade `ally`): ação depois da Glória, 1x por luta, com favor ≥ `ALLY.crowdAt`;
    bate com `ALLY.atk` (não com o ataque do herói) e abala a postura.
  - **Rival** (`features.rival`): quem mata o herói numa luta comum vira `SaveData.rivals[ato]` (nome com alcunha de
    `RIVAL_TITLES`, patente); `placeRival` o põe no lugar da última luta comum daquela arena nas próximas tentativas, mais forte
    por patente e pagando `RIVAL.reward`×; vencê-lo o apaga. Gladiador novo zera os rivais.
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
- **Atos e checkpoints**: `ACTS` (`data/arenas.ts`) agrupa as arenas; `ARENAS` é derivado (ids únicos entre atos).
  `SaveData.story[i]` é o herói (`RunState`) ao entrar no ato i: gravado em `startRun` (ato 0, apaga a história anterior) e
  ao vencer o último chefe de um ato (`afterCombat`, que segue direto para o próximo). Morrer encerra a run; `startAct`
  (título/resumo) restaura o checkpoint com vida cheia, nível atual e semente nova, e toca de novo a abertura do ato (`run-start` no Ato I,
  `arena-enter` da primeira arena nos outros). Rejogar um ato substitui só o checkpoint seguinte.
  Na engrenagem (`ui/settings.ts`), com confirmação: "Recomeçar o Ato N" (`restartAct`) e "Escolher ato" (`abandon`, vai ao
  título); as duas encerram a run como derrota (o XP fica). Gladiador novo só pelo título.
  Cada ato tem o seu acampamento (`ActDef.camp`: nome, fundo e a lista de ids de `NPCS`, na ordem dos botões; `campOf`).
  Item com `act` só entra na loja a partir daquele ato (o filtro não mexe nos sorteios dos atos anteriores).
- **Save**: só progressão permanente (`SaveData` em `state/save.ts`). Mudou o formato? Suba `version` e escreva a migração em
  `parseSave` mantendo o progresso de quem já joga; save inválido volta ao padrão com aviso, nunca quebra o jogo.
- **Campanha em andamento** (`state/resume.ts`, chave `RUN_KEY`): a run e a tela atual são gravadas a cada transição e
  restauradas ao recarregar a página; somem quando a run acaba (morte, prazo, campanha vencida). Estado do jogo precisa
  continuar JSON puro (nada de `Map`, `Set`, funções). Mudou `RunState`/`Screen`/`CombatState`? Suba `RUN_VERSION` (o snapshot
  antigo é descartado com aviso) e, se a tela nova tiver campos obrigatórios, valide-os em `validScreen`.
- **Assets são locais** (`public/assets/*.webp`, `public/audio/`, fontes em `public/fonts/`). Imagem que falha cai no ícone SVG (`data-fb`) ou some.

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
- NPC: um objeto em `data/npcs.ts` (`who` = pessoa em `data/characters.ts`, com nome e retrato, a mesma usada em
  `SPEAKERS`; `role`; `services`; `lines` por reação `greet`/`deal`/`poor`/`denied`) e o id no `camp.npcs` do ato. Toda
  reação precisa de uma fala sem condição; fala `{ text, when: { boss, verdict } }` só entra no sorteio se a condição valer
  (`meets`, o mesmo das cenas). Serviços prontos: `shop`, `inn` e `trainer` (com `attr`); um NPC pode ter vários. A UI
  manda `{ type: 'service', npc, value }` (os botões mantêm `data-a` `buy`/`rest`/`train`/`learn`). Serviço novo:
  variante em `ServiceDef`, função em `SERVICES` (`state/services.ts`, devolve a reação ou 'skip' sem mexer na run) e
  vitrine em `SERVICE_VIEWS` (`ui/views/camp.ts`).
- Cena: uma entrada em `data/story.ts` com `trigger` (`campaign-start`, `run-start`, `boss-intro`, `boss-defeat`,
  `arena-enter`, `act-won`, `campaign-won`) e `once: true` se só pode tocar uma vez por campanha; `when: { boss, verdict }`
  para a variante de poupar/executar (fila no fim de ato: `boss-defeat`, `act-won`, `arena-enter` do próximo); `music` e `ambience` opcionais. Falas aceitam `{nome}` e `{classe}`.
  Personagens que falam ficam em `SPEAKERS`. O herói pode ser de qualquer gênero: escreva falas sobre ele em linguagem neutra.
- Ato novo: entrada em `ACTS` (`data/arenas.ts`) com `id`, `name`, `camp` e 3 arenas, cena `act-won`; nada de motor muda.
  O roteiro dos atos fica em `docs/story/` (fora do Git).
- Arena nova: entrada nas `arenas` do ato em `data/arenas.ts` (ordem = ordem da campanha, com `hazard`) + cenas
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
(Habilidades | Básico | Itens | Registro, página em `ui.tray` no `store.ts`); acima disso (e no tablet em pé, ≥600×900)
todas as ações aparecem numa grade única e o registro vai para a coluna lateral (no tablet, numa faixa acima das ações).
No toque não há tooltip: um `title` em elemento que não é botão vira balão ao ser tocado (`showTip` em `ui/events.ts`), então
explicações curtas de chips e status vão no `title`. `render()` devolve o foco ao botão que o tinha (mesmo `data-a`/`data-v`). Ao mexer em layout, confira as telas nessas resoluções no navegador.

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

Ato II (simulação com bot que usa o acampamento inteiro: compra todo equipamento, aprende e treina; 200 campanhas). Com essa
política o Ato I fica fácil (o bot chega ao Ato II com os 12 equipamentos), então a régua do Ato II é a vida perdida por luta e
a taxa de vencer o ato na 1ª tentativa a partir do checkpoint (todas as classes vencem em até 3):

| Bot | Guerreiro | Mago | Assassino |
| --- | --- | --- | --- |
| guloso, 1ª tentativa | 92% | 69% | 97% |
| informado, 1ª tentativa | 100% | 94% | 99% |

(com relíquias, apostas, Exigências e o Chamado de Tauros; o bot usa o aliado assim que pode e aposta com ouro sobrando).
Perda média de vida (luta comum / chefe), informado: Naumáquia 4-12 / 8-25, Venatio 1-3 / 11-16, Coroação 3-10 / 10-31.
Pendências: o Mago é a classe mais difícil no Ato II (Nerissa e Draco) e o Assassino a mais fácil.

Metas: Fosso vencível por todas as classes, dificuldade crescente entre as arenas, Mago e Assassino no mesmo patamar.
O Guerreiro é a classe mais fácil para os bots.

## Git

Branch `main`. Commits pequenos e descritivos em inglês. Trabalho paralelo com agentes: cada um num worktree
(`.claude/worktrees/`, ignorado) com arquivos de responsabilidade definidos para evitar conflito; revise e rode testes,
build e navegador antes de mesclar. O Vitest também roda os testes dentro de `.claude/worktrees/`: enquanto houver worktree,
use `npx vitest run src` e remova cada worktree (`git worktree remove`) assim que mesclar. Um bom corte é motor
(`data`/`engine`/`state`) num agente e interface (`ui`/`style.css`) em outro, com a API combinada antes.
