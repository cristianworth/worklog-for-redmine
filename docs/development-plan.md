# Plano de desenvolvimento

## Objetivo e fluxo real

Construir o **Worklog for Redmine**, uma aplicação pequena, pessoal e inicialmente local, portando o fluxo útil do Excel/VBA para a web. O resultado deve ser utilizável e demonstrável em portfólio, com documentação e estrutura proporcionais.

Cristian costuma reconstruir vários dias em uma mesma sessão e enviar o período depois, frequentemente às quartas. O intervalo é livre, não uma semana fixa. A mesma tarefa pode aparecer em dias seguidos. Preservar navegação por scroll, cópia rápida do código, totais por dia e separação entre **Salvar rascunhos** e **Enviar ao Redmine**. Não acrescentar total semanal ou cópia de linhas para outros dias sem nova necessidade.

## Decisões vigentes

- Nome e repositório: **Worklog for Redmine** / `worklog-for-redmine`.
- Node.js, React, Vite, TypeScript, Express e SQLite aprovados. Manter um repositório e uma estrutura simples. shadcn/ui permanece adiado.
- Vitest para regras e persistência; interface conferida manualmente. BDD, Cucumber e formalização obrigatória de cenários dispensados. Playwright pode ser adotado depois se trouxer benefício.
- Salvar é explícito. O navegador lembra apenas preferências; os rascunhos locais ficam no SQLite. O banco é aberto junto com o Node e persiste entre execuções.
- Commits coesos e pushes ordinários autorizados. Permanecer na `master`. Antes de qualquer commit/merge, conferir regras de changelog/versionamento. A versão interna continua 0.1.0, sem release pública ou changelog.
- Criar o GitHub segue autorizado, mas confirmar conta e visibilidade e resolver licença/proveniência antes da primeira publicação. Não publicar a planilha, VBA, bancos locais, credenciais, hostnames ou dados reais.
- **Demo pública deve ficar entre as últimas etapas**, conforme decisão de Cristian em 22/10/2026. Preparar identificação/atalho agora não significa implementar ou publicar a demo.

## Roadmap revisto em 22/10/2026

Acompanhe o checklist e os chunks atuais em [ROADMAP.md](../ROADMAP.md). O diagnóstico de acesso e o procedimento de validação real estão em [redmine-access.md](redmine-access.md).

| Etapa                                | Estado / entrega                                                                                     | Critério de conclusão                                                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 — Contexto e exemplos             | Concluído: contexto/plano aprovado em 21/10                                                          | Base e limites conferidos com Cristian                                                                                                                                                         |
| P1 — Primeiro fluxo local            | Concluído e validado por Cristian; base `dd8bd4d`                                                    | Editar, totalizar e recuperar um dia de rascunhos                                                                                                                                              |
| P1.1 — Preenchimento por período     | Entregue em `ce6bbba`; refinamentos absorvidos em P1.2                                               | Dias empilhados, intervalo livre, cópia do código, persistência de vários dias e proteção contra conflitos                                                                                     |
| P1.2 — Correções e hierarquia visual | Chunks A–D implementados para revisão nesta entrega                                                  | Fim previsível, consulta automática, destaque de envio/total, identificação do banco local e revisão integrada                                                                                 |
| P2 — Configuração, acesso e consulta | Concluído: autenticação e consulta real de leitura validadas; catálogo entregue em P2.1              | Configuração privada no backend, autenticação e consulta de descrição/status/projeto caracterizadas no VBA e verificadas em simulação; consultas reais somente de leitura quando houver acesso |
| P2.1 — Atividades configuráveis      | Implementado: catálogo manual por projeto no SQLite, edição e sugestões; 110 testes e revisão visual | Incluir/editar atividades sem alterar sugestões no código; resolver nome/ID no projeto correto antes do envio                                                                                  |
| P3 — Apropriação individual          | Entregue: revisão individual, envio/recibo e reconciliação; teste real autorizado confirmado         | Simulação, 142 testes e build aprovados; status mantido. Ver individual-submission.md                                                                                                          |
| P4 — Apropriação do período          | Entregue: Enviar dia, seleção múltipla, revisão e resultado persistido                               | Revisão antes do envio, resultado por linha e tratamento de falha parcial, sem reenviar registros confirmados ou incertos automaticamente                                                      |
| P4.1 — Apropriações e uso real       | Entregue antes de P5: estados/datas e histórico confirmado incorporado                               | Verde/check e data por linha; resumo de dia completo/parcial, conferência por ID e incorporação dos três dias com recibos preservados. Ver [plano](appropriation-status-plan.md)               |
| P5 — Modelo do dia                   | Portar preenchimento recorrente, como reunião diária                                                 | Conferir `ObtenhaModeloDeApropriacao` e o modelo privado; aplicar uma vez ao criar um dia, sem duplicar linhas ou sobrescrever dias existentes. Adicionar linha continua avulso                |
| P5.1 — Status e paridade restante    | Caracterizar movimentação opcional do card e demais funções úteis                                    | Uma falha ao mudar status não desfaz nem reenvia horas confirmadas. Conferir o fluxo real antes de portar                                                                                      |
| P6 — Consolidação local              | Teclado, mensagens, instruções e demonstrações sintéticas locais                                     | Fluxo de preenchimento e apropriação praticável; testes relevantes e documentação consistentes com o entregue                                                                                  |
| P7 — Modo de demonstração pública    | Entre as últimas etapas: adaptar a mesma interface a armazenamento isolado no navegador              | Dados exclusivamente fictícios, identificação permanente de demo, restauração dos exemplos e operações remotas simuladas. Nenhum acesso à API local, banco real ou Redmine real                |
| P8 — Publicação e apresentação       | Publicar código e demo após resolver destino/licença/proveniência                                    | Revisar conteúdo versionado e build; fornecer links para experimentar e executar localmente. Validar a demo hospedada e a separação dos dados                                                  |

