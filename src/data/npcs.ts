import type { Condition, NpcDef } from './types';

// Falas que dependem do destino de Nerissa (chefe julgável da Naumáquia).
const nerissaSpared: Condition = { boss: 'nerissa', verdict: 'spared' };
const nerissaExecuted: Condition = { boss: 'nerissa', verdict: 'executed' };

/**
 * NPCs do acampamento: pessoa (`who`), cargo, serviços e falas. Cada ato escolhe quais estão no seu acampamento
 * (`ActDef.camp.npcs`); o mesmo NPC pode servir em vários atos. Fala com `when` só entra no sorteio se a condição valer.
 */
export const NPCS: Record<string, NpcDef> = {
  // ---------- Ato I: Ludus do Fosso ----------
  cassio: {
    id: 'cassio', who: 'cassio', role: 'Mercador', services: [{ kind: 'shop' }],
    lines: {
      greet: ['Aço bom, preço justo! Bem... quase justo.', 'Sobreviveu de novo? Isso pede equipamento novo!', 'Tudo aqui já salvou a vida de alguém. Às vezes.'],
      deal: ['Ótima escolha! Use com sabedoria.', 'Negócio fechado. Volte vivo, preciso de clientes.', 'Isso vai fazer a multidão gritar seu nome!'],
      poor: ['Sem moedas, sem mercadoria, gladiador.', 'Volte quando seu bolso pesar mais que sua espada.'],
      denied: ['Você já carrega um desses.'],
    },
  },
  marta: {
    id: 'marta', who: 'marta', role: 'Estalajadeira', services: [{ kind: 'inn' }],
    lines: {
      greet: [
        'Cama quente e ensopado, por um punhado de moedas.', 'Você parece um saco de pancadas. Descanse um pouco.',
        { text: 'Ouvi que você poupou aquela víbora no lago. Coração grande demais para a arena... e eu gosto disso.', when: nerissaSpared },
        { text: 'Coma. Depois do que fez no lago, precisa de mais que ensopado para dormir.', when: nerissaExecuted },
      ],
      deal: ['Durma bem. A arena não vai a lugar nenhum.', 'Coma tudo, está magro demais para morrer amanhã.'],
      poor: ['Sem moedas? O estábulo está livre... e os cavalos quase não roncam.'],
      denied: ['Você já está em plena forma. Vá lutar!'],
    },
  },
  brutus: {
    id: 'brutus', who: 'brutus', role: 'Treinador de Força', services: [{ kind: 'trainer', attr: 'str' }],
    lines: {
      greet: ['Músculo não cresce sozinho. Pegue essa pedra!', 'Lutei vinte anos naquela areia. Quer aprender a bater de verdade?'],
      deal: ['Ha! Sentiu isso? É força nova nos braços.', 'Mais um golpe desses e nem o Tauros fica de pé.'],
      poor: ['Treino custa. Nem eu levanto peso de graça.'],
      denied: ['Fraco demais para essa técnica. Treine Força primeiro.', 'Sua cabeça já está cheia de golpes. Não cabe mais nenhum.'],
    },
  },
  lyra: {
    id: 'lyra', who: 'lyra', role: 'Treinadora de Destreza', services: [{ kind: 'trainer', attr: 'dex' }],
    lines: {
      greet: [
        'Quem acerta primeiro vive mais. Vamos ver seus pés.', 'Leveza, precisão e uma lâmina no lugar certo.',
        { text: 'Clemência no lago... A multidão nunca esquece quem baixa a lâmina na hora certa.', when: nerissaSpared },
        { text: 'Golpe limpo na Naumáquia. Frio, como eu ensinei.', when: nerissaExecuted },
      ],
      deal: ['Mais rápido que a própria sombra. Bom trabalho.', 'Agora você vê o golpe antes de ele existir.'],
      poor: ['Minhas lições não são de graça, querido.'],
      denied: ['Lento demais para isso. Treine Destreza comigo antes.', 'Você já sabe técnicas demais. Foco é tudo.'],
    },
  },
  oren: {
    id: 'oren', who: 'oren', role: 'Treinador de Sabedoria', services: [{ kind: 'trainer', attr: 'wis' }],
    lines: {
      greet: [
        'A mente é a lâmina mais afiada. Sente-se.', 'O fogo obedece a quem entende o fogo.',
        { text: 'Poupar é mais difícil que matar. A mente que escolhe isso está pronta para o que vem.', when: nerissaSpared },
        { text: 'O sangue no lago já secou. O que você carrega por dentro, ainda não.', when: nerissaExecuted },
      ],
      deal: ['Sinto a energia fluindo em você. Excelente.', 'Mais um véu levantado. Siga estudando.'],
      poor: ['O conhecimento é livre. Meu tempo, não.'],
      denied: ['Ainda não está pronto para este tomo. Medite mais.', 'Sua mente está cheia. Domine o que já sabe.'],
    },
  },
  // ---------- Ato II: Ludus da Subura ----------
  sabina: {
    id: 'sabina', who: 'sabina', role: 'Mercadora da Subura', services: [{ kind: 'shop' }],
    lines: {
      greet: [
        'Na Subura tudo tem preço. Inclusive o que não está à venda.', 'Campeão da plebe! Para você, desconto nenhum, mas sorriso grátis.',
        'Isto aqui caiu de uma galera imperial. Não pergunte qual.',
        { text: 'Dizem que Nerissa anda pelas docas, viva, perguntando por você. Essa informação é de graça. A próxima, não.', when: nerissaSpared },
        { text: 'Quem apostou na Serpente perdeu até a túnica. Eu? Apostei em você.', when: nerissaExecuted },
      ],
      deal: ['Bom negócio. Para mim, principalmente.', 'Vai fazer barulho na arena. E eu vou lucrar com as apostas.', 'Use bem. Clientes mortos não voltam.'],
      poor: ['Sem moedas? A Subura não fia, gladiador.', 'Volte quando a plebe tiver jogado ouro na areia por você.'],
      denied: ['Sua bolsa já está cheia. Ninguém carrega a Subura inteira nas costas.'],
    },
  },
  tauros: {
    id: 'tauros', who: 'tauros', role: 'Treinador de Força', services: [{ kind: 'trainer', attr: 'str' }],
    lines: {
      greet: [
        'Dez anos invicto me ensinaram uma coisa: o braço cansa, a vontade não.', 'Levanta essa âncora. Se cair, levanta de novo.',
        { text: 'Poupou a Serpente? Eu teria hesitado. Mas a plebe gostou, e é a plebe que assusta Varro.', when: nerissaSpared },
        { text: 'A Rainha das Marés não volta mais. Não perca o sono: ela nunca perdeu o dela.', when: nerissaExecuted },
      ],
      deal: ['Isso! Agora até eu pensaria duas vezes antes de te enfrentar.', 'Bom. Varro vai sentir esse golpe na tribuna.'],
      poor: ['Eu treino de graça. A comida e o ferro, não.'],
      denied: ['Ainda não tem braço para isso. Treine Força comigo antes.', 'Golpe demais na cabeça atrapalha. Escolha os que importam.'],
    },
  },
};
