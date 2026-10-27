# Interface e identidade visual

A interface funciona como uma agenda de apontamentos: localizar uma data, preencher suas linhas e conferir o total antes de salvar ou revisar um envio. O modo local e a demo usam os mesmos componentes e estilos.

## Cores com uma função

A paleta **Oceano**, escolhida por Cristian após comparar cinco alternativas, usa cores vizinhas do azul ao verde, com fundos suaves e texto escuro. A preferência de Cristian é manter cor e personalidade sem grandes blocos saturados ou uma interface monocromática. A referência a planilhas indicava facilidade para distinguir grupos, não uma exigência de branco e cinza.

| Dia | Cabeçalho | Detalhe da data |
| --- | --- | --- |
| Segunda | Azul `#A5C7E8` | `#416EA1` |
| Terça | Azul-piscina `#A4D2E0` | `#317B93` |
| Quarta | Verde-mar `#A1D6CD` | `#2F7D6C` |
| Quinta | Sálvia `#B6D8BD` | `#537B52` |
| Sexta | Verde-folha `#D0DDAF` | `#6B7D3B` |

O petróleo `#2F6B66` conecta marca, ações, foco e avisos da demo; o fundo claro `#F1F6F3` e as bordas esverdeadas sustentam o conjunto. Os cabeçalhos são avaliados lado a lado, com luminosidade próxima, em vez de escolher cada cor isoladamente. A área de edição clara conserva a legibilidade dos campos.

A cor acompanha o dia da semana, inclusive ao mudar o período ou recolher suas tarefas. A data é interpretada em UTC somente para escolher o tom, sem converter a data de trabalho pelo fuso do navegador. Resultados continuam identificados por texto/recibos; a paleta semanal não representa confirmação ou erro. O marcador **Hoje** complementa a data.

O espaçamento entre dias e as divisórias das tabelas separam os grupos. Linhas alternadas ajudam a acompanhar os campos; seleção e situação dos recibos têm tratamentos próprios. Uma duração inválida mantém a indicação textual de total parcial.

## Marca, tipografia e manutenção

- `src/client/assets/worklog-mark.svg` é a marca compartilhada pelo cabeçalho e favicon. As cinco colunas representam registros de horas ao longo da semana. O vetor é original do projeto, sem biblioteca de marcas, scripts ou recursos externos.
- O Vite publica esse arquivo sob a base de cada build. A auditoria aceita somente SVG passivo com as primitivas usadas na marca; mantém a rejeição de arquivos privados, referências à API e recursos ausentes. O lançador inclui SVG no cálculo que identifica um build desatualizado.
- Títulos usam Trebuchet MS com alternativas locais; formulários usam Segoe UI/Helvetica Neue e a fonte sans-serif disponível. Não há download de fontes. Os números das durações usam alinhamento tabular.
- Tokens e regras ficam em `src/client/styles.css`. Altere os tokens existentes antes de criar novos tons; mantenha o contraste do texto e do foco em cada cabeçalho. A aparência exata da tipografia varia com as fontes instaladas.
- Configurações, modelo e revisões compartilham os campos e botões do editor. A apresentação não altera contratos de dados, revisões, seleção ou confirmação de envios.

## Conferência de mudanças visuais

Use a demo e dados fictícios; nunca o banco de uso para preencher capturas. Confira desktop, tablet e 375 px, incluindo:

1. Uma semana completa e uma segunda semana: os cinco tons devem formar um conjunto coerente; o mesmo dia da semana mantém sua cor ao mudar o período ou recolher as tarefas.
2. Edição, duração abreviada/inválida, atividade, total, seleção e botão de salvar. Recolher e reabrir mantém os campos e as edições.
3. Salvar e recarregar; revisar, cancelar e confirmar uma simulação; expandir um dia apropriado e conferir o recibo.
4. Modelo, catálogo, avisos e revisão em tela pequena. Somente tabelas largas devem rolar horizontalmente, preservando os campos editáveis.
5. Teclado, foco visível, movimento reduzido e nomes acessíveis. A cor nunca deve ser o único meio de identificar uma data ou situação.
6. Marca e favicon carregando tanto na raiz quanto em `/worklog-for-redmine/`.

A imagem do [README](../README.md) deve acompanhar a aparência entregue, usando apenas exemplos fictícios.
