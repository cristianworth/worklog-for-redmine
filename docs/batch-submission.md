# Envio por dia ou período

## Uso

Salvar continua apenas local. **Enviar dia**, com ícone de sincronização, abre a revisão das linhas pendentes salvas daquele dia. Os checkboxes das linhas e do cabeçalho do dia permitem selecionar vários dias e usar **Enviar selecionados**. A revisão mostra exatamente a seleção, agrupada por data, e os impedimentos por linha. Nenhuma criação ocorre até a confirmação. Dias com edições não salvas exigem salvar primeiro; resultados confirmados, existentes, iniciados ou incertos não entram em uma nova seleção.

O limite é de 100 linhas por lote; a ordem é a ordem da seleção. A revisão expira após 15 minutos. Impedimentos de preparação bloqueiam a confirmação de todo o lote; corrija e abra outra revisão. As revisões locais de todos os dias e do catálogo são conferidas antes da primeira criação. Antes do primeiro POST, o backend confere conta, tarefa/projeto e atividade de **todas as linhas pendentes selecionadas**, usando consultas atuais independentes do cache de preenchimento. Códigos/projetos repetidos compartilham leituras somente nessa validação. Se uma tarefa estiver inválida/inacessível ou houver outro impedimento, **nenhuma hora de nenhum dia do lote é enviada**: o resultado identifica data, linha, código e motivo, e exige corrigir/preparar uma nova revisão. As revisões locais são conferidas novamente após as consultas. A conferência individual de contexto e equivalentes remotos continua antes de cada criação.

## Execução e recuperação

O backend grava o lote como iniciado antes de executar sequencialmente. Cada linha usa o serviço de envio individual e seu recibo durável; não existe POST remoto coletivo nem garantia de transação entre vários lançamentos. A primeira rejeição, incerteza ou falha interrompe o lote. As anteriores ficam confirmadas; as seguintes ficam **Não enviado**. Esse comportamento preserva o laço coletivo conferido diretamente em `ApropriacaoColetiva`, que ignora apropriados e interrompe na primeira falha.

`submission_batches` armazena a seleção/revisão e o resultado do lote no mesmo SQLite; `submission_records` mantém os recibos por linha. A inclusão dessas tabelas não reescreve os dias. O SQLite inteiro deve ser preservado nos backups. Um segundo clique não inicia outro trabalhador do mesmo lote; não há repetição automática.

Fechar/recarregar a página após confirmar não cancela o trabalho no backend. **Envios recentes neste período → Ver lote** reabre os resultados; **Atualizar resultados** apenas lê o banco local. O histórico lista até 20 lotes iniciados do período, com os cinco mais recentes exibidos na barra. Depois de reiniciar o servidor, um lote iniciado sem trabalhador ativo aparece como interrompido e não é retomado. As linhas não enviadas precisam de uma nova seleção/revisão/confirmar. O aplicativo é de um único processo local, sem fila distribuída.

Um resultado incerto continua bloqueado. **Ver resultado → Conferir resultado** consulta o Redmine sem POST e pode confirmar a linha; isso não retoma o restante do lote. Equivalentes idênticos continuam bloqueados conservadoramente; não há chave de idempotência remota ou proteção contra outro aplicativo criando horas simultaneamente. Não restaurar um backup antigo para forçar reenvio, nem apagar recibos após excluir um lançamento remoto.

Status dos cards permanece **Manter**. Alteração de status, modelos do dia e demo pública continuam etapas próprias.

## P4.2 — consulta e validação antecipada

Sair do campo de código consulta descrição/status/projeto automaticamente. Trocar o código cancela a consulta anterior e ignora sua resposta; a consulta não muda observação, duração ou revisão salva. **Atualizar tarefa** força nova leitura. O cache de preenchimento fica em memória no backend por 10 minutos, limitado às 500 tarefas mais recentes, por cliente/configuração; compartilha pedidos simultâneos, não guarda erros e desaparece ao reiniciar. Não comprova validade permanente nem permite pular a validação anterior ao envio.

190 testes em 13 arquivos e build aprovados. A interface foi conferida em SQLite em memória e Redmine fictício, usando 22 e 23/10: consulta por Tab, reutilização de uma única requisição para o mesmo código em dois dias, troca rápida de código e lote bloqueado com data/tarefa identificadas. Nenhuma criação real. Os dias 19–21/10 do banco de uso e seus recibos foram preservados integralmente.

## Verificação histórica P4

158 testes em 11 arquivos passaram, com build aprovado. Casos novos incluem um dia completo, dois dias juntos, revisão inválida/obsoleta/expirada, catálogo alterado, duplicatas, confirmação concorrente, rejeição parcial, resposta perdida e reabertura do banco. A interface foi conferida em instância separada com dados fictícios: seleção por dia, revisão, criação, resultado incerto e linhas posteriores não enviadas.

Cristian deu nova autorização explícita em 22/10/2026 para dois lotes reais, um dia primeiro e dois dias juntos depois, todos mantendo status. Os campos e resultados originais dos testes ficam em `private/authorized-batch-tests.json` e `private/authorized-batch-tests.sqlite`, ignorados pelo Git. Isso é separado da autorização individual anterior e não autoriza reenvios gerais. Os testes usaram um banco separado; na P4.1, esse histórico confirmado foi incorporado ao banco de uso com recibos e backup, sem reenviar horas; não copiar a planilha histórica para uma fila. Os dois lotes foram concluídos e os nove lançamentos confirmados por leitura posterior, com status mantidos. A autorização desses testes está consumida: não repetir nem estender os alvos. Os recibos e IDs remotos permanecem na área privada.