Ordem recomendada: **P1.2 → P2 → P2.1 → P3 → P4 → P4.1 → P4.2 → P5 → P5.1 → P6 → P7 → P8**. O modelo pode ser antecipado se Cristian priorizar o benefício de preenchimento, sem habilitar integração incompleta. Importação ampla do histórico da planilha, empacotamento e descoberta automática de atividades permanecem fora da primeira versão utilizável. A P4.1 inclui somente a incorporação controlada dos três dias já confirmados nos testes autorizados.

## P1.2 — chunks A–D

Base da implementação: `4856dae`, branch `master`. Autorização de Cristian em 22/10/2026. O planejamento anterior está no histórico Git.

| Chunk                   | Comportamento entregue                                                                                                                                                                                                                                                                | Verificação                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Até hoje            | A preferência antiga é normalizada ao abrir o modo hoje. Desmarcar mantém como fim fixo a data que estava exibida; períodos fixos históricos escolhidos explicitamente são preservados                                                                                                | Vitest com fim antigo de 06/01/2000, reabertura, mudança de dia e período fixo legítimo; conferência manual da alternância                                                                                       |
| B — Consulta automática | Consultar após uma pausa de 300 ms em datas completas e válidas. Exibir período removido. Intervalo incompleto/invertido mantém a vista válida anterior; requisições anteriores são canceladas e respostas obsoletas ignoradas. Tentar novamente permanece junto a falhas de consulta | Vitest das transições/validação e preservação do editor; conferência manual de intervalo inválido, nova consulta sem botão, dia alterado fora da vista e recuperação após recarga                                |
| C — Destaques e modos   | Envio e total diário com maior destaque; total parcial diferenciado. Modo local identifica o banco deste computador; área expansível explica a futura separação dos dados. Abrir demonstração está desabilitado e marcado Em breve                                                    | Conferência visual de envio indisponível, totais e duração inválida; identificação de modo local e texto da futura demo                                                                                          |
| D — Revisão integrada   | Manter o mesmo banco e os dados existentes, revisar o conjunto e a documentação. Nenhum dado da planilha é importado como rascunho de teste                                                                                                                                           | 37 testes Vitest e build aprovados. Dois dias fictícios isolados foram editados, salvos, recuperados e limpos. Aba original com edição pendente preservada; revisão feita em outra aba. Sem gravações no Redmine |

Os testes protegem as alterações dos chunks respectivos; não há obrigação de um commit por chunk. Os testes reais estão em `src/client/period.test.ts`, `src/client/editor.test.ts`, `src/shared/worklogs.test.ts` e nos testes de persistência/API em `src/server/`. A conferência de colar o código no navegador habitual continua recomendada: a ferramenta de navegação usa um clipboard virtual separado.

## Planilha histórica e limites da revisão

**Decisão/informação de Cristian, 22/10/2026:** a planilha contém dados reais e os apontamentos existentes já foram apropriados no Redmine. Usá-la como referência histórica privada de preenchimento e comportamento; não como lista pendente, semente do banco, fixture pública ou alvo de reenvio.

Leitura estática atual, sem executar macros nem salvar o workbook, encontrou coerência entre campos preenchidos e a marca local de apropriação. Não foram exportados códigos de tarefa, datas ou descrições reais. Essa observação e a informação de Cristian não equivalem a uma consulta de confirmação no servidor nesta entrega.

Preservar a validação coletiva observada no VBA: tarefa, data, observação e atividade são exigidas para envio. Rascunhos podem ser incompletos. Na P3, os campos de ambos os caminhos foram conferidos. A aplicação mantém zero e durações inteiras nos rascunhos e delega limites de envio dependentes da configuração à API; o transporte individual foi validado no teste autorizado. Referências: `docs/legacy-workflow.md` e as funções reais do workbook. Não preservar um defeito conhecido apenas por paridade nem mudar regras de negócio silenciosamente.

## Separação local / demo

