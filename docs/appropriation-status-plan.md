# P4.1 — Apropriações visíveis e início de uso real

Planejado em 22/10/2026 por pedido de Cristian, antes do modelo do dia (P5). Este documento registra análise e proposta; não implementa a interface nem importa dados.

## O que já existe e o que falta

P3/P4 já persistem estado e ID remoto, bloqueiam edição/remoção/reenvio de linhas confirmadas, existentes, iniciadas ou incertas e procuram equivalentes antes do POST. Há texto de resultado e cor suave. A classe visual atual é aplicada a todas as linhas bloqueadas, incluindo resultados ainda incertos; a P4.1 deve reservar o verde de conclusão para confirmação ou equivalência comprovada.

Faltam uma indicação clara de **Apropriado**, ícone e data na linha, resumo correto do dia completo/parcial, uma data de confirmação com significado próprio e a incorporação dos recibos reais no banco de uso. Os testes reais P4 ficaram em banco privado separado, portanto sua confirmação não aparece automaticamente nos rascunhos da aplicação.

## Evidência do VBA

Leitura estática de `AtualizarApropriacao` confirmou gravação da marca local de apropriação e da data corrente em colunas distintas. `ApropriacaoDetalhe` mantém `Apropriado` e `DataApropriacao`; `ObtenhaColecaoDeApropriacoesPlanAtiva` relê esses valores e considera o dia completo somente quando suas linhas estão apropriadas. O laço coletivo ignora linhas já marcadas. A data de trabalho e a data de apropriação são conceitos separados. Preservar esse comportamento sem portar a fragilidade de aceitar qualquer HTTP 200 como sucesso.

## Apresentação proposta

| Situação               | Linha                                                            | Ação                                                    |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Confirmado             | Fundo verde suave, ícone de check e **Apropriado em dd/mm/aaaa** | Ver resultado; impedir nova seleção e edição            |
| Equivalente comprovado | Verde e **Já apropriado no Redmine**                             | Exibir ID e origem da confirmação; impedir nova criação |
| Rascunho               | Aparência neutra e **Pendente**                                  | Editar, salvar e selecionar                             |
| Iniciado/incerto       | Amarelo e **Aguardando confirmação / Conferir resultado**        | Consultar sem reenviar                                  |
| Recusado               | Indicador vermelho com motivo                                    | Corrigir e preparar nova revisão                        |

O texto e o ícone devem transmitir o estado mesmo sem distinguir cores. No cabeçalho, mostrar **3 de 3 apropriadas** quando completo, ou **3 apropriadas · 2 pendentes** quando misto; resultados incertos devem aparecer separadamente. Contagens vêm dos recibos por linha. Manter os totais diários existentes, sem total semanal. Filtro Todos/Pendentes/Apropriados é uma melhoria opcional posterior de P6.

## Datas, confirmação e duplicidade

- Manter data de trabalho separada de confirmação e da última conferência. Hoje há `preparedAt`/`updatedAt`, mas nenhum campo explícito para a primeira confirmação. Propor `confirmedAt` imutável e `lastCheckedAt` para consultas futuras; a conferência não deve apagar a data original.
- Nos recibos próprios já confirmados, preservar o horário original documentado. Para lançamentos encontrados depois, usar a data de criação remota quando validada; se indisponível, informar **Conferido em…**, sem inventar quando foram apropriados.
- Acrescentar conferência explícita de apropriações por ID, somente leitura. Um lançamento removido ou divergente deve gerar aviso; não liberar automaticamente um recibo para reenviar.
- O número do card sozinho não identifica uma duplicata: a mesma tarefa pode receber horas em vários dias e em mais de uma linha no mesmo dia. Preservar a combinação de conta/instalação, tarefa, projeto, dia, atividade, minutos e observação. Sem recibo, equivalência exata é uma proteção conservadora; diferenças legítimas não devem ser bloqueadas só pelo card.

## Incorporação dos três dias confirmados

O SQLite atual já serve ao uso real local. Os nove lançamentos confirmados possuem entradas, IDs remotos e resultados no registro/banco privado do P4. Na leitura do banco de uso foram encontrados rascunhos não correspondentes em um desses dias; preservar essas linhas sem marcá-las como apropriadas. O catálogo local ainda está vazio, o que também precisa ser considerado ao preparar futuros lançamentos. Todos os valores reais permanecem somente na área privada.

Planejar uma incorporação local controlada: criar backup consistente; conferir novamente os nove IDs usando a conta/instalação original; comparar os campos; associar uma linha local idêntica quando única ou adicionar uma nova quando ausente. Conflitos e correspondências ambíguas devem ser apresentados antes da gravação. Importar linhas e recibos juntos em transação, mantendo IDs, identidade da conta/servidor, proteção contra duplicidade e data original; registrar a origem da importação separadamente. Reexecutar a incorporação deve produzir zero duplicatas.

Importar não solicita criação, alteração de status ou exclusão no Redmine, não apaga rascunhos locais e não restaura a autorização de teste já consumida. Os recibos importados são reconhecidos mesmo com catálogo manual ainda vazio; configurar as atividades necessárias para novos lançamentos é uma ação separada. Banco, backups, alvos e configurações continuam fora do Git; a demo continua usando somente dados fictícios isolados.

## Chunks e validação

| Chunk              | Entrega                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Estado e datas | Definir confirmação imutável, origem e última conferência; compatibilidade com recibos existentes; distinguir confirmação de início/incerteza |
| B — Sinalização    | Verde + check + Apropriado/data por linha; resumo completo/parcial do dia; preservar bloqueios e leitura dos detalhes                         |
| C — Conferência    | Consulta por ID sem POST; divergência ou ausência mantém bloqueio; datas e status não são inventados                                          |
| D — Dados reais    | Backup e incorporação dos três dias com recibos; preservar rascunhos preexistentes; operação repetida não duplica                             |

Vitest deve cobrir preservação de datas/IDs, equivalência e lançamentos legítimos no mesmo card, restauração/reabertura e importação atômica/repetida com linhas locais extras. Conferir visualmente estados e resumo misto usando dados fictícios. A etapa só fica concluída quando os nove registros reais aparecerem apropriados no banco de uso, sem novo envio. A implementação está pendente.
