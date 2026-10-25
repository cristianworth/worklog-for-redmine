# Decisões e aprendizados do projeto

Atualizado em 24/10/2026. Referência para decisões futuras; o histórico de entregas fica no [changelog](../CHANGELOG.md) e o trabalho pendente no [roadmap](../ROADMAP.md).

## Atividades: decisão vigente

- Usar um catálogo único de **nome + código da atividade** para a instância configurada do Redmine. O banco de uso tem 15 atividades, sem cópias por projeto. Esse número descreve o cadastro atual, não um limite fixo do sistema ou uma lista pública inicial.
- O projeto agrupa cards no Redmine; o card identifica a tarefa; a atividade classifica as horas. São campos diferentes. Consultar o card informa descrição, status e projeto, mas não precisa liberar a escolha da atividade.
- Dias e modelo usam o mesmo catálogo, disponível antes de preencher o card. Nomes e códigos são únicos; a aplicação não escolhe uma atividade automaticamente.
- O VBA consultado converte o nome em um código fixo e envia esse código com o card. A conversão não depende do projeto. A duplicação por projeto acrescentada inicialmente na aplicação foi uma decisão de implementação, não uma exigência da planilha.
- A lista fornecida foi comparada por nome com a API atual. Quatro códigos foram corrigidos com autorização. Códigos antigos diferentes não devem ser tratados como equivalentes sem evidência; nomes iguais, sozinhos, não provam essa equivalência.

## O que os testes demonstraram

Em 24/10/2026, dois lançamentos autorizados usaram **o mesmo código de atividade em cards de dois projetos diferentes**. Ambos tiveram confirmação técnica, leitura correspondente e status mantido. Cristian conferiu visualmente no Redmine e confirmou que os dois ficaram com o tipo de atividade esperado.

Isso demonstra a reutilização daquele código nesses dois projetos. O teste não comparou um código antigo com o atual, não explicou a origem da divergência e não validou todas as atividades em todos os projetos. Não apresentar esses pontos como comprovados.

Antes de um próximo teste, explicitar a pergunta e qual campo será alterado: comparar dois códigos no mesmo card responde a uma pergunta diferente de manter o código e trocar de card/projeto. Usar consultas e testes simulados primeiro; um envio real exige alvo e campos autorizados. As autorizações anteriores já foram consumidas e não podem ser repetidas.

## Regras para próximas implementações

| Aprendizado | Consequência prática |
| --- | --- |
| O usuário recompõe vários dias em uma sessão, frequentemente até uma quarta-feira | Usar período livre, dias por scroll e cópia rápida do código; evitar uma semana fixa de segunda a sexta |
| Salvar rascunhos e enviar horas são intenções distintas | Manter salvamento local explícito e revisão/confirmar antes de qualquer envio |
| Um catálogo disponível na tela não comprova permissão remota | Preservar a validação integral do lote e conferir disponibilidade por projeto quando a API fornecer essa lista |
| A API de projetos dessa instância não forneceu a lista de atividades | Identificar a limitação; não concluir que uma atividade é proibida apenas por faltar essa lista. A criação ainda pode ser recusada pelo Redmine |
| Um envio pode ter sucesso antes de ocorrer uma falha de resposta | Persistir o início e o resultado, conferir por leitura e manter a trava de reenvio em casos incertos |
| Alterar o catálogo não altera o que já foi apropriado | Preservar snapshots, códigos e datas dos recibos; a exclusão remota não autoriza destravar ou recriar automaticamente |
| Dados de uso podem ter sido editados entre sessões | Comparar uma migração com o backup imediatamente anterior, sem restaurar dados apenas para coincidir com uma referência antiga |
| Uma possibilidade técnica não é uma necessidade comprovada do fluxo | Manter a estrutura simples. Só propor exceções por projeto quando uma incompatibilidade concreta justificar a mudança |

## Dados e demonstração

O modo local usa Node e SQLite; uma instalação nova começa sem dados reais e com catálogo vazio. O cadastro de 15 atividades pertence ao banco privado de uso, não aos exemplos distribuídos.

A demo deve usar somente exemplos e códigos fictícios, catálogo único, persistência própria do visitante e envio simulado. Deve reaproveitar a interface e as regras, sem acessar a API local, o SQLite de uso ou o Redmine real. Publicar o repositório não publica a demo nem o backend.

Em 25/10/2026, P7-A–E implementados na v0.5.0, com commit/push autorizados por Cristian. Snapshot schema 2 aceita dados de P7-B sem apagar edições; recibos/lotes/criações fictícios compartilham o mesmo registro. Web Locks coordenam mutações por origem quando disponíveis; sem a API, a interface orienta uma aba por vez. Recarregar não retoma lotes, conferência não recria resultados e restauração é serializada com o trabalho aceito. 342 testes/25 arquivos, builds/auditoria e instalação limpa sem configuração privada aprovados; teclado, tela menor, seleção inválida, recarga e restauração conferidos manualmente. CI de verificação adicionada; hospedagem e avaliação independente de visitante continuam na P8. Detalhes em [acesso aos dados](data-access.md).

Planilha, VBA, configuração, bancos, backups, alvos e resultados detalhados dos testes ficam fora do Git. Os registros operacionais continuam nos arquivos privados já existentes. A confirmação visual do usuário não confirma que ele já excluiu os testes; não executar essa exclusão ou importar seus recibos para o banco de uso automaticamente.

## Referências para conferir o comportamento

- [Catálogo e validação](../src/shared/activities.ts), [persistência e migração](../src/server/storage.ts), [preparação e envio](../src/server/submissions.ts).
- [Modelo do dia](day-template.md), [envio individual](individual-submission.md) e [lotes](batch-submission.md).
- [Referência histórica do VBA](legacy-workflow.md): descrições antigas por projeto foram substituídas pela decisão vigente acima.