| Aspecto       | Modo local entregue                                       | Demo pública planejada para P7/P8                                                        |
| ------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Dados         | Banco SQLite deste computador, ignorado pelo Git          | Somente exemplos fictícios incluídos deliberadamente na demo                             |
| Persistência  | API Node local e transação SQLite; gravação explícita     | Armazenamento do navegador do visitante, com chave própria e sem acesso ao backend local |
| Envio         | Ainda indisponível; integração futura passa pelo backend  | Simulado e identificado; nunca chama o Redmine real                                      |
| Identificação | Banco local / Modo local, com explicação do armazenamento | Faixa permanente Modo demonstração, com aviso de dados fictícios                         |
| Atalho        | Abrir demonstração desabilitado e marcado Em breve        | Link real após publicação; preservar edições pendentes antes de sair da aplicação local  |
| Restauração   | Não há limpeza automática do banco                        | Restaurar demonstração repõe apenas exemplos do próprio navegador                        |

Reutilizar interface e regras em ambos os modos; separar o destino de consulta/salvamento na fronteira de persistência quando P7 for implementado. Não duplicar a aplicação inteira nem publicar uma cópia do banco real. A demo precisa ser verificável sem credenciais e não deve conter nem solicitar endereços privados.

Hospedagem estática, como GitHub Pages, é uma candidata para a demo, não uma decisão de publicação já executada. Escolher a hospedagem na etapa de entrega e conferir configuração de build/caminhos. Hospedar a aplicação completa com banco compartilhado e usuários é outro escopo, não um requisito para este mini projeto.

## Questões que permanecem abertas

1. Autenticação por chave e consulta real de tarefa foram validadas. O envio individual também foi confirmado na P3; expiração e permissões futuras continuam específicas do ambiente; o login do navegador não autentica automaticamente o backend.
2. Certificado vencido: Cristian autorizou exceção local para a origem HTTPS conhecida; manter padrão estrito, aviso visível e nenhuma alteração global. A API respondeu 401 sem credenciais e autenticou com a chave local. O processo precisa ser reiniciado após mudar o `.env`.
3. Catálogo manual por projeto entregue: a mesma descrição pode ter IDs diferentes. Descoberta automática de atividades e novos tipos de campo ficam pendentes; os campos continuam exigindo implementação própria.
4. Contrato de sucesso de cada transporte: HTTP 200 não é confirmação universal de criação. Preservar resultados confirmados/incertos e evitar reenvio indevido.
5. Conta/visibilidade do GitHub, licença e proveniência antes da publicação.

Manter documentação curta e atualizada por entrega. Fontes técnicas prioritárias: código atual, testes reproduzíveis, VBA consultado estaticamente e decisões atuais de Cristian. Exemplos antigos em `docs/behavior-specification.md` são referências históricas, não uma obrigação de BDD.

## Autorização específica para a etapa de envio

Cristian autorizou em 22/10/2026 um único teste real futuro de apropriação individual, mantendo o status do card. Os dados e o estado estão somente em `private/authorized-time-entry-test.json`, ignorado pelo Git. Executado na P3 e confirmado com leitura posterior e status mantido. Nenhuma linha de teste foi adicionada ao banco de uso; não tratar a planilha histórica como fila. Antes de usar, validar contrato em simulação, conferir existência de registro equivalente e não repetir uma criação confirmada ou incerta. A autorização foi consumida. Não repetir esse lançamento nem ampliar o alvo para outros testes reais.

Na P4, Cristian autorizou separadamente dois testes reais em ordem definida; os alvos e o andamento ficam somente em `private/authorized-batch-tests.json`, com SQLite de teste separado. A autorização individual anterior permanece consumida. A execução coletiva para na primeira falha e não retoma automaticamente após reiniciar. Ver [batch-submission.md](batch-submission.md).

P4 conferida com 158 testes em 11 arquivos, build e interface aprovados. Os dois lotes reais autorizados foram concluídos; nove registros conferidos e status mantidos. A autorização foi consumida e não permite repetição.

Em 22/10/2026, Cristian priorizou P4.1 antes do modelo do dia. A trava contra reenvio já existe; falta tornar a apropriação/data evidente e trazer o histórico confirmado para o banco de uso preservando rascunhos locais. Implementado em 23/10/2026: nove registros incorporados com recibos/IDs/datas, dois rascunhos preservados e backup criado. Verificação: 175 testes e build aprovados; consultas remotas sem gravações. Nenhum novo lançamento remoto faz parte dessa incorporação.

P4.2 priorizada e entregue antes de P5 em 23/10/2026: descrição ao sair do código, cache temporário de leitura e validação integral no backend antes do primeiro envio do lote. Erro em uma tarefa bloqueia todas as datas selecionadas e identifica a linha; falhas surgidas depois das primeiras criações ainda preservam resultados parciais. 190 testes/13 arquivos e build aprovados; interface simulada, sem editar os dias 19–21/10 nem criar horas reais. Ver [batch-submission.md](batch-submission.md).

P5 entregue em 23/10/2026: modelo local configurável, cópia independente por ação explícita em dias novos, salvamento separado e proteção de dias existentes. Adicionar linha continua avulso; abrir períodos não cria rascunhos. 203 testes/14 arquivos, build e interface fictícia aprovados. [Uso](day-template.md). P5.1 vem a seguir: movimentação opcional por card depois das horas confirmadas, com revisão e resultado separados; falha de status nunca libera reenvio das horas. Chunks e limites no roadmap.
