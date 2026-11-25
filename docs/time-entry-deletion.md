# Exclusão de lançamentos de horas

## Uso

Uma linha apropriada com ID remoto confiável permite **Remover linha**. Salve as alterações do dia antes de abrir a exclusão. A confirmação mostra tarefa, data, duração, atividade, observação e ID do lançamento, avisando que ele será excluído do Redmine e do Worklog. A tarefa/card permanece no Redmine. Cancelar ou pressionar Esc antes de confirmar não altera dados.

O backend consulta a conta atual, confere a instância e lê o ID remoto do recibo. Compara usuário, tarefa, projeto, data, minutos, atividade e observação com o snapshot original, sem depender do catálogo atual ou do cache de tarefas. Só então solicita `DELETE time_entries/:id.json`, respeitando as permissões do Redmine. A API não oferece uma operação condicional que elimine a possibilidade de edição por outro aplicativo entre essa leitura e o DELETE.

Somente HTTP 204 comprova a exclusão para este fluxo. A confirmação remota é persistida antes da transação que remove a linha, incrementa a revisão atual do dia e registra o recibo como `deleted`. Outras linhas, inclusive alterações salvas durante a espera remota, permanecem intactas. Não é necessário clicar em Salvar novamente para persistir essa remoção. O recibo mantém o ID remoto, snapshot, datas originais e eventos da exclusão; os lotes passam a exibir o resultado atualizado e o histórico. Linhas sem lote continuam auditáveis pela lista de recibos do período na API local.

## Proteção e recuperação

| Resultado | Comportamento |
| --- | --- |
| Sem ID confiável, envio iniciado/incerto | Remoção bloqueada; use a conferência do envio para identificar um resultado correspondente |
| Conta/instância diferente, leitura indisponível ou campos divergentes | Nenhum DELETE; linha protegida |
| Mais de uma linha vinculada ao mesmo ID remoto | Exclusão bloqueada; os vínculos exigem análise manual, sem escolher uma linha silenciosamente |
| HTTP 400/401/403/405/422 no DELETE | Exclusão recusada; confira permissões/campos antes de confirmar uma nova tentativa |
| Timeout, conexão perdida, redirecionamento, 404, 200 ou outra resposta ambígua | Exclusão incerta; linha protegida, sem repetição automática |
| HTTP 204 persistido, mas transação local falha | **Ver resultado → Conferir exclusão** conclui somente a remoção local, usando a confirmação persistida |
| Interrupção antes de persistir o 204 | A confirmação remota pode ter se perdido; a linha continua protegida |

**Conferir exclusão** consulta, sem enviar outro DELETE. Depois de uma interrupção em `deleting`, aguarde um minuto. Uma leitura correspondente permite uma nova tentativa deliberada, com outra confirmação. Ausência/404 não comprova exclusão: o registro pode estar oculto por permissões. Nesse caso, a linha permanece protegida e o resultado exige conferência manual; não há desbloqueio automático ou ferramenta de descarte de recibos nesta entrega.

O SQLite serializa o início e a conclusão, e conferências antigas não podem sobrescrever uma exclusão mais recente. Cliques repetidos não reenviam a exclusão em andamento. Um recibo excluído impede que um salvamento antigo restaure seu ID de linha; seu fingerprint deixa de bloquear uma nova linha criada deliberadamente. Não restaure bancos antigos para contornar esse histórico. O lançador recusa encerramento normal durante a requisição de exclusão.

## Demo e testes

A demo usa o mesmo contrato de acesso substituível. Exclui somente a criação fictícia e a linha do snapshot do navegador, em uma única gravação serializada por Web Locks quando disponíveis. Falha de armazenamento preserva o snapshot inteiro. O recibo fica marcado como simulado; não há HTTP, SQLite ou acesso ao Redmine. Snapshots anteriores continuam aceitos.

Os testes usam serviços fictícios e bancos temporários. Cobrem confirmação HTTP, conferência de identidade, respostas remotas, incerteza, interrupção, falha transacional e recuperação, concorrência, preservação de outras linhas, tombstones e persistência da demo. Nenhuma exclusão real faz parte da validação desta funcionalidade. Permissões e particularidades da instância real só podem ser verificadas com autorização específica de alvo.

Contrato remoto: [Redmine REST Time Entries — deleting a time entry](https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Deleting-a-time-entry).
