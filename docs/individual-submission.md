# Envio individual

## Fluxo entregue

Salvar rascunhos continua apenas local. Para enviar, salve o dia, selecione uma linha pelo controle da primeira coluna e use **Enviar selecionados**. A P4 reutiliza o contrato individual em uma revisão de lote, inclusive para uma única linha; veja [batch-submission.md](batch-submission.md). A revisão consulta a conta, tarefa, projeto, atividade e lançamentos equivalentes. Exibe data, duração, observação, atividade/código e **Manter** para o status. Só o botão de confirmação solicita criação.

A revisão expira após 15 minutos. Uma alteração no dia, no catálogo, no projeto/atividade ou na conta/servidor exige nova revisão. Uma linha recusada pode ser corrigida e revisada novamente; não há repetição automática. A conferência de duplicidade é conservadora: mesmo usuário, servidor, tarefa, projeto, dia, atividade, minutos e observação. Lançamentos idênticos já existentes não são criados de novo.

O catálogo manual resolve nome + projeto para ID. Quando a API oferece atividades do projeto, o código é conferido antes de enviar. Nesta instância, o include de atividades não foi disponibilizado: a revisão informa isso e o servidor valida o ID na criação. O teste autorizado usou um único candidato com o nome exato retornado pela enumeração real, no contexto do projeto; sua aceitação foi confirmada pelo registro criado. Isso não importa um catálogo nem prova aceitação de outros IDs/projetos.

## Estados e persistência

| Estado         | Consequência                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Preparado      | Nenhuma criação; revisão salva localmente e ainda precisa de confirmação                                             |
| Envio iniciado | Gravado no SQLite antes do POST; bloquear alteração, remoção e repetição da linha                                    |
| Confirmado     | HTTP 201 com identificador e campos correspondentes, ou leitura posterior do registro criado; guardar ID remoto      |
| Já existente   | Equivalente encontrado antes da criação; nenhum novo POST; guardar vínculo quando único                              |
| Recusado       | Falha antes da criação ou resposta HTTP de rejeição definida; permitir correção e nova revisão explícita             |
| Incerto        | Resposta perdida, erro de servidor, redirecionamento, HTTP 200 ou confirmação inválida após POST; bloquear repetição |

Resultados ficam em `submission_records`, no mesmo banco ignorado pelo Git, separados do conteúdo dos rascunhos. Um índice impede envios simultâneos equivalentes neste banco. Editar/remover linhas iniciadas, confirmadas, existentes ou incertas é bloqueado também no backend; outras linhas continuam editáveis.

**Ver resultado → Conferir resultado** só consulta. Se o processo foi interrompido durante um envio iniciado, aguarde um minuto antes de conferir. Uma leitura com um único registro correspondente pode confirmar; ausência, ambiguidade ou falha não libera reenvio. Se não resolver, conferir manualmente no Redmine. A criação não usa uma chave de idempotência fornecida pelo servidor; não há garantia de exclusão contra outro aplicativo criando o mesmo registro simultaneamente, e o banco/recibos precisam ser preservados.

## Contrato e adaptação do legado

O VBA consultado usa formulário + cookie e envia tarefa, data, horas, observação e atividade. A validação coletiva exige tarefa/data/observação/atividade; a chamada individual segue diretamente para o serviço. Nesta etapa, campos incompletos continuam permitidos no rascunho, enquanto a preparação exige tarefa/data válidas, duração informada, observação não vazia e mapeamento da atividade. Zero, datas futuras, limites diários e limites de comentário dependem da configuração do servidor; não foi inventada uma política fixa para a instância.

O transporte implementado utiliza `POST time_entries.json` com chave no cabeçalho, data explícita e duração `HH:MM`, preservando minutos sem o wrap do Excel. A leitura compara o retorno em minutos, considerando o arredondamento normal das horas do servidor. Não envia `user_id`, campos de status, PUT de tarefa ou exclusões. O transporte com exceção de certificado aceita POST somente no caminho exato de criação da base configurada; não segue redirecionamentos nem altera TLS globalmente.

O legado considera HTTP 200 e mistura o retorno da criação com a movimentação opcional do card. Essa fragilidade não foi portada: a confirmação requer o contrato da API e a movimentação foi retirada do escopo por Cristian em 23/10/2026; o status permanece inalterado. Rejeições e mensagens de falha não expõem respostas remotas brutas ou credenciais.

- [Criação e consulta de horas — Redmine](https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries)
- [Conversão e validação de horas — modelo oficial](https://github.com/redmine/redmine/blob/master/app/models/time_entry.rb)

## Verificação

Simulação cobre criação única, clique duplo, duplicatas, revisão obsoleta/expirada, troca de conta, atividade em outro projeto, rejeição, resposta inválida, perda de resposta após criação e recuperação depois de reabrir o banco. Conferência visual confirmou seleção/revisão, resultado e reconciliação sem nova criação.

O único teste real autorizado por Cristian foi executado em 22/10/2026: confirmação, leitura posterior correspondente e status mantido. Os campos e o ID remoto estão apenas em `private/authorized-time-entry-test.json`, fora do Git. O banco de uso não recebeu linhas de teste; a execução usou memória e um registro privado persistido antes da tentativa. A autorização está consumida: não repetir o lançamento.

Na P4.1, os recibos passaram a distinguir criação remota, primeira confirmação local e última conferência. **Conferir no Redmine** verifica também resultados já confirmados/existentes, sem desbloquear reenvio em caso de ausência ou divergência. Verde/check e datas por linha, resumo diário e incorporação do histórico confirmado estão descritos em [appropriation-status-plan.md](appropriation-status-plan.md).
