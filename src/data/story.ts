// História da campanha. Somente dados: quem fala, onde e o quê. Cada cena declara o gatilho que a faz tocar (engine/scenes.ts).
// Texto aceita {nome} (nome do gladiador) e {classe}.

export type SpeakerId =
  | 'narrator' | 'hero' | 'general' | 'mother' | 'father'
  | 'brutus' | 'marta' | 'lyra' | 'oren' | 'tauros' | 'serpent' | 'emperor';

export interface Speaker {
  name: string;
  art?: string; // asset do retrato; o herói usa o sprite da classe escolhida
  side: 'left' | 'right';
}

export interface Beat {
  who: SpeakerId;
  text: string;
  bg?: string; // troca o fundo a partir desta fala; senão mantém o anterior
  ambience?: Ambience | null; // troca (ou corta, com null) o som ambiente a partir desta fala
}

/** Evento do jogo que dispara cenas. */
export type SceneEvent =
  | { on: 'campaign-start' } // Nova campanha, antes da criação do gladiador
  | { on: 'run-start' } // gladiador criado, chegada ao ludus
  | { on: 'boss-intro'; boss: string } // entrando na luta contra o chefe
  | { on: 'boss-defeat'; boss: string }
  | { on: 'arena-enter'; arena: string } // transferência para uma nova arena
  | { on: 'campaign-won' }; // última arena conquistada

/** Faixas de música do jogo (arquivos em public/audio/<faixa>.mp3). */
export type MusicTrack = 'menu' | 'battle' | 'boss' | 'first-scene';

/** Som ambiente em loop por baixo da música nas cenas (public/audio/amb/<nome>.mp3). */
export type Ambience = 'village-raid' | 'arena-crowd' | 'arena-cheer';

export interface SceneDef {
  id: string;
  trigger: SceneEvent;
  once?: boolean; // toca no máximo uma vez por campanha (fugir e voltar não repete)
  title: string;
  bg: string;
  music?: MusicTrack;
  ambience?: Ambience;
  beats: Beat[];
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  narrator: { name: '', side: 'right' },
  hero: { name: '{nome}', side: 'left' },
  general: { name: 'General Caius Varro', art: 'npc-general', side: 'right' },
  mother: { name: 'Helena', art: 'npc-mother', side: 'right' },
  father: { name: 'Marcus', art: 'npc-father', side: 'right' },
  brutus: { name: 'Brutus', art: 'npc-str', side: 'right' },
  marta: { name: 'Marta', art: 'npc-inn', side: 'right' },
  lyra: { name: 'Lyra', art: 'npc-dex', side: 'right' },
  oren: { name: 'Mestre Oren', art: 'npc-wis', side: 'right' },
  tauros: { name: 'Tauros, o Campeão', art: 'tauros', side: 'right' },
  serpent: { name: 'Nerissa, a Rainha Serpente', art: 'serpent', side: 'right' },
  emperor: { name: 'Aurelius, o Imperador Caído', art: 'emperor', side: 'right' },
};

