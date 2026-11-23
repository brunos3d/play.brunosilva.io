/**
 * The word bank: every puzzle hides words of one theme. Words are written the
 * way they are spelled, with accents. The board shows them without accents and
 * the word list puts the accents back once a word is found.
 *
 * Rules for an entry: one word, 3 to 12 letters, no hyphen, no space. A theme
 * needs words of many different lengths, because a board is filled with one
 * word per length. tests/wend/bank.test.ts enforces all of this.
 *
 * Changing a word changes the puzzles that seeds build. Add a generator version
 * in seed.ts before editing a theme that has shipped.
 */
export type WendTheme = { title: string; words: string };

export const WEND_THEMES: readonly WendTheme[] = [
  {
    title: "Frutas",
    words: "uva figo pera caju coco lima jaca maçã romã kiwi manga limão melão mamão amora caqui banana goiaba ameixa cereja laranja abacate abacaxi morango pêssego pitanga acerola damasco graviola maracujá melancia framboesa tangerina carambola tamarindo jabuticaba",
  },
  {
    title: "Na fazenda",
    words: "boi cão vaca pato gato galo peru égua porco cabra burro ganso touro potro milho cerca ovelha cavalo coelho leitão trator celeiro galinha bezerro jumento marreco curral colheita carneiro pintinho cordeiro plantação fazendeiro espantalho galinheiro",
  },
  {
    title: "Animais selvagens",
    words: "leão onça urso lobo tatu anta puma zebra tigre hiena lince veado girafa macaco gorila jacaré camelo raposa javali búfalo pantera canguru suricato leopardo elefante guepardo capivara tamanduá preguiça crocodilo chimpanzé orangotango hipopótamo rinoceronte",
  },
  {
    title: "Na cozinha",
    words: "pia faca copo bule fogão prato garfo forno jarra tábua tampa panela colher xícara caneca tigela concha talher peneira ralador avental chaleira espátula batedeira geladeira cafeteira torradeira frigideira escorredor",
  },
  {
    title: "Cores",
    words: "azul rosa roxo bege anil ocre verde preto cinza lilás creme ciano grená branco marrom índigo carmim salmão amarelo laranja dourado violeta magenta púrpura vermelho prateado turquesa escarlate esverdeado amarelado avermelhado",
  },
  {
    title: "Corpo humano",
    words: "rim olho boca dedo unha pele osso nariz braço perna ombro dente peito testa joelho orelha cabeça fígado língua costas queixo pulmão pescoço barriga coração cérebro cintura quadril músculo cotovelo estômago garganta tornozelo calcanhar sobrancelha",
  },
  {
    title: "Esportes",
    words: "judô boxe remo golfe surfe tênis vôlei skate rúgbi caratê futebol natação corrida esgrima hipismo triatlo ciclismo basquete handebol capoeira beisebol mergulho canoagem escalada maratona ginástica atletismo patinação",
  },
  {
    title: "Instrumentos musicais",
    words: "tuba oboé harpa gaita baixo órgão cuíca agogô violão piano flauta tambor bateria violino sanfona teclado zabumba guitarra pandeiro trompete saxofone berimbau trombone atabaque bandolim chocalho clarinete triângulo cavaquinho violoncelo contrabaixo",
  },
  {
    title: "Profissões",
    words: "juiz ator chef gari babá padre atriz médico piloto pintor garçom cantor músico padeiro pedreiro dentista advogado bombeiro policial vendedor contador barbeiro escritor mecânico pescador professor motorista fotógrafo cientista psicólogo jornalista engenheiro enfermeiro arquiteto cozinheiro agricultor eletricista carpinteiro veterinário programador",
  },
  {
    title: "Na escola",
    words: "giz aula sala nota cola lápis livro prova lousa aluno lição caneta régua estojo quadro tarefa caderno mochila recreio diretor merenda boletim redação borracha tesoura carteira uniforme compasso história ciências apontador geografia biblioteca dicionário matemática",
  },
  {
    title: "Tempo e clima",
    words: "sol raio neve frio seca chuva vento nuvem geada garoa calor brisa trovão furacão granizo tornado orvalho umidade ciclone sereno mormaço neblina nevasca temporal ventania chuvisco estiagem relâmpago aguaceiro tempestade",
  },
  {
    title: "Família",
    words: "pai mãe avó tio tia filho filha irmão irmã primo prima neto neta sogro sogra genro nora noivo noiva gêmeo marido esposa caçula bisavó cunhado enteado parente compadre sobrinho padrinho madrinha padrasto madrasta afilhado herdeiro ancestral parentesco primogênito",
  },
  {
    title: "Na praia",
    words: "mar sol sal onda boia maré siri ilha duna baía alga areia sunga canga barco peixe balde farol costa concha toalha picolé óculos chinelo prancha biquíni castelo gaivota estrela coqueiro quiosque mergulho surfista protetor guarda calçadão bronzeado caranguejo bronzeador",
  },
  {
    title: "Transportes",
    words: "van jipe trem moto iate táxi carro avião navio barco metrô balsa bonde canoa ônibus lancha trator foguete jangada carroça veleiro caminhão patinete charrete triciclo caravela bicicleta submarino dirigível ambulância teleférico helicóptero",
  },
  {
    title: "Flores",
    words: "rosa íris lírio cravo dália lótus tulipa jasmim violeta lavanda hibisco gérbera petúnia papoula narciso camélia begônia azaleia antúrio girassol orquídea bromélia magnólia amarílis margarida hortênsia crisântemo",
  },
  {
    title: "Na horta",
    words: "alho aipo nabo jiló salsa couve milho vagem tomate cebola batata alface pepino chuchu quiabo inhame rúcula agrião acelga cenoura abóbora repolho ervilha coentro aspargo maxixe brócolis pimentão rabanete mandioca escarola beterraba berinjela espinafre abobrinha cebolinha alcachofra",
  },
  {
    title: "Roupas",
    words: "saia meia luva boné bota maiô calça blusa terno short cueca sutiã cinto lenço camisa casaco pijama colete suéter roupão sapato chapéu tênis vestido jaqueta bermuda gravata moletom chinelo sandália camiseta cachecol macacão agasalho calcinha sobretudo jardineira",
  },
  {
    title: "Bebidas",
    words: "chá rum café suco mate água leite vinho licor vodca chope saquê sidra uísque batida garapa cerveja cachaça guaraná iogurte tequila quentão tereré limonada vitamina coquetel conhaque champanhe chocolate espumante chimarrão caipirinha energético refrigerante achocolatado",
  },
  {
    title: "Doces",
    words: "mel bolo bala pavê doce torta pudim sonho trufa curau mousse cocada paçoca geleia bombom churro manjar picolé sorvete quindim canjica pamonha suspiro compota gelatina pirulito beijinho rapadura goiabada biscoito bolacha rabanada ambrosia merengue chiclete panetone chocolate marmelada cajuzinho brigadeiro",
  },
  {
    title: "Móveis e casa",
    words: "baú sofá cama mesa rede banco berço tapete quadro gaveta lustre cabide lençol fronha cadeira armário estante cortina espelho colchão cômoda abajur beliche edredom poltrona almofada cobertor aparador luminária prateleira travesseiro penteadeira escrivaninha",
  },
  {
    title: "Partes da casa",
    words: "sala piso teto muro copa porta sótão porão suíte quarto escada janela parede jardim sacada portão cozinha varanda garagem quintal telhado terraço chaminé lareira calçada banheiro corredor despensa alpendre campainha interfone lavanderia escritório",
  },
  {
    title: "Ferramentas",
    words: "lixa rolo lima serra chave prego trena broca torno foice porca bucha nível martelo alicate machado enxada pincel formão grampo cinzel plaina serrote marreta ancinho rastelo bigorna tesoura parafuso picareta esquadro espátula estilete maçarico furadeira compressor",
  },
  {
    title: "No espaço",
    words: "sol lua terra marte astro vácuo sonda vênus urano plutão cometa órbita cosmos quasar júpiter saturno netuno estrela planeta galáxia meteoro foguete eclipse cratera cápsula mercúrio satélite universo nebulosa asteroide gravidade supernova meteorito astronauta telescópio constelação",
  },
  {
    title: "Vida marinha",
    words: "lula foca siri alga atum orca peixe polvo ostra coral morsa arraia baleia enguia moreia medusa baiacu tainha robalo ouriço tubarão camarão lagosta salmão marisco anêmona esponja anchova narval pinguim golfinho sardinha bacalhau plâncton mexilhão garoupa linguado tartaruga cachalote caranguejo",
  },
  {
    title: "Aves",
    words: "ema anu jacu pato arara pombo águia cisne urubu garça pavão ganso corvo curió gavião coruja tucano pardal sabiá falcão condor canário galinha rolinha codorna cegonha colibri jandaia cacatua seriema papagaio pinguim avestruz flamingo gaivota pelicano maritaca periquito albatroz rouxinol andorinha calopsita",
  },
  {
    title: "Insetos e bichinhos",
    words: "asa mel teia ovos mosca grilo vespa pulga cupim lesma traça larva abelha barata piolho aranha zangão mutuca casulo formiga besouro cigarra lagarta minhoca caracol mosquito joaninha mariposa libélula carrapato centopeia percevejo borboleta gafanhoto escorpião marimbondo pernilongo",
  },
  {
    title: "Tecnologia",
    words: "bit tela rede cabo chip byte link site robô senha pasta dados nuvem vírus mouse pixel tablet antena câmera código atalho cursor ícone janela teclado monitor arquivo celular memória bateria sistema digital usuário internet programa servidor roteador planilha navegador algoritmo impressora computador aplicativo processador",
  },
  {
    title: "Países",
    words: "Peru Cuba Chile China Japão Índia Egito Itália França México Canadá Rússia Grécia Suíça Suécia Angola Israel Coreia Quênia Brasil Espanha Uruguai Turquia Noruega Holanda Bélgica Irlanda Polônia Bolívia Equador Nigéria Vietnã Áustria Hungria Escócia Senegal Portugal Alemanha Colômbia Paraguai Marrocos Argentina Austrália Venezuela Tailândia Indonésia Dinamarca Finlândia Inglaterra Moçambique",
  },
  {
    title: "Estados e capitais do Brasil",
    words: "Acre Pará Bahia Ceará Goiás Amapá Piauí Belém Natal Paraná Recife Manaus Maceió Cuiabá Macapá Palmas Roraima Sergipe Alagoas Paraíba Aracaju Vitória Goiânia Rondônia Amazonas Maranhão Salvador Curitiba Brasília Teresina Tocantins Fortaleza Pernambuco",
  },
  {
    title: "Festa junina",
    words: "roça doce bolo milho balão forró rojão fogos junho santo dança festa pipoca paçoca cocada curau chapéu xadrez noivo arraial caipira canjica pamonha quentão sanfona barraca fogueira pescaria bombinha quadrilha casamento bandeirinha",
  },
  {
    title: "Carnaval",
    words: "axé trio bloco samba frevo folia surdo abadá cuíca ritmo apito agogô enredo folião rainha mestre cordão confete máscara desfile bateria avenida fantasia alegoria passista tamborim pandeiro maracatu bandeira marchinha purpurina serpentina sambódromo",
  },
  {
    title: "Futebol",
    words: "gol bola time rede juiz taça copa meia trave falta campo apito passe chute drible cartão placar empate craque goleiro torcida estádio lateral volante técnico vitória derrota camisa gramado capitão reserva titular pênalti zagueiro atacante cabeceio chuteira clássico escanteio artilheiro campeonato prorrogação impedimento bandeirinha arquibancada",
  },
  {
    title: "Sentimentos",
    words: "paz amor medo nojo pena raiva ciúme tédio culpa calma fúria mágoa afeto pavor inveja paixão alívio desejo alegria saudade orgulho carinho ternura coragem euforia solidão empatia encanto tristeza vergonha surpresa angústia gratidão ansiedade esperança confiança nostalgia compaixão felicidade entusiasmo serenidade melancolia frustração",
  },
  {
    title: "Paisagens",
    words: "rio mar lago ilha vale mata duna baía atol serra monte praia campo selva gruta lagoa golfo oásis vulcão colina savana riacho mangue recife cânion bosque tundra deserto caverna geleira pântano cerrado chapada córrego falésia enseada floresta montanha planície penhasco nascente restinga planalto pradaria cachoeira península cordilheira desfiladeiro",
  },
  {
    title: "No escritório",
    words: "fita cola mesa clipe papel pasta bloco lápis régua agenda grampo crachá gaveta recibo caneta cadeira carimbo tesoura arquivo reunião caderno teclado monitor envelope marcador etiqueta planilha telefone contrato elástico estilete relatório prancheta corretivo impressora computador grampeador perfurador calculadora",
  },
  {
    title: "Pratos e comidas",
    words: "pão tutu bobó sopa bife arroz farofa pastel cuscuz vatapá empada quibe pirão caldo pizza feijão caruru virado rabada mocotó cozido assado risoto salada nhoque coxinha tapioca moqueca acarajé pamonha esfirra picanha lasanha omelete polenta bolinho feijoada linguiça torresmo macarrão panqueca barreado buchada ensopado croquete rissole churrasco galinhada sarapatel carreteiro dobradinha estrogonofe escondidinho",
  },
  {
    title: "Temperos",
    words: "sal mel alho salsa louro cravo molho limão dendê endro cebola canela azeite sálvia urucum açúcar pimenta orégano coentro cominho açafrão páprica alecrim hortelã tomilho vinagre colorau cúrcuma tempero gengibre mostarda baunilha estragão pimentão cardamomo cebolinha manjericão",
  },
  {
    title: "Jogos e brinquedos",
    words: "pipa pião dado cubo gude totó ioiô bola corda damas truco bingo gamão robô skate boneca dominó xadrez peteca patins sinuca baralho bambolê balanço pelúcia pebolim carrinho gangorra massinha chocalho bilboquê patinete triciclo tabuleiro bicicleta videogame paciência fliperama amarelinha estilingue escorregador",
  },
  {
    title: "Cinema e teatro",
    words: "ato ator cena peça tela atriz filme palco drama vilão herói dublê trilha sessão elenco ensaio enredo roteiro diretor plateia pipoca cortina câmera comédia terror musical estreia legenda aplauso camarim romance ficção ingresso figurino cenário suspense dublagem produtor cineasta animação aventura claquete holofote bastidor figurante maquiagem bilheteria personagem protagonista documentário",
  },
  {
    title: "Saúde",
    words: "dor maca soro gaze luva exame febre gripe gesso pulso tosse leito médico vacina pomada xarope vírus remédio seringa receita máscara pressão alergia injeção clínica plantão sintoma repouso cápsula algodão hospital cirurgia consulta curativo bisturi paciente farmácia bactéria infecção atestado anestesia ultrassom enfermeira comprimido termômetro ambulância emergência tratamento transfusão diagnóstico esparadrapo estetoscópio",
  },
  {
    title: "Na cidade",
    words: "rua loja ponte praça banco museu hotel posto feira túnel faixa poste placa ponto prédio parque igreja escola cinema teatro bairro centro bueiro avenida esquina calçada padaria mercado estádio estação viaduto correio oficina açougue estátua semáforo farmácia hospital academia cartório livraria quitanda pizzaria lotérica chafariz ciclovia pedágio delegacia aeroporto barbearia monumento passarela rotatória prefeitura rodoviária quarteirão lanchonete biblioteca sorveteria restaurante floricultura",
  },
  {
    title: "Matemática",
    words: "par soma zero raiz raio área cubo cone seno moda ímpar dobro primo vetor média razão dúzia ângulo número fração metade triplo adição volume medida tabela esfera prisma cateto matriz função aresta dezena milhar círculo equação divisão álgebra cálculo gráfico losango decimal inteiro teorema cosseno mediana unidade centena vértice quadrado diâmetro cilindro pirâmide trapézio hexágono potência expoente tangente conjunto variável infinito paralela diagonal simetria triângulo retângulo subtração geometria perímetro pentágono logaritmo constante proporção bissetriz hipotenusa porcentagem",
  },
  {
    title: "Calendário",
    words: "dia mês ano era hora data fuso hoje maio manhã tarde noite ontem março abril junho julho terça sexta verão prazo turno época semana minuto século década amanhã agosto quarta quinta sábado outono aurora segundo janeiro outubro segunda domingo feriado inverno relógio estação milênio véspera momento fevereiro setembro novembro dezembro quinzena bimestre semestre instante bissexto ponteiro alvorada madrugada primavera trimestre ampulheta calendário crepúsculo cronômetro despertador",
  },
  {
    title: "Acampamento",
    words: "rio mata lago vara isca rede remo bota pico cume mapa vale corda pesca anzol lenha canoa rapel tenda apito trilha cantil carvão colete abrigo poncho gruta barraca mochila bússola caiaque lampião fósforo caneca garrafa galocha bastão mirante fogueira lanterna isqueiro canivete binóculo natureza floresta montanha escalada capacete cobertor repelente cachoeira mosquetão colchonete acampamento sinalizador",
  },
  {
    title: "Fantasia e lendas",
    words: "rei fada mago elfo ogro saci iara boto cuca mito anão bruxa gnomo fênix zumbi múmia poção torre reino magia grifo hidra lenda herói vilão coroa trono cetro dragão duende sereia castelo espada escudo mapa gênio feitiço varinha rainha tesouro caverna encanto oráculo pégaso quimera ciclope medusa cristal amuleto talismã monstro enigma gigante vampiro princesa príncipe fantasma maldição profecia centauro vassoura caipora boitatá masmorra unicórnio lobisomem cavaleiro minotauro caldeirão curupira calabouço labirinto feiticeiro pergaminho",
  },
  {
    title: "Dinheiro",
    words: "real nota euro taxa pix moeda banco conta juros saldo senha caixa cofre troco preço lucro dólar bolsa fundo renda multa sócio cheque cartão dívida boleto saque câmbio tarifa seguro recibo crédito débito salário imposto extrato parcela fatura despesa receita mesada gorjeta capital tesouro pobreza riqueza fortuna centavo cédula empresa negócio poupança depósito carteira economia desconto promoção cobrança hipoteca inflação contrato cofrinho orçamento pagamento prestação pechincha empréstimo liquidação investimento",
  },
  {
    title: "No banheiro",
    words: "pia ralo vaso bidê lixa sabão pente pasta xampu creme papel touca cesto loção talco pinça batom rímel bucha toalha escova gilete lâmina espuma tapete fralda lenço espelho perfume esponja privada lixeira secador cortina azulejo armário balança colônia alicate esmalte chuveiro banheira sabonete torneira descarga cotonete algodão barbeador maquiagem hidratante enxaguante absorvente desodorante saboneteira",
  },
  {
    title: "Ações do dia a dia",
    words: "ler ouvir olhar comer beber andar pular falar nadar lavar jogar pagar abrir subir sair regar dormir correr cantar dançar limpar varrer sorrir chorar beijar pensar sonhar sentar deitar vestir calçar viajar vender fechar descer entrar chegar partir pintar plantar escrever cozinhar estudar brincar abraçar acordar pentear escovar dirigir comprar esperar passear navegar levantar caminhar desenhar costurar assistir trabalhar descansar conversar telefonar",
  },
  {
    title: "Música",
    words: "tom bis rap pop axé rock jazz funk nota solo trio hino moda xote samba forró choro baião frevo blues ópera valsa tango salsa ritmo letra verso banda coral palco disco álbum vinil rádio clave viola pagode bolero acorde refrão canção cantor dueto sonata marcha batida grave agudo timbre volume ensaio turnê xaxado maxixe reggae melodia maestro escala cantiga estrofe arranjo plateia aplauso repente lambada carimbó seresta harmonia concerto compasso quarteto sinfonia serenata pianista embolada sertanejo orquestra partitura microfone vocalista baterista intérprete compositor violonista sanfoneiro guitarrista",
  },
  {
    title: "Pedras e metais",
    words: "aço ouro rubi jade mica joia gema ônix prata ferro cobre zinco opala areia pérola ágata âmbar latão lítio xisto gesso pedra rocha seixo bronze chumbo níquel safira argila carvão urânio pirita pepita estanho platina titânio topázio quartzo granito mármore ardósia basalto cristal granada cobalto minério lingote alumínio mercúrio diamante ametista calcário cascalho turquesa magnésio esmeralda turmalina",
  },
  {
    title: "Árvores e plantas",
    words: "ipê hera cipó raiz flor copa ingá açaí bambu cacto musgo grama capim trevo galho folha fruto broto casca seiva cedro mogno baobá tronco babaçu buriti jatobá peroba imbuia angico manacá arbusto semente espinho sequoia aroeira embaúba pinheiro palmeira coqueiro carvalho figueira oliveira videira pereira macieira limoeiro cajueiro cipreste juazeiro carnaúba paineira jaqueira mamoeiro mangueira eucalipto samambaia araucária bananeira cerejeira amoreira salgueiro mandacaru goiabeira jacarandá laranjeira abacateiro sibipiruna seringueira castanheira quaresmeira pitangueira",
  },
  {
    title: "No mercado",
    words: "pão óleo ovos café fila nota cesta caixa preço carne peixe arroz leite sabão cupom marca lista troco sacola oferta frango queijo fruta legume feijão açúcar recibo compra varejo granel balança açougue padaria bebida limpeza higiene cereal farinha verdura gôndola estoque cliente gerente produto atacado encarte vitrine etiqueta biscoito macarrão manteiga presunto iogurte corredor validade desconto carrinho promoção enlatado laticínio congelado repositor embalagem amaciante prateleira detergente",
  },
  {
    title: "No céu",
    words: "sol lua asa voo céu jato caça pipa raio neve balão nuvem vento chuva pouso avião águia piloto cometa trovão aurora hélice gavião foguete estrela pássaro morcego abelha zepelim turbina planador satélite altitude parapente ultraleve horizonte andorinha borboleta relâmpago dirigível decolagem paraquedas helicóptero",
  },
  {
    title: "Bichos do Brasil",
    words: "ema anu tatu anta boto mico paca jacu tiê sapo teiú onça arara sagui quati cutia gambá bugio saíra coral mutum tucano jacaré sucuri jiboia jabuti cágado lontra harpia urubu coruja sabiá curió graúna iguana cururu saúva piranha tambaqui dourado tuiuiú tracajá queixada muriqui cardeal calango cigarra carcará capivara tamanduá preguiça seriema pirarucu ariranha papagaio maritaca jandaia araponga uirapuru surucucu jararaca cascavel perereca periquito suçuarana jacutinga tarântula jaguatirica",
  },
];
