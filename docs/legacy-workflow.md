# Referência do fluxo legado

## Proveniência e limite

Esta é uma descrição sanitizada da investigação do main em 20–21/10/2026, complementada pela conferência estática da planilha movida para a raiz do projeto em 21/10/2026. Não contém o código VBA original, dados de trabalho, endereços do servidor ou credenciais.

A planilha privada é uma referência local, ignorada pelo Git. Seu VBA foi identificado como igual ao material analisado anteriormente. Não há uma correção validada da planilha nem uma aplicação web entregue.

## Fluxo identificado

1. O usuário prepara linhas de apontamento, organizadas por data em uma planilha mensal.
2. A macro lê essas linhas e monta coleções de dias e detalhes de tarefas.
3. O formulário oferece seleção de dias/tarefas, consulta ao Redmine e filtros de apropriação.
4. O login obtém token de formulário e mantém cookie de sessão.
5. O envio de horas usa um formulário HTTP com tarefa, data, duração, comentário e identificador de atividade.
6. Há envio individual e coletivo. O laço coletivo interrompe ao receber uma falha e ignora itens já identificados como apropriados.
7. Pode haver uma alteração opcional de status da tarefa depois do apontamento.
8. O Excel registra informações locais de apropriação e atualiza descrição/status.

Os efeitos exatos de uma falha parcial na persistência local e no reenvio não foram validados por um teste completo. Conferir esses caminhos antes de reproduzi-los.

## Mapa para leitura estática do VBA

Os nomes abaixo são pontos de entrada identificados, não arquivos distribuídos neste repositório.

| Módulo/classe/formulário | Responsabilidade e pontos úteis |
| --- | --- |
| `FuncoesDaPlanilha` | Soma de durações (`SomarAPartirAte`), atualização de células (`AtualizarApropriacao`, `AtualizarDescricaoStatus`), inclusão do modelo de dia (`ObtenhaModeloDeApropriacao`) e início do login (`IniciarLogin`) |
| `FuncoesFormulario` | Leitura da planilha (`ObtenhaColecaoDeApropriacoesPlanAtiva`), validação coletiva (`ValideApropriacaoColetiva`), conversão de descrição para código (`ObtenhaEnumeradorDoTextoAtividade`) e status |
| `PostService` | `Logar`, `ApropriacaoColetiva`, `ApropriarIndividual`, `ObtenhaPostDataApropriacao`, consultas e `MudarStatusIssueRedmine` |
| `Apropriacao` / `ApropriacaoDetalhe` | Organização dos dias e dados dos apontamentos |
| `Enumerador` | Enumerações de atividades/status com números fixos |
| `FormLogin` / `FormApropriacao` | Interface do Excel e ações do usuário |

## Dados mínimos a representar na web

Data de trabalho, número da tarefa, duração, atividade (nome e ID, com contexto de projeto), comentário, status opcional solicitado e situação local do envio. Guardar separadamente o resultado da criação das horas e o resultado de uma mudança de status.

Proposta: duração em minutos inteiros e data de trabalho como data de calendário, sem usar a representação numérica de datas do Excel como contrato web. Essa adaptação deve preservar os resultados observáveis.

## Defeito confirmado no catálogo de atividades

A tabela da aba de validações mantém códigos em H e descrições em I. Entretanto, a função `ObtenhaEnumeradorDoTextoAtividade` usa um `Select Case` ligado a uma enumeração fixa; ela não lê H/I para resolver os códigos de envio.

Além disso, a lista suspensa do modelo e da planilha mensal usa um intervalo fixo da coluna I, terminando na linha 14 na cópia inspecionada. Adicionar linhas à tabela não atualiza automaticamente esse intervalo nem a conversão no VBA.

Durante a consulta autenticada ao Redmine, foram encontrados os dois tipos pedidos por Cristian. Também foi observada a mesma descrição com IDs diferentes em projetos distintos. Os valores reais não são defaults públicos: o novo aplicativo deve usar configuração por ambiente/projeto, com exemplos fictícios.

## Integração: cuidados ao portar

- A apropriação utiliza POST de formulário e sessão; alguns caminhos de consulta/movimentação usam API. Não pressupor que todas as operações já usam a mesma autenticação.
- Há um caminho de extração de chave de API, mas sua ativação no login precisa ser conferida: a chamada aparece comentada no legado analisado.
- O código legado contém tratamento que ignora erros de certificado. Isso não é uma decisão aprovada para o novo aplicativo.
- O primeiro acesso falhou por DNS antes da VPN; depois houve falhas de certificado por nome e validade. Em 21/10, Cristian autenticou o navegador pessoalmente e a leitura de formulários funcionou. Isso é histórico, não prova de acesso atual do backend.
- O endpoint XML de atividades respondeu com erro de autenticação apesar da sessão web. Os IDs foram lidos das opções do formulário de horas; a falha não prova API desabilitada.
- O legado considera HTTP 200 em alguns caminhos; na migração é necessário confirmar o contrato de sucesso do transporte real e evitar falso positivo.
- Um apontamento criado e uma movimentação de status são operações separadas. Uma falha na segunda não significa que as horas não foram gravadas.

## Limite das validações históricas

Foram feitas extração/leitura estática e consultas autenticadas somente de leitura. Não foi criado apontamento real para testar o fluxo. Uma tentativa de edição binária do VBA em cópia temporária não concluiu a validação no Excel; esse arquivo não é uma base confiável e não deve ser incorporado à aplicação ou distribuído.

## Fontes públicas para conferir contratos

- [Autenticação Redmine](https://www.redmine.org/projects/redmine/wiki/Rest_api#Authentication).
- [Time entries](https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries).
- [Enumerações de atividades](https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations).

A documentação oficial descreve o produto Redmine. Compatibilidade com a versão e as customizações da instância privada ainda precisa ser verificada.