const scenes: SceneDef[] = [
  {
    id: 'prologue-village', trigger: { on: 'campaign-start' }, title: 'Vale de Corvara', bg: 'bg-village', music: 'first-scene', ambience: 'village-raid',
    beats: [
      { who: 'narrator', text: 'Vale de Corvara. Uma vila de pastores, longe das guerras do Império. Até aquela noite.' },
      { who: 'father', text: 'Fogo nos celeiros! São soldados... com o estandarte do dragão!' },
      { who: 'mother', text: 'Pegue a faca do seu pai e fuja pela trilha do rio. Não olhe para trás, meu amor.' },
      { who: 'hero', text: 'Eu não vou deixar vocês aqui!' },
      { who: 'general', text: 'Que comovente. Revistem as casas. Quero todos os jovens fortes acorrentados até o amanhecer.' },
      { who: 'father', text: 'Somos gente simples, general! Não temos nada que o senhor queira!' },
      { who: 'general', text: 'Vocês têm braços. E a arena tem fome. O resto... é só lenha.' },
      { who: 'narrator', text: 'A espada do general foi rápida. Marcus caiu primeiro. Helena, logo depois, ainda segurando sua mão.' },
      { who: 'mother', text: 'Viva... e não deixe que ele apague quem você é.' },
      { who: 'general', text: 'Acorrentem esse aí. Tem fogo nos olhos, e fogo vende ingressos.' },
      { who: 'narrator', text: 'Correntes, uma carroça-jaula e três dias de estrada. No fim dela, um escrivão com um livro de registros.', bg: 'bg-road', ambience: null },
    ],
  },
  {
    id: 'prologue-ludus', trigger: { on: 'run-start' }, title: 'O ludus do Fosso', bg: 'bg-title', music: 'first-scene',
    beats: [
      { who: 'narrator', text: 'Ludus do Fosso de Areia. O cheiro de sangue e areia nunca sai daqui.' },
      { who: 'general', text: '{nome}. Um nome curto, para uma vida que pode ser curta. Escute bem, porque não repito.' },
      { who: 'general', text: 'Tenho três arenas: o Fosso, o Coliseu e a Arena Rubra. Cada uma tem um campeão que me rende mais ouro que uma província.' },
      { who: 'general', text: 'Derrube os três e eu mesmo assinarei sua carta de alforria. Palavra de Caius Varro.' },
      { who: 'hero', text: 'Você matou meus pais.' },
      { who: 'general', text: 'Matei dois camponeses. Você ainda pode virar uma lenda. Escolha bem o que vai lembrar.' },
      { who: 'brutus', text: 'Ei, novato. Respira. Eu também cheguei acorrentado, há vinte anos. Hoje treino quem ainda tem chance.' },
      { who: 'brutus', text: 'Varro nunca quebra uma promessa feita na frente da multidão. Vire campeão das três arenas e ele vai ter que cumprir.' },
      { who: 'marta', text: 'E ninguém luta de barriga vazia. Toma, ensopado. De graça só hoje; amanhã a gente fala de preço.' },
      { who: 'brutus', text: 'Treine, compre o que puder, descanse quando precisar. E não deixe o prazo correr: Varro odeia esperar.' },
    ],
  },
  // ---------- Fosso de Areia ----------
  {
    id: 'boss-intro-tauros', trigger: { on: 'boss-intro', boss: 'tauros' }, once: true, title: 'O Campeão do Fosso', bg: 'bg-pit', music: 'boss', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'O portão de ferro range. A multidão do Fosso se levanta de uma vez.' },
      { who: 'tauros', text: 'Mais um filhote do Varro. Já perdi a conta de quantos ele me mandou.' },
      { who: 'tauros', text: 'Dez anos invicto nesta areia. Sabe por quê? Eu não luto pela multidão. Luto para continuar respirando.' },
      { who: 'hero', text: 'Eu luto pela minha liberdade.' },
      { who: 'tauros', text: 'Liberdade... Ele prometeu isso para mim também. Mostre se a sua fé é tão dura quanto o meu chifre!' },
    ],
  },
  {
    id: 'boss-defeat-tauros', trigger: { on: 'boss-defeat', boss: 'tauros' }, title: 'A queda do touro', bg: 'bg-pit', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'Tauros cai de joelhos. O machado escorrega das mãos enormes.' },
      { who: 'tauros', text: 'Bom golpe... Faz tempo que ninguém me derrubava.' },
      { who: 'tauros', text: 'Escute. Varro me prometeu a alforria se eu vencesse cem lutas. Na nonagésima nona, ele mudou a regra.' },
      { who: 'tauros', text: 'Não confie na palavra dele. Confie na multidão: é a única coisa que ele teme.' },
      { who: 'hero', text: 'Por que está me contando isso?' },
      { who: 'tauros', text: 'Porque você me lembrou de quem eu era antes das correntes. Vá. E não volte para esta areia.' },
    ],
  },
  {
    id: 'transfer-colosseum', trigger: { on: 'arena-enter', arena: 'colosseum' }, title: 'Rumo ao Coliseu', bg: 'bg-road',
    beats: [
      { who: 'narrator', text: 'Na manhã seguinte, uma carruagem com o brasão do dragão espera no portão do ludus.' },
      { who: 'general', text: 'Campeão do Fosso! Os apostadores choraram e eu lucrei. Ótimo trabalho, {nome}.' },
      { who: 'general', text: 'O Coliseu de Pedra é outro mundo. Lá reina a Rainha Serpente, minha favorita. Tente não decepcioná-la.' },
      { who: 'marta', text: 'Embrulhei pão e queijo. E não me olhe assim: o ludus inteiro vai junto. Quem mais cuidaria de você?' },
      { who: 'brutus', text: 'Tauros era um bom homem. Se ele te disse algo antes de cair, guarde no peito.' },
      { who: 'narrator', text: 'A carruagem segue para o Coliseu de Pedra. Atrás, a poeira do Fosso some no horizonte.' },
    ],
  },
  // ---------- Coliseu de Pedra ----------
  {
    id: 'boss-intro-serpent', trigger: { on: 'boss-intro', boss: 'serpent' }, once: true, title: 'A Rainha do Coliseu', bg: 'bg-colosseum', music: 'boss', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'Pétalas caem das arquibancadas. O Coliseu inteiro canta um nome: Nerissa.' },
      { who: 'serpent', text: 'Então é você o camponês que derrubou o meu touro favorito. Que adorável.' },
      { who: 'serpent', text: 'Sabe, eu estava lá naquela noite, no Vale de Corvara. Varro adora levar plateia para as caçadas.' },
      { who: 'hero', text: '...Você viu meus pais morrerem.' },
      { who: 'serpent', text: 'Vi muita coisa morrer. Venha. Me dê um motivo para lembrar de você.' },
    ],
  },
  {
    id: 'boss-defeat-serpent', trigger: { on: 'boss-defeat', boss: 'serpent' }, title: 'A coroa torta', bg: 'bg-colosseum', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'A Rainha Serpente recua, ofegante, com a coroa torta na cabeça.' },
      { who: 'serpent', text: 'Impressionante... Ninguém me tocou em sete temporadas.' },
      { who: 'serpent', text: 'Vou te dar um presente, já que a Arena Rubra vai te matar de qualquer jeito: o ataque à sua vila não foi acaso.' },
      { who: 'serpent', text: 'Varro precisava de sangue novo para o espetáculo do Imperador. Escolheu as vilas que não podiam reclamar.' },
      { who: 'hero', text: 'Então tudo isso... foi para encher uma arena.' },
      { who: 'serpent', text: 'Tudo é para encher uma arena. Até eu.' },
    ],
  },
  {
    id: 'transfer-crimson', trigger: { on: 'arena-enter', arena: 'crimson' }, title: 'A estrada vermelha', bg: 'bg-road',
    beats: [
      { who: 'narrator', text: 'A estrada para a Arena Rubra atravessa campos queimados. Ninguém na carruagem fala por horas.' },
      { who: 'general', text: 'Dois títulos. A plebe já grita o seu nome nas tavernas. Isso me deixa... curioso.' },
      { who: 'general', text: 'Na Arena Rubra luta o Imperador Caído. Um homem que um dia acreditou que mandava em mim.' },
      { who: 'oren', text: 'A Arena Rubra foi erguida sobre um templo. Dizem que quem morre lá não descansa. Prepare a mente, não só a espada.' },
      { who: 'lyra', text: 'Seus pés estão mais leves do que quando você chegou. Mantenha assim, e o coração frio.' },
      { who: 'narrator', text: 'No horizonte, uma lua vermelha nasce sobre muralhas negras.' },
    ],
  },
  // ---------- Arena Rubra ----------
  {
    id: 'boss-intro-emperor', trigger: { on: 'boss-intro', boss: 'emperor' }, once: true, title: 'O trono de ossos', bg: 'bg-crimson', music: 'boss', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'Os braseiros acendem sozinhos. Uma figura coroada se ergue de um trono de ossos.' },
      { who: 'emperor', text: 'Varro ainda manda crianças morrerem por ele? Eu já fui imperador. Sabe quem me tirou o trono?' },
      { who: 'emperor', text: 'Meu general mais leal. Ele me envenenou, e um feiticeiro prendeu minha alma a esta arena para divertir a plebe para sempre.' },
      { who: 'hero', text: 'Então somos dois prisioneiros dele.' },
      { who: 'emperor', text: 'Somos. Mas só um de nós sai daqui. Lute, então. E, se vencer... liberte este velho também.' },
    ],
  },
  {
    id: 'boss-defeat-emperor', trigger: { on: 'boss-defeat', boss: 'emperor' }, title: 'O silêncio', bg: 'bg-crimson',
    beats: [
      { who: 'narrator', text: 'A chama violeta se apaga. A coroa do Imperador Caído rola pela areia vermelha.' },
      { who: 'emperor', text: 'Ah... silêncio, enfim. Obrigado, {nome}.' },
      { who: 'emperor', text: 'Ouça: Varro não quer ouro. Quer o trono que tirou de mim. A arena é só o jeito de comprar a multidão.' },
      { who: 'emperor', text: 'Ele vai cumprir a promessa, porque milhares estão olhando. Mas não esqueça: tronos se erguem sobre promessas quebradas.' },
      { who: 'narrator', text: 'O corpo vira cinzas. Pela primeira vez em séculos, a Arena Rubra fica em silêncio.' },
    ],
  },
  {
    id: 'epilogue', trigger: { on: 'campaign-won' }, title: 'Liberdade', bg: 'bg-crimson', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'Milhares de vozes gritam o seu nome. Caius Varro desce até a areia, sorrindo para a plateia.' },
      { who: 'general', text: 'Cidadãos! Prometi liberdade ao campeão das três arenas. Caius Varro cumpre a sua palavra!' },
      { who: 'general', text: 'Aproveite, {nome}. Liberdade é só uma arena maior. E eu sou dono de todas elas.' },
      { who: 'hero', text: 'Um dia eu volto. E nesse dia não vai haver multidão para te proteger.' },
      { who: 'general', text: 'Estarei esperando. Seria um desperdício perder um talento assim.' },
      { who: 'narrator', text: 'Você cruza o portão sem correntes. Atrás, o dragão de Varro tremula ao vento. Esta história ainda não acabou.', bg: 'bg-title', ambience: null },
    ],
  },
];

export const SCENES: Record<string, SceneDef> = Object.fromEntries(scenes.map((s) => [s.id, s]));
