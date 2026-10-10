import type { NpcDef, NpcId } from './types';

export const NPCS: Record<NpcId, NpcDef> = {
  merchant: {
    id: 'merchant', name: 'Cássio', role: 'Mercador',
    greet: ['Aço bom, preço justo! Bem... quase justo.', 'Sobreviveu de novo? Isso pede equipamento novo!', 'Tudo aqui já salvou a vida de alguém. Às vezes.'],
    deal: ['Ótima escolha! Use com sabedoria.', 'Negócio fechado. Volte vivo, preciso de clientes.', 'Isso vai fazer a multidão gritar seu nome!'],
    poor: ['Sem moedas, sem mercadoria, gladiador.', 'Volte quando seu bolso pesar mais que sua espada.'],
    denied: ['Você já carrega um desses.'],
  },
  inn: {
    id: 'inn', name: 'Marta', role: 'Estalajadeira',
    greet: ['Cama quente e ensopado, por um punhado de moedas.', 'Você parece um saco de pancadas. Descanse um pouco.'],
    deal: ['Durma bem. A arena não vai a lugar nenhum.', 'Coma tudo, está magro demais para morrer amanhã.'],
    poor: ['Sem moedas? O estábulo está livre... e os cavalos quase não roncam.'],
    denied: ['Você já está em plena forma. Vá lutar!'],
  },
  str: {
    id: 'str', name: 'Brutus', role: 'Treinador de Força',
    greet: ['Músculo não cresce sozinho. Pegue essa pedra!', 'Lutei vinte anos naquela areia. Quer aprender a bater de verdade?'],
    deal: ['Ha! Sentiu isso? É força nova nos braços.', 'Mais um golpe desses e nem o Tauros fica de pé.'],
    poor: ['Treino custa. Nem eu levanto peso de graça.'],
    denied: ['Fraco demais para essa técnica. Treine Força primeiro.', 'Sua cabeça já está cheia de golpes. Não cabe mais nenhum.'],
  },
  dex: {
    id: 'dex', name: 'Lyra', role: 'Treinadora de Destreza',
    greet: ['Quem acerta primeiro vive mais. Vamos ver seus pés.', 'Leveza, precisão e uma lâmina no lugar certo.'],
    deal: ['Mais rápido que a própria sombra. Bom trabalho.', 'Agora você vê o golpe antes de ele existir.'],
    poor: ['Minhas lições não são de graça, querido.'],
    denied: ['Lento demais para isso. Treine Destreza comigo antes.', 'Você já sabe técnicas demais. Foco é tudo.'],
  },
  wis: {
    id: 'wis', name: 'Mestre Oren', role: 'Treinador de Sabedoria',
    greet: ['A mente é a lâmina mais afiada. Sente-se.', 'O fogo obedece a quem entende o fogo.'],
    deal: ['Sinto a energia fluindo em você. Excelente.', 'Mais um véu levantado. Siga estudando.'],
    poor: ['O conhecimento é livre. Meu tempo, não.'],
    denied: ['Ainda não está pronto para este tomo. Medite mais.', 'Sua mente está cheia. Domine o que já sabe.'],
  },
};
