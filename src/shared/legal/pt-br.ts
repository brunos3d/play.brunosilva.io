import type { LegalContent } from "./content";

export const ptBr: LegalContent = {
  privacy: {
    short: "Privacidade",
    title: "Política de privacidade",
    intro: [
      "O Minigames (play.brunosilva.io) é um site gratuito de desafios diários, feito e mantido por Bruno Silva como projeto pessoal. Esta página diz o que o site guarda, onde guarda e por quê.",
      "Nada aqui é vendido nem compartilhado para publicidade. O site não tem anúncios, estatísticas de acesso nem rastreadores.",
    ],
    sections: [
      {
        heading: "Em resumo",
        blocks: [
          {
            list: [
              "Você pode jogar todos os jogos sem conta e sem informar nenhum dado pessoal.",
              "Seu progresso, suas configurações e seus resultados ficam no seu navegador.",
              "O servidor só guarda algo sobre você quando você resolve um desafio diário (para o ranking), entra em uma sala de desafio, edita seu perfil, ativa os lembretes ou cria uma conta: um nome de exibição, um apelido, um avatar, seus resultados diários e, com os lembretes ativos, para onde enviá-los.",
              "O site nunca pede e-mail, senha, telefone nem o seu nome verdadeiro.",
              "Você pode apagar seu jogador e tudo o que está guardado sobre ele a qualquer momento, na página Perfil.",
            ],
          },
        ],
      },
      {
        heading: "O que fica no seu aparelho",
        blocks: [
          "Isto é guardado pelo seu navegador. Não é enviado ao servidor, a não ser o que a seção sobre o servidor lista.",
          {
            list: [
              "Configurações (local storage): som, vibração, tema, idioma dos jogos, quais tutoriais você já viu, o fato de ter aceitado o aviso de cookies e quando você disse \"agora não\" para instalar o app ou para os lembretes.",
              "Progresso (IndexedDB): os tabuleiros em andamento, o resultado de cada desafio diário, suas sequências e seus melhores tempos.",
              "Uma lista curta de desafios de prática que você recomeçou (local storage), para que uma segunda tentativa não registre melhor tempo.",
              "Uma cópia offline do site (cache storage): as páginas, os scripts e as listas de palavras necessários para abrir sem conexão.",
            ],
          },
          "Limpar os dados deste site no navegador remove tudo isso. Um tabuleiro que você ainda está jogando não é copiado entre aparelhos. Os desafios diários que você fechou são, desde que o servidor tenha um jogador para você: veja as próximas seções.",
        ],
      },
      {
        heading: "Cookies",
        blocks: [
          "O site só usa os cookies de que precisa para funcionar. Nenhum deles acompanha você em outros sites, e nenhum serve para publicidade ou estatística.",
          {
            list: [
              "NEXT_LOCALE: o idioma que você escolheu para a interface. Dura 1 ano.",
              "play_player: o jogador deste aparelho, na forma de um identificador e um segredo aleatório. É criado na primeira vez que você resolve um desafio diário, entra em uma sala, salva seu perfil ou ativa os lembretes. Dura 2 anos. Os scripts da página não conseguem lê-lo.",
              "play_session: indica que este aparelho está conectado a uma conta. É criado quando você cria uma passkey ou entra com uma. Dura 2 anos, ou até você sair. Deixa de funcionar após 180 dias sem uso.",
              "play_challenge: um valor de uso único, usado enquanto uma passkey é criada ou conferida. Dura 5 minutos.",
            ],
          },
          "Como esses cookies são necessários para os recursos que você pede, o aviso da primeira visita só tem o botão Aceitar. Se você não os quiser, pode bloquear cookies no navegador: os jogos continuam funcionando, e o ranking, as salas e as contas não.",
        ],
      },
      {
        heading: "O que o servidor guarda",
        blocks: [
          "O banco de dados guarda o que está abaixo, e nada mais sobre você.",
          {
            list: [
              "Seu jogador: um identificador aleatório, seu nome de exibição, seu apelido, a semente de que o avatar é desenhado (um texto curto e aleatório), um hash do segredo do seu aparelho, sua sequência e as datas de criação e de última atividade.",
              "Desafios diários: para cada desafio diário que você fecha, seja resolvendo, revelando ou perdendo, o jogo e, nos jogos de palavras, o idioma, a data, o número, a dificuldade e o tamanho do desafio, quando você o fechou, seu tempo, as dicas, os erros e as jogadas, os pontos e o tabuleiro final. Um desafio diário vale uma vez por jogador, e é assim que seus outros aparelhos sabem que ele já foi feito e mostram o mesmo resultado.",
              "Desafios em aberto: para um desafio diário que você abriu, quando o abriu pela primeira vez e quantas dicas já usou, para que o relógio e as dicas sejam os mesmos em todos os aparelhos.",
              "Salas de desafio: as salas que você abre ou em que entra, as rodadas, quando você começou e terminou cada rodada e se a resolveu. As salas são apagadas cerca de 36 horas depois de criadas.",
              "Passkeys, se você criar uma conta: o identificador e a chave pública da passkey, um contador de uso, como o autenticador se conecta, se a passkey é sincronizada, um rótulo com o navegador e o sistema em que foi criada, e quando foi criada e usada pela última vez.",
              "Sessões: para cada aparelho conectado à sua conta, um identificador aleatório, o hash de um segredo e duas datas.",
              "Lembretes, se você os ativar: o endereço que o serviço de notificações do seu navegador deu a este aparelho e as duas chaves que o acompanham, o idioma e o fuso horário em que lembrar você, quando você os ativou, a data do último lembrete e uma contagem de entregas que falharam. São apagados quando você desativa os lembretes, quando você sai da conta, quando o serviço de notificações diz que o aparelho não existe mais, ou junto com o seu jogador.",
            ],
          },
          "A chave privada de uma passkey nunca sai do seu aparelho ou do seu gerenciador de senhas. O site nunca vê sua digital, seu rosto nem seu PIN: é o seu aparelho que confere isso sozinho.",
          "Seu nome de exibição, apelido, avatar, pontuações, sequência e resultados em salas são públicos. Eles aparecem nos rankings e para os outros jogadores de uma sala.",
        ],
      },
      {
        heading: "O que não é coletado",
        blocks: [
          {
            list: [
              "Nenhum e-mail, nome verdadeiro, telefone, endereço, dado de pagamento ou localização precisa.",
              "Nenhum cookie de publicidade ou de estatística, nenhum rastreador de terceiros e nenhuma identificação do navegador por impressão digital (fingerprinting).",
              "Seu endereço IP e a identificação do seu navegador não são guardados no banco de dados do site.",
            ],
          },
        ],
      },
      {
        heading: "Prestadores de serviço",
        blocks: [
          {
            list: [
              "A Vercel hospeda o site. Como qualquer hospedagem, ela processa seu endereço IP e a identificação do seu navegador para entregar as páginas, e mantém registros de acesso por tempo limitado. Ela também informa ao site de que país vem cada acesso. O site usa isso uma vez, para escolher o idioma na sua primeira visita, e não guarda essa informação.",
              "A Neon hospeda o banco de dados, nos Estados Unidos.",
              "Se você usar uma passkey, seu gerenciador de senhas ou aparelho (Google, Apple, Microsoft, uma chave de segurança e assim por diante) cuida dela conforme os próprios termos. O site não recebe dele nenhum dado pessoal.",
              "Se você ativar os lembretes, o serviço de notificações do seu navegador (Google, Mozilla, Microsoft ou Apple) faz a entrega. O servidor entrega a ele uma mensagem criptografada para o seu aparelho, que o serviço não consegue ler: uma linha dizendo que sua sequência acaba hoje.",
            ],
          },
          "As fontes e os avatares são servidos ou desenhados pelo próprio site. Nenhuma página carrega conteúdo dos servidores de outra empresa.",
        ],
      },
      {
        heading: "Por que esses dados são usados",
        blocks: [
          "Os dados servem para entregar o que você pede: guardar seu progresso, mostrar você em um ranking, conduzir uma corrida em uma sala, conectar você à sua conta. Uma parte pequena atende ao interesse legítimo de manter o site funcionando e os rankings justos. Essas são as bases legais previstas na LGPD, do Brasil, e no GDPR, da União Europeia.",
        ],
      },
      {
        heading: "Por quanto tempo",
        blocks: [
          {
            list: [
              "No seu aparelho: até você limpar os dados do navegador.",
              "Salas de desafio: cerca de 36 horas.",
              "Desafios de passkey não usados: apagados quando o próximo é criado, 10 minutos ou mais depois de feitos.",
              "O registro de um desafio diário que você abriu e o tabuleiro final de um que você fechou: cerca de dois dias. Depois disso o resultado fica e o tabuleiro não.",
              "Uma sessão: até você sair naquele aparelho, até você desconectar os outros aparelhos a partir de um deles, ou 180 dias depois do último uso.",
              "Seu jogador, suas pontuações e passkeys: até você apagar seu jogador.",
            ],
          },
        ],
      },
      {
        heading: "Suas escolhas e seus direitos",
        blocks: [
          {
            list: [
              "Ver e mudar seu nome de exibição, seu apelido e seu avatar na página Perfil.",
              "Apagar seu jogador e tudo o que o servidor guarda sobre ele na página Perfil. É imediato e definitivo, e nenhuma cópia é mantida.",
              "Sair de um aparelho, ou remover uma passkey, na página Perfil.",
              "Ativar ou desativar os lembretes nas configurações, e retirar a permissão no navegador quando quiser.",
              "Limpar o que está no seu aparelho pelas configurações do próprio navegador.",
            ],
          },
          "Você também pode pedir acesso aos seus dados, uma correção ou a exclusão pelo contato abaixo. Leis de proteção de dados como a LGPD e o GDPR garantem esses direitos, e o de reclamar à autoridade de proteção de dados (no Brasil, a ANPD).",
        ],
      },
      {
        heading: "Crianças",
        blocks: ["O site é feito para o público em geral e não pede dados pessoais a ninguém. Um pai, mãe ou responsável que queira remover o jogador de uma criança pode apagá-lo na página Perfil do aparelho dela, ou pedir pelo contato abaixo."],
      },
      {
        heading: "Mudanças",
        blocks: ["Quando o que o site guarda mudar, esta página muda junto, e a data no topo é atualizada."],
      },
      {
        heading: "Contato",
        blocks: ["O site é mantido por Bruno Silva. Você pode falar com ele por brunosilva.io, ou abrir uma issue no repositório do projeto no GitHub. Os dois links estão no fim desta página."],
      },
    ],
  },

  terms: {
    short: "Termos",
    title: "Termos de uso",
    intro: ["O Minigames (play.brunosilva.io) é um site gratuito de desafios diários, feito e mantido por Bruno Silva como projeto pessoal. Ao usá-lo, você concorda com os termos abaixo. Eles são curtos de propósito."],
    sections: [
      {
        heading: "O serviço",
        blocks: ["O site é gratuito e é oferecido como está. Você pode jogar todos os jogos sem conta. O ranking, as salas de desafio e as contas são extras que dependem do servidor, e podem ser alterados, limitados ou desligados."],
      },
      {
        heading: "Jogo limpo",
        blocks: [
          "Os rankings existem por diversão. Os tempos são informados pelo seu próprio aparelho, e o servidor não tem como provar que uma solução foi honesta.",
          {
            list: [
              "Não envie pontuações com scripts ou ferramentas, nem adultere o que o seu aparelho informa.",
              "Não atrapalhe as salas de outros jogadores nem tente se passar por outro jogador.",
              "Não sobrecarregue o site com acessos automatizados.",
            ],
          },
          "Pontuações e jogadores claramente falsos podem ser removidos.",
        ],
      },
      {
        heading: "Nomes",
        blocks: [
          "Seu nome de exibição e seu apelido são públicos. Não os use para se passar por outra pessoa, para ofender ou assediar alguém, nem para nada ilegal. Um nome que quebre essa regra pode ser alterado ou removido, junto com o jogador se for preciso.",
          "Um apelido é de quem o pegar primeiro. Ele não fica reservado depois que você o troca ou apaga seu jogador.",
        ],
      },
      {
        heading: "Contas",
        blocks: [
          "Uma conta é um jogador com uma passkey. Você é responsável pelo aparelho, gerenciador de senhas ou chave de segurança que a guarda.",
          "O site não guarda e-mail nem senha, então não tem como recuperar uma conta para você. Se você perder todas as passkeys e todos os aparelhos conectados, a conta se perde. Adicionar uma segunda passkey evita isso.",
        ],
      },
      {
        heading: "Seus dados",
        blocks: ["A política de privacidade diz o que é guardado e como apagar. Você pode apagar seu jogador a qualquer momento, na página Perfil."],
      },
      {
        heading: "Disponibilidade",
        blocks: ["Este é um projeto pessoal, sem garantia de serviço. O site pode ficar fora do ar, perder dados ou acabar. Os rankings podem ser zerados. Não guarde aqui nada que você não possa perder."],
      },
      {
        heading: "Responsabilidade",
        blocks: ["Até onde a lei permite, o site é oferecido sem garantias de qualquer tipo, e quem o mantém não responde por danos decorrentes do uso ou da impossibilidade de uso."],
      },
      {
        heading: "Código-fonte",
        blocks: ["O código do site é público no GitHub, sob a licença MIT. As listas de palavras e as peças de xadrez vêm de outros projetos, sob as licenças deles, listadas no repositório."],
      },
      {
        heading: "Mudanças e lei aplicável",
        blocks: ["Estes termos podem mudar. A data no topo diz quando mudaram pela última vez, e usar o site depois de uma mudança significa aceitá-la. Os termos são regidos pelas leis do Brasil, onde mora quem mantém o site."],
      },
      {
        heading: "Contato",
        blocks: ["Dúvidas sobre estes termos podem ser enviadas por brunosilva.io ou como uma issue no repositório do projeto no GitHub."],
      },
    ],
  },
};
