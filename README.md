# Arena dos Gladiadores

RPG de gladiadores para navegador com campanhas roguelike e combate por turnos.
Crie um gladiador (Guerreiro, Mago ou Assassino), vença uma sequência de lutas, monte sua build no acampamento e derrote o chefe de cada arena.
A campanha atravessa três arenas em sequência com o mesmo personagem: ao derrotar o chefe, ele vira campeão e é transferido para a próxima,
levando atributos, habilidades, itens e ouro. Se morrer (ou o prazo acabar), o próximo gladiador recomeça do zero na primeira arena.
Só XP/nível e estatísticas ficam salvos no navegador (`localStorage`).

## Requisitos

Node.js 20+ e npm.

## Comandos

```bash
npm install       # instala as dependências
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm test          # testes das regras de combate e progressão (Vitest)
npm run build     # checagem de tipos + build de produção em dist/
npm run preview   # serve o build de produção localmente
```

O conteúdo de `dist/` é estático e pode ser publicado em qualquer hospedagem de arquivos.

## Estrutura

Camadas com dependência em um só sentido: `ui → state → engine → data/core`. Nada abaixo de `ui/` toca o DOM.

| Pasta | Papel |
| --- | --- |
| `src/data/` | Conteúdo puro, um arquivo por domínio: classes, inimigos, itens, habilidades, arenas, NPCs, status, atributos, balanceamento e história (`story.ts`). |
| `src/core/` | Utilitários sem regra de jogo (RNG determinístico com semente no estado). |
| `src/engine/` | Motores puros: `combat` (rodadas), `characters` (pipeline de modificadores, fábrica de jogador/inimigo), `items` (aquisição, loja, validação de compra), `scenes` (gatilhos, fala pronta para exibir, assets). |
| `src/state/` | Estado do jogo: tipos, save, regras da run, ações do acampamento, fluxo da campanha, fila de cenas e o `reduce` que delega por domínio. |
| `src/ui/` | Interface: `store` (estado da página, render, animação), `events` (tabela `data-a` → ação, teclado), `components` (peças HTML) e uma view por tela em `views/`. |
| `src/**/*.test.ts` | Testes ao lado do módulo que testam. |
| `public/assets/`, `public/audio/` | Pixel art (WebP), música e efeitos. |
| `scripts/` | Prompts usados no Codex e o script que converte as imagens geradas. |

### Como adicionar conteúdo

- **Item, inimigo ou classe**: uma entrada em `data/items.ts`, `data/enemies.ts` ou `data/classes.ts`. O motor de personagens aplica bônus e escala; item que aumenta vida máxima já cura o mesmo tanto na compra.
- **Cena**: uma entrada em `data/story.ts` com `trigger` (`campaign-start`, `run-start`, `boss-intro`, `boss-defeat`, `arena-enter`, `campaign-won`) e `once` se só deve tocar uma vez. Nenhuma mudança no reducer.

## Arte (pixel art)

As imagens foram geradas com o Codex CLI (`image_generation`) a partir dos prompts em `scripts/asset-prompts/`
e convertidas por `scripts/process_assets.py` (recorte do fundo magenta, redução e WebP sem perdas).
Para regenerar:

```bash
cd pasta-temporaria
codex exec --skip-git-repo-check -s workspace-write - < caminho/do/projeto/scripts/asset-prompts/1-characters-enemies.txt
python caminho/do/projeto/scripts/process_assets.py .   # requer Pillow
```

Todas as imagens são locais. Se alguma não carregar, o jogo usa o ícone SVG equivalente (ou omite a imagem) e continua jogável.

## História

Ao começar uma campanha, a vila do personagem (Vale de Corvara) é atacada pelo General Caius Varro, os pais são mortos
e ele é levado ao ludus, onde Varro promete a liberdade a quem conquistar as três arenas. Há cenas na chegada e na derrota
de cada chefe, nas transferências entre arenas e um epílogo. Todas podem ser puladas (botão ou Esc); Enter/Espaço avançam.

## Regras principais

- Cada rodada: o jogador escolhe **uma** ação; o inimigo escolhe a sua; age primeiro quem tem mais velocidade (empate favorece o jogador). **Defender** sempre age antes.
- Energia: habilidades têm custo; ação sem energia é rejeitada. Regenera no fim de cada rodada até o máximo.
- Efeitos (veneno, queimadura, guarda, enfraquecimento, regeneração) duram N rodadas e são processados no fim da rodada; veneno acumula. Atordoamento dura até consumir a próxima ação.
- **Atributos**: Força (+1 ataque, +5 vida), Destreza (+1 velocidade, +3% crítico) e Sabedoria (+1 magia, +1 energia) por ponto treinado.
  Cada habilidade é ligada a um atributo: ganha +0,5 de dano (ou +3 de cura) por ponto e exige um mínimo para ser aprendida. Máximo de 4 habilidades.
- **Fuga**: Destreza + d10 contra Destreza + d10 do inimigo. Falhou: golpe de oportunidade. Fugir de inimigo comum pula a luta sem recompensa; fugir do chefe só adia.
- **Acampamento** (entre as lutas): mercador (itens), três treinadores (atributo e habilidades) e estalagem (descanso pago 50% da vida; sem ouro, estábulo 20%).
  Treinar, aprender, descansar e lutar gastam 1 dia; comprar não. Cada arena tem um prazo em dias: se o chefe não cair até lá, a temporada acaba.
- Derrota simultânea (ex.: veneno nos dois, espinhos no golpe final) é empate e conta como derrota da campanha.
- **Nível permanente**: passar do nível N para N+1 custa 100 × N de XP; cada nível dá +4 de vida e +10 de ouro inicial.
- Curas no fim da rodada não revivem quem chegou a 0.
- Save inválido ou corrompido é descartado com aviso na tela inicial.
