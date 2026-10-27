# Interface e identidade visual

A interface funciona como uma agenda de apontamentos: localizar uma data, preencher suas linhas e conferir o total antes de salvar ou revisar um envio. O modo local e a demo usam os mesmos componentes e estilos.

## Cores com uma função

A paleta usa cinzas frios e um único azul acinzentado nas ações. Os cabeçalhos alternam dois fundos suaves conforme a posição dos dias no período visível, como faixas de uma planilha. Não há mais uma cor associada a cada dia da semana.

| Uso | Cor |
| --- | --- |
| Fundo da página | `#F5F7F8` |
| Área de edição | `#FFFFFF` |
| Primeiro cabeçalho e demais ímpares | `#EDF2F4` |
| Segundo cabeçalho e demais pares | `#DEE7EB` |
| Texto principal | `#273B46` |
| Ações e foco | `#486B7A` |

A alternância separa grupos, não resultados. Pendência, simulação, confirmação, rejeição e resultado incerto continuam descritos em texto e nos recibos. O marcador **Hoje** e uma linha lateral discreta identificam a data atual. Recolher ou apropriar um dia não altera a alternância; mudar o início do período pode inverter o tom de uma data.

O espaçamento entre dias e as divisórias das tabelas separam os grupos. Linhas alternadas ajudam a acompanhar os campos; seleção e situação dos recibos têm tratamentos próprios. Uma duração inválida mantém a indicação textual de total parcial.

## Marca, tipografia e manutenção

- `src/client/assets/worklog-mark.svg` é a marca compartilhada pelo cabeçalho e favicon. As cinco colunas representam registros de horas ao longo da semana. O vetor é original do projeto, sem biblioteca de marcas, scripts ou recursos externos.
- O Vite publica esse arquivo sob a base de cada build. A auditoria aceita somente SVG passivo com as primitivas usadas na marca; mantém a rejeição de arquivos privados, referências à API e recursos ausentes. O lançador inclui SVG no cálculo que identifica um build desatualizado.
- Títulos usam Trebuchet MS com alternativas locais; formulários usam Segoe UI/Helvetica Neue e a fonte sans-serif disponível. Não há download de fontes. Os números das durações usam alinhamento tabular.
- Tokens e regras ficam em `src/client/styles.css`. Altere os tokens existentes antes de criar novos tons; mantenha o contraste do texto e do foco em cada cabeçalho. A aparência exata da tipografia varia com as fontes instaladas.
- Configurações, modelo e revisões compartilham os campos e botões do editor. A apresentação não altera contratos de dados, revisões, seleção ou confirmação de envios.

## Conferência de mudanças visuais

Use a demo e dados fictícios; nunca o banco de uso para preencher capturas. Confira desktop, tablet e 375 px, incluindo:

1. Dias adjacentes, inclusive entre semanas: os dois tons alternam pela posição visível e continuam distintos com as tarefas recolhidas.
2. Edição, duração abreviada/inválida, atividade, total, seleção e botão de salvar. Recolher e reabrir mantém os campos e as edições.
3. Salvar e recarregar; revisar, cancelar e confirmar uma simulação; expandir um dia apropriado e conferir o recibo.
4. Modelo, catálogo, avisos e revisão em tela pequena. Somente tabelas largas devem rolar horizontalmente, preservando os campos editáveis.
5. Teclado, foco visível, movimento reduzido e nomes acessíveis. A cor nunca deve ser o único meio de identificar uma data ou situação.
6. Marca e favicon carregando tanto na raiz quanto em `/worklog-for-redmine/`.

A imagem do [README](../README.md) deve acompanhar a aparência entregue, usando apenas exemplos fictícios.
