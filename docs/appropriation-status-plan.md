# P4.1 — Apropriações visíveis e início de uso real

Entregue em 23/10/2026, antes do modelo do dia (P5). A proteção contra reenvio da P3/P4 foi preservada e os três dias confirmados foram incorporados ao banco de uso.

## Interface e estados

| Situação                            | Indicação                                                         | Consequência                                          |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Confirmado                          | Verde + check, **Apropriado**, ID e data                          | Ver resultado; impedir nova seleção, edição e remoção |
| Equivalente comprovado              | Verde e **Já apropriado no Redmine**                              | Guardar vínculo quando único e impedir nova criação   |
| Rascunho                            | Neutro e **Pendente**                                             | Editar, salvar e selecionar                           |
| Iniciado/incerto                    | Amarelo e **Aguardando confirmação / Conferir resultado**         | Consultar sem reenviar                                |
| Confirmação divergente/indisponível | Amarelo e **Apropriação a conferir**, preservando a data original | Conferir manualmente; não liberar reenvio             |
| Recusado                            | Indicador vermelho com motivo                                     | Corrigir e preparar nova revisão                      |

O texto e o ícone complementam a cor. O cabeçalho distingue dia completo (**3 de 3 apropriadas**), misto (**3 apropriadas · 2 pendentes**) e resultados a conferir. O total diário continua incluindo todas as linhas, inclusive rascunhos; não há total semanal. A identidade do lançamento continua considerando conta/instalação, tarefa, projeto, data, atividade, minutos e observação: repetir o mesmo card em dias ou linhas legítimas não é proibido.

## Datas e conferência

- Data de trabalho permanece em `snapshot.date`. `confirmedAt` guarda a primeira confirmação local; `remoteCreatedAt` armazena a criação remota quando validada. `lastCheckedAt` identifica a última conferência, sem substituir essas datas.
- A interface mostra **Apropriado em** para criação remota conhecida, **Confirmado em** para confirmação local sem data remota e **Conferido em** quando apenas uma equivalência foi verificada. Não inventa a data original de um registro encontrado depois.
- Recibos antigos confirmados preservam seu carimbo terminal como confirmação local. Recibos antigos de equivalência recebem data de conferência, sem uma criação presumida. A normalização é compatível e não reescreve rascunhos ao abrir o banco.
- **Ver resultado → Conferir no Redmine** usa somente consultas. Conta/instalação devem corresponder ao recibo. Um ID ausente pode também estar oculto para a conta; divergência de campos e falha de acesso recebem avisos distintos da confirmação original. Nenhum caso libera automaticamente outra criação.

## Incorporação controlada

`createConfirmedImportService` valida recibos, identifica uma vez a conta/instalação e confere cada ID remoto antes de gravar. `store.importConfirmed` associa uma linha local idêntica quando única ou adiciona uma nova, e grava dias/recibos em uma transação. Ambiguidade, vínculo protegido ou conflito desfazem toda a gravação. Repetir a incorporação não duplica linhas/recibos nem altera a data original. O catálogo manual não é preenchido pela importação; os recibos incorporados mantêm o código de atividade já revisado.

Os nove registros dos lotes P4 foram incorporados em 23/10/2026: nove linhas e recibos confirmados, dois rascunhos preexistentes preservados, backup consistente feito com a API SQLite antes da importação. Houve dez consultas remotas e **zero gravações remotas**. O banco foi reaberto/conferido e os registros mantiveram IDs e datas. Os testes originais continuam com autorização consumida; importar não é reenviar.

O banco de uso é `data/worklog.sqlite`. O registro da operação e o caminho do backup estão em `private/p41-confirmed-history-import.json`; o backup fica em `backups/`. Todos permanecem ignorados pelo Git. A operação foi feita para o histórico específico autorizado, sem um importador genérico por upload ou importação ampla da planilha.

## Legado e validação

A leitura estática de `AtualizarApropriacao` confirmou marca local e data corrente em colunas distintas; `ApropriacaoDetalhe` mantém `Apropriado` e `DataApropriacao`. A leitura da coleção recupera esses valores e calcula se o dia está completo. Esse comportamento foi preservado sem assumir que qualquer HTTP 200 confirma criação.

175 testes em 12 arquivos passaram, com build aprovado. Os novos casos cobrem datas, recuperação de resposta perdida, verificação por ID, conta incorreta, bloqueios, resumo completo/misto e importação repetida/atômica com linhas extras, além de backup recuperável. Revisão visual em banco fictício confirmou verde/check/data, resumo misto, aviso amarelo para um registro removido e preservação da confirmação original.

Próxima etapa: P5, modelo do dia. Filtro Todos/Pendentes/Apropriados continua melhoria opcional de P6. Configurar atividades para novos envios permanece uma ação manual separada; demo pública continua isolada e posterior.
