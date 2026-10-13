// História da campanha. Somente dados: quem fala, onde e o quê. Cada cena declara o gatilho que a faz tocar (engine/scenes.ts).
// Texto aceita {nome} (nome do gladiador) e {classe}.
import { CHARACTERS } from './characters';
import type { Condition } from './types';

export type SpeakerId =
  | 'narrator' | 'hero' | 'general' | 'mother' | 'father'
  | 'brutus' | 'marta' | 'lyra' | 'oren' | 'tauros' | 'serpent' | 'emperor'
  | 'taurosFree' | 'herald' | 'varro' | 'nerissa' | 'hannibal' | 'draco';

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
  | { on: 'act-won'; act: string } // última arena do ato conquistada (antes da chegada ao ato seguinte)
  | { on: 'campaign-won' }; // última arena do último ato conquistada

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
  /** Só toca se o chefe `boss` foi julgado assim (chefe derrotado sem veredito conta como executado). */
  when?: Condition;
  beats: Beat[];
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  narrator: { name: '', side: 'right' },
  hero: { name: '{nome}', side: 'left' },
  general: { name: 'General Caius Varro', art: 'npc-general', side: 'right' },
  mother: { name: 'Helena', art: 'npc-mother', side: 'right' },
  father: { name: 'Marcus', art: 'npc-father', side: 'right' },
  brutus: { ...CHARACTERS.brutus, side: 'right' },
  marta: { ...CHARACTERS.marta, side: 'right' },
  lyra: { ...CHARACTERS.lyra, side: 'right' },
  oren: { ...CHARACTERS.oren, side: 'right' },
  tauros: { name: 'Tauros, o Campeão', art: 'tauros', side: 'right' },
  serpent: { name: 'Nerissa, a Rainha Serpente', art: 'serpent', side: 'right' },
  emperor: { name: 'Aurelius, o Imperador Caído', art: 'emperor', side: 'right' },
  // Ato II
  taurosFree: { ...CHARACTERS.tauros, side: 'right' },
  herald: { name: 'Arauto Imperial', art: 'npc-herald', side: 'right' },
  varro: { name: 'Imperador Caius Varro', art: 'npc-varro', side: 'right' },
  nerissa: { name: 'Nerissa, Rainha das Marés', art: 'nerissa', side: 'right' },
  hannibal: { name: 'Aníbal, o Domador', art: 'hannibal', side: 'right' },
  draco: { name: 'Draco', art: 'draco', side: 'right' },
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
    id: 'epilogue', trigger: { on: 'act-won', act: 'chains' }, title: 'Liberdade', bg: 'bg-crimson', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'Milhares de vozes gritam o seu nome. Caius Varro desce até a areia, sorrindo para a plateia.' },
      { who: 'general', text: 'Cidadãos! Prometi liberdade ao campeão das três arenas. Caius Varro cumpre a sua palavra!' },
      { who: 'general', text: 'Aproveite, {nome}. Liberdade é só uma arena maior. E eu sou dono de todas elas.' },
      { who: 'hero', text: 'Um dia eu volto. E nesse dia não vai haver multidão para te proteger.' },
      { who: 'general', text: 'Estarei esperando. Seria um desperdício perder um talento assim.' },
      { who: 'narrator', text: 'Você cruza o portão sem correntes. Atrás, o dragão de Varro tremula ao vento. Esta história ainda não acabou.', bg: 'bg-title', ambience: null },
    ],
  },

  // ================= Ato II: O Juramento =================
  {
    id: 'act2-opening', trigger: { on: 'arena-enter', arena: 'naumachia' }, title: 'O Juramento', bg: 'bg-corvara', music: 'first-scene',
    beats: [
      { who: 'narrator', text: 'Três luas depois. O Vale de Corvara ainda cheira a cinza, mas o mato já cobre as ruínas.' },
      { who: 'hero', text: 'Prometi voltar. Só não achei que voltaria para cá primeiro.' },
      { who: 'taurosFree', text: 'Achei que fosse te encontrar aqui. Quem perde a casa sempre volta para olhar as cinzas.' },
      { who: 'hero', text: 'Tauros?! Você jurou que nunca mais pisaria numa arena.' },
      { who: 'taurosFree', text: 'E não piso. Mas escute: Varro foi aclamado imperador. Para festejar, vai dar os Jogos da Coroação.' },
      { who: 'taurosFree', text: 'Naquela noite ele não levou só você. Levou todos os jovens deste vale. Estão acorrentados no ludus imperial.' },
      { who: 'hero', text: 'Estão vivos...?' },
      { who: 'taurosFree', text: 'Por enquanto. Há uma tradição antiga: o campeão dos Jogos pode pedir uma graça ao imperador, diante da multidão.' },
      { who: 'taurosFree', text: 'Com milhares olhando, ele não pode recusar. É a única corrente que prende Varro.' },
      { who: 'narrator', text: 'Na Subura, o bairro mais pobre da capital, um ludus caindo aos pedaços espera por {nome}.', bg: 'bg-subura' },
      { who: 'brutus', text: 'Fiquei velho demais para a capital. Volto ao Fosso: alguém precisa cuidar dos novatos que Varro ainda manda para lá.' },
      { who: 'brutus', text: 'Tauros cuida do seu braço agora. E não deixe ninguém dizer que você voltou às correntes à toa.' },
      { who: 'marta', text: 'Montei a cozinha aqui mesmo. Lyra e Oren vieram junto. Ninguém fica para trás, nem você.' },
      { who: 'herald', text: 'Por ordem do Imperador Caius Varro! Os Jogos da Coroação estão abertos a todo gladiador, escravo ou livre!', bg: 'bg-naumachia', ambience: 'arena-crowd' },
      { who: 'herald', text: 'Quem é livre e quer lutar, que faça o juramento do auctoratus!' },
      { who: 'hero', text: 'Aceito ser queimado, acorrentado, açoitado e morto pelo ferro.' },
      { who: 'narrator', text: 'Com essas palavras, {nome} volta a pertencer à arena. Desta vez, por escolha.' },
    ],
  },
  // ---------- Naumáquia ----------
  {
    id: 'boss-intro-nerissa', trigger: { on: 'boss-intro', boss: 'nerissa' }, once: true, title: 'A Rainha das Marés', bg: 'bg-naumachia', music: 'boss', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'As comportas se abrem e o lago imperial engole a areia. Uma galera dourada desliza até o centro.' },
      { who: 'nerissa', text: 'Olhe só quem voltou. Por sua causa, Varro me tirou do Coliseu e me jogou na água com os peixes.' },
      { who: 'nerissa', text: 'Sete temporadas de glória, perdidas para um camponês. Hoje eu cobro, com juros.' },
      { who: 'hero', text: 'Você viu meus pais morrerem. Eu não esqueci.' },
      { who: 'nerissa', text: 'Ótimo. Lembre-se disso enquanto afunda.' },
    ],
  },
  {
    id: 'boss-spared-nerissa', trigger: { on: 'boss-defeat', boss: 'nerissa' }, when: { boss: 'nerissa', verdict: 'spared' }, title: 'Clemência na água', bg: 'bg-naumachia', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'Nerissa cai de joelhos na água rasa. A multidão espera o veredito... e {nome} baixa a arma.' },
      { who: 'nerissa', text: 'Você... me poupou? Ninguém nesta cidade faz isso.' },
      { who: 'nerissa', text: 'Então tome outro presente: o campeão de Varro, Draco. O dragão também nasceu no seu vale.' },
      { who: 'hero', text: 'O quê? Ninguém de Corvara lutaria por Varro.' },
      { who: 'nerissa', text: 'Ninguém escolhe o que vira quando é criado numa jaula. E não me olhe assim: um dia eu pago essa dívida.' },
    ],
  },
  {
    id: 'boss-executed-nerissa', trigger: { on: 'boss-defeat', boss: 'nerissa' }, when: { boss: 'nerissa', verdict: 'executed' }, title: 'A maré baixa', bg: 'bg-naumachia', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'O último golpe cai. A água do lago imperial fica vermelha, e a multidão grita até perder a voz.' },
      { who: 'nerissa', text: 'Hah... nem a serpente escapa da arena...' },
      { who: 'nerissa', text: 'Um último segredo, de graça: Draco, o campeão de Varro... o dragão também nasceu no seu vale.' },
      { who: 'hero', text: 'Draco... de Corvara?' },
      { who: 'narrator', text: 'A Rainha das Marés afunda. Ninguém na arquibancada lembra que um dia ela teve outro nome.' },
    ],
  },
  {
    id: 'transfer-venatio', trigger: { on: 'arena-enter', arena: 'venatio' }, title: 'As jaulas', bg: 'bg-venatio',
    beats: [
      { who: 'narrator', text: 'Sob a Venatio há um labirinto de jaulas. O cheiro de fera e de medo sobe pelos alçapões.' },
      { who: 'taurosFree', text: 'Foi aqui que eu fui parar depois do Fosso. Varro me vendeu para servir de isca aos leões.' },
      { who: 'taurosFree', text: 'Um domador, Aníbal, abriu a jaula errada de propósito. Eu fugi. Ele nunca contou para ninguém.' },
      { who: 'hero', text: 'E agora ele é o campeão daqui?' },
      { who: 'taurosFree', text: 'Aníbal deve a Varro a vida da filha. Não espere misericórdia dele. Mas também não espere ódio.' },
      { who: 'oren', text: 'As feras sentem o medo antes de o golpe chegar. Respire devagar, e elas hesitam.' },
    ],
  },
  // ---------- Venatio ----------
  {
    id: 'boss-intro-hannibal', trigger: { on: 'boss-intro', boss: 'hannibal' }, once: true, title: 'O Domador', bg: 'bg-venatio', music: 'boss', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'Os alçapões se abrem. Um leão de guerra salta para a areia, e atrás dele vem um homem com cicatrizes de garras.' },
      { who: 'hannibal', text: 'Então é você que o Tauros treina. Ele está bem? Não responda. É melhor eu não saber.' },
      { who: 'hannibal', text: 'Varro tem minha filha no palácio. Enquanto eu vencer, ela come. Entende?' },
      { who: 'hero', text: 'Entendo. E mesmo assim não vou cair.' },
      { who: 'hannibal', text: 'Então que a fera decida.' },
    ],
  },
  {
    id: 'boss-defeat-hannibal', trigger: { on: 'boss-defeat', boss: 'hannibal' }, title: 'A dívida do domador', bg: 'bg-venatio', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'O leão recua para a jaula. Aníbal larga o chicote e se apoia na lança.' },
      { who: 'hannibal', text: 'Acabou para mim. Varro não perdoa campeões que perdem.' },
      { who: 'hannibal', text: 'Se você chegar à tribuna... peça por todos os acorrentados. A minha menina também está nessa lista.' },
      { who: 'hero', text: 'Prometo.' },
      { who: 'narrator', text: 'A Venatio grita o nome de {nome}. No camarote imperial, alguém para de sorrir.' },
    ],
  },
  {
    id: 'transfer-coronation', trigger: { on: 'arena-enter', arena: 'coronation' }, title: 'A coroação', bg: 'bg-coronation', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'O Anfiteatro da Coroação brilha em ouro e púrpura. Cem mil vozes esperam o novo imperador.' },
      { who: 'varro', text: 'Cidadãos! Hoje o Império tem um imperador que cumpre a palavra. Que os Jogos coroem o mais digno!' },
      { who: 'varro', text: '{nome}. Que surpresa agradável. Voltou de livre vontade para as minhas correntes.' },
      { who: 'hero', text: 'Voltei pelos que você acorrentou em Corvara.' },
      { who: 'varro', text: 'Então vença. E, quando chegar a hora, conheça o meu campeão. Acho que vocês têm muito em comum.' },
      { who: 'narrator', text: 'No camarote, um gladiador de armadura negra observa em silêncio. No peito, o dragão de Varro.' },
    ],
  },
  // ---------- Anfiteatro da Coroação ----------
  {
    id: 'boss-intro-draco', trigger: { on: 'boss-intro', boss: 'draco' }, once: true, title: 'O Dragão de Varro', bg: 'bg-coronation', music: 'boss', ambience: 'arena-crowd',
    beats: [
      { who: 'narrator', text: 'O fogo sobe de braseiros em forma de dragão. Draco entra sem pressa, sem olhar para a multidão.' },
      { who: 'draco', text: 'O imperador disse que você é do Vale de Corvara. Eu não lembro de vale nenhum.' },
      { who: 'draco', text: 'Lembro de jaulas, de fome e de uma voz dizendo que a fraqueza morre primeiro. Ele estava certo.' },
      { who: 'hero', text: 'Quem disse isso foi o homem que queimou a nossa casa.' },
      { who: 'draco', text: 'Eu não tenho casa. Tenho uma espada.' },
    ],
  },
  {
    id: 'boss-spared-draco', trigger: { on: 'boss-defeat', boss: 'draco' }, when: { boss: 'draco', verdict: 'spared' }, title: 'O nome verdadeiro', bg: 'bg-coronation', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'Draco cai na areia. {nome} ergue a mão aberta, e a multidão, pela primeira vez, pede clemência junto.' },
      { who: 'draco', text: 'Por que não termina? O imperador...' },
      { who: 'hero', text: 'Você pescava trutas no rio com uma lança de bambu. E sempre perdia para mim.' },
      { who: 'draco', text: '...O rio. Eu lembro do rio. Eu me chamava Darius.' },
      { who: 'draco', text: 'Se você me deixar viver, Varro me mata esta noite. Mas, se eu sobreviver... a minha espada é sua.' },
    ],
  },
  {
    id: 'boss-executed-draco', trigger: { on: 'boss-defeat', boss: 'draco' }, when: { boss: 'draco', verdict: 'executed' }, title: 'O dragão cai', bg: 'bg-coronation', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'O golpe final cai. Draco ainda tenta dizer alguma coisa.' },
      { who: 'draco', text: 'O rio... a gente pescava no rio... não era?' },
      { who: 'hero', text: '...Era. Descanse, Darius.' },
      { who: 'narrator', text: 'O dragão de Varro morre na areia, com o nome verdadeiro preso na garganta.' },
    ],
  },
  {
    id: 'act2-finale', trigger: { on: 'act-won', act: 'oath' }, title: 'A graça do imperador', bg: 'bg-coronation', ambience: 'arena-cheer',
    beats: [
      { who: 'narrator', text: 'Campeão dos Jogos da Coroação. Os guardas abrem caminho até a tribuna imperial.' },
      { who: 'varro', text: 'O povo pede, o imperador concede. Diga, campeão: qual é a sua graça?' },
      { who: 'hero', text: 'Liberdade para os cativos de Corvara. Todos eles. E para todos os acorrentados do ludus imperial.' },
      { who: 'narrator', text: 'A multidão explode. Varro sorri, e o sorriso não chega aos olhos.' },
      { who: 'varro', text: 'Concedido! Caius Varro cumpre a sua palavra!' },
      { who: 'varro', text: 'Pena que os seus já não estão aqui. Meu feiticeiro precisava de almas jovens para o templo sob a Arena Rubra.' },
      { who: 'varro', text: 'Vá buscá-los, se tiver coragem. Ninguém nunca voltou daquele templo.' },
      { who: 'taurosFree', text: 'Ele te deu a graça e roubou o presente. É assim que ele vence.', ambience: null },
      { who: 'hero', text: 'Então vamos tirar dele o templo também.' },
      { who: 'narrator', text: 'Atrás do Anfiteatro, uma lua vermelha volta a nascer sobre a Arena Rubra. A história continua no Ato III.', bg: 'bg-crimson' },
    ],
  },
];

export const SCENES: Record<string, SceneDef> = Object.fromEntries(scenes.map((s) => [s.id, s]));
