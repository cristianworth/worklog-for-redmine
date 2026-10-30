# Interface e identidade visual

A interface funciona como uma agenda de apontamentos: localizar uma data, preencher suas linhas e conferir o total antes de salvar ou revisar um envio. O modo local e a demo usam os mesmos componentes e estilos.

## Cores com uma função

A paleta **Azulejos**, escolhida por Cristian entre as alternativas apresentadas, combina azul, lavanda, turquesa e sálvia, com fundos suaves de intensidade próxima e texto escuro. A preferência de Cristian é manter cor e personalidade sem grandes blocos saturados ou uma interface monocromática. A referência a planilhas indicava facilidade para distinguir grupos, não uma exigência de branco e cinza.

| Dia | Cabeçalho | Detalhe da data |
| --- | --- | --- |
| Segunda | Azul `#A9CBE2` | `#416D91` |
| Terça | Azul-pervinca `#B4C1E1` | `#596B9E` |
| Quarta | Lavanda `#C7BDE0` | `#76649B` |
| Quinta | Turquesa `#A7D4D1` | `#377B78` |
| Sexta | Sálvia `#C3D8BC` | `#587951` |

O petróleo `#2F6B66` conecta marca, ações, foco e avisos da demo; o fundo claro `#F1F6F3` e as bordas esverdeadas sustentam o conjunto. Os cabeçalhos são avaliados lado a lado, com luminosidade próxima, em vez de escolher cada cor isoladamente. A área de edição clara conserva a legibilidade dos campos.

A cor acompanha o dia da semana, inclusive ao mudar o período ou recolher suas tarefas. A data é interpretada em UTC somente para escolher o tom, sem converter a data de trabalho pelo fuso do navegador. Resultados continuam identificados por texto/recibos; a paleta semanal não representa confirmação ou erro. O marcador **Hoje** complementa a data.

O espaçamento entre dias e as divisórias das tabelas separam os grupos. Linhas alternadas ajudam a acompanhar os campos; seleção e situação dos recibos têm tratamentos próprios. Uma duração inválida mantém a indicação textual de total parcial.

Áreas livres do cabeçalho alternam as tarefas ao clicar. Botões mantêm suas próprias ações; a seta preserva o acesso por teclado e anuncia o estado expandido. Recolher mantém as linhas montadas, inclusive uma soma ainda não aplicada.

O **+** verde ao lado da duração abre **Tempo a somar**, com prévia do total. **Enter/Somar** aplica uma vez e devolve o foco ao campo principal; **Esc/×/+** cancela. O valor original permanece visível durante a operação. Campos de recibos protegidos e bases inválidas bloqueiam o acréscimo; editar diretamente continua substituindo o valor. A coluna tem largura suficiente para o botão e a duração, e apenas a tabela rola horizontalmente em telas estreitas. Não há salvamento/envio implícito.

## Marca, tipografia e manutenção

- `src/client/assets/worklog-mark.svg` é a marca compartilhada pelo cabeçalho e favicon. As cinco colunas representam registros de horas ao longo da semana. O vetor é original do projeto, sem biblioteca de marcas, scripts ou recursos externos.
- O Vite publica esse arquivo sob a base de cada build. A auditoria aceita somente SVG passivo com as primitivas usadas na marca; mantém a rejeição de arquivos privados, referências à API e recursos ausentes. O lançador inclui SVG no cálculo que identifica um build desatualizado.
- Títulos usam Trebuchet MS com alternativas locais; formulários usam Segoe UI/Helvetica Neue e a fonte sans-serif disponível. Não há download de fontes. Os números das durações usam alinhamento tabular.
- Tokens e regras ficam em `src/client/styles.css`. Altere os tokens existentes antes de criar novos tons; mantenha o contraste do texto e do foco em cada cabeçalho. A aparência exata da tipografia varia com as fontes instaladas.
- Configurações, modelo e revisões compartilham os campos e botões do editor. A apresentação não altera contratos de dados, revisões, seleção ou confirmação de envios.

## Seleção e retorno do envio

O **+** de soma fica à direita do campo de duração, também na ordem de navegação por teclado. Campos obrigatórios do dia (tarefa, duração, atividade e observação) exibem borda/fundo vermelho suave, mensagem e `aria-invalid` ao perder o foco vazios; corrigir limpa o aviso imediatamente. Uma linha nova começa neutra. Revisar o dia também revela campos ausentes. `aria-required` informa o requisito sem validação nativa que impeça salvar rascunhos incompletos; a validação definitiva permanece na revisão do envio.

**Selecionar todos** reúne apenas pendentes salvos do período visível; salvar e enviar continuam separados. O botão de envio de cada dia fica no rodapé das suas tarefas, acompanhado da quantidade pendente e da indicação de revisão. Datas, totais, adicionar linha e recolher ficam no cabeçalho. Dias integralmente apropriados não exibem uma ação de reenvio.

Seletores de atividades dos dias/modelo e o catálogo em Configurações apresentam os nomes em ordem alfabética brasileira, sem distinguir maiúsculas ou acentos para ordenar. A apresentação não altera IDs nem substitui valores antigos; o catálogo não muda de posição a cada tecla durante a edição.

A revisão exibe espera na preparação e um painel de progresso após confirmar. O painel permanece visível durante a rolagem, informa quantidades, data/tarefa atual quando disponíveis e distingue sucesso de pendências. Não estima duração nem anuncia confirmação antes dos recibos. Usa texto, ícones, `role="status"` e uma barra nativa; a preferência por movimento reduzido desativa a rotação do indicador.

## Conferência de mudanças visuais

Use a demo e dados fictícios; nunca o banco de uso para preencher capturas. Confira desktop, tablet e 375 px, incluindo:

1. Uma semana completa e uma segunda semana: os cinco tons devem formar um conjunto coerente; o mesmo dia da semana mantém sua cor ao mudar o período ou recolher as tarefas.
2. Edição, duração abreviada/inválida, atividade, total, seleção e botão de salvar. Recolher e reabrir mantém os campos e as edições.
3. Salvar e recarregar; revisar, cancelar e confirmar uma simulação; expandir um dia apropriado e conferir o recibo.
4. Modelo, catálogo, avisos e revisão em tela pequena. Somente tabelas largas devem rolar horizontalmente, preservando os campos editáveis.
5. Teclado, foco visível, movimento reduzido e nomes acessíveis. A cor nunca deve ser o único meio de identificar uma data ou situação.
6. Marca e favicon carregando tanto na raiz quanto em `/worklog-for-redmine/`.

A imagem do [README](../README.md) deve acompanhar a aparência entregue, usando apenas exemplos fictícios.
