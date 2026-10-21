# Plano de desenvolvimento

## Objetivo e limite da primeira versão

Criar o **Worklog for Redmine**: aplicação web pessoal e local que organiza horas trabalhadas em tarefas e registra esses apontamentos no Redmine. A primeira versão parte do fluxo existente em Excel/VBA e o traduz para a web.

O objetivo é um programa pequeno, utilizável e demonstrável em portfólio. Preservar o preenchimento por dia, a revisão e a apropriação individual/coletiva. Melhorar a interface é permitido, mantendo a velocidade de preenchimento e a clareza dos resultados.

## Decisões e recomendações

| Tema | Situação |
| --- | --- |
| Nome: Worklog for Redmine; repo: worklog-for-redmine | Escolha explícita de Cristian |
| Uso pessoal/local; eventual apresentação e intenção open source | Direção explícita de Cristian |
| Portar o fluxo e a lógica existentes, depois evoluir | Escolha explícita de Cristian |
| Backend Node.js | Escolha explícita de Cristian |
| Frontend React | Uso explicitamente autorizado |
| Vite, TypeScript, Express, SQLite e shadcn/ui | Vite, TypeScript, Express e SQLite aprovados em 21/10; shadcn/ui adiado |
| Vitest e poucos fluxos Playwright | Vitest aprovado; interface manual no primeiro recorte, Playwright opcional depois |
| BDD leve por exemplos | Dispensado por Cristian em 21/10/2026; cenários formais não obrigatórios |
| Criação do GitHub pelo sucessor; commits e pushes rotineiros autônomos | Autorização explícita de Cristian |
| Planilha original fora do Git | Restrição explícita de Cristian |
| Licença e conta de destino no GitHub | Ainda não definidas |

## Organização técnica aprovada para o primeiro recorte

Um repositório com frontend React, backend Node e armazenamento SQLite local. O Node concentra a autenticação e a comunicação com o Redmine e pode servir os arquivos do frontend na execução normal. Os detalhes de pastas e dependências serão decididos no primeiro recorte, sem criar uma arquitetura maior que a aplicação.

Separar responsabilidades reais: regras de apontamento, persistência local, comunicação com o Redmine e interface. Isso permite testar cada limite e trocar futuramente o transporte HTTP sem refazer a tela.

Preservar o mecanismo de integração do VBA como ponto de partida. Avaliar a API como alternativa quando simplificar o trabalho; não transformar a migração para API em pré-requisito arbitrário. Não copiar tratamento incorreto de sucesso HTTP ou desativação global de TLS.

## Etapas e critérios de conclusão

| Etapa | Entrega | Critério de conclusão |
| --- | --- | --- |
| P0 — Contexto e exemplos | Conferir as fontes, mapear as regras e validar o primeiro recorte | Aprovado diretamente por Cristian em 21/10/2026, com simplificação dos testes |
| P1 — Primeiro fluxo local | Preparar lançamentos de um dia, totalizar e salvar rascunhos com dados fictícios | Reabrir mantém os dados; soma e persistência conferidas com Vitest; interface conferida manualmente e primeiro diff revisado antes de ampliar |
| P2 — Acesso e consulta | Portar autenticação e consulta de descrição/status para Node | Contrato reproduzido em simulação; consulta real somente de leitura quando houver acesso; nenhuma credencial exposta |
| P3 — Apropriação individual | Preparar e enviar um apontamento, distinguindo resultado confirmado e incerto | Contrato de envio, confirmação, duplo envio e resposta incerta verificados em simulação; conferência real depende de alvo e autorização específicos |
| P4 — Apropriação coletiva | Selecionar lançamentos/dias e acompanhar resultados por item | Falha parcial e proteção contra reenvio indevido verificadas em simulação |
| P5 — Paridade restante | Incorporar movimentação opcional de status e demais funções úteis confirmadas no legado | Regras caracterizadas e exemplos revisados; sucesso das horas não depende do sucesso posterior do status |
| P6 — Uso e apresentação | Ajustar teclado, mensagens, documentação de execução e demonstração fictícia | Fluxo principal praticável, verificações registradas, exemplos públicos sem dados reais |

Primeiro recorte sugerido: **P1 com um único dia de lançamentos, soma de durações e persistência local**. Aprovado por Cristian em 21/10/2026. O resultado será revisado antes de ampliar o escopo.

## Melhorias pequenas admitidas

- Cadastro editável de atividades, com associação por projeto quando necessária.
- Persistência automática de rascunhos, total diário visível e navegação por teclado.
- Resultado por linha, bloqueio de duplo envio e distinção de resultado incerto.
- Mensagens específicas para sessão expirada, ausência de conexão e dados inválidos.
- Um comando documentado para iniciar o programa e uma demonstração com dados fictícios quando o fluxo existir.

Carregamento automático de atividades, importação histórica da planilha e empacotamento como aplicativo ficam para depois da primeira versão utilizável. Não é necessário adicionar múltiplos usuários, permissões de equipe, serviços distribuídos ou hospedagem pública para cumprir o objetivo atual.

## Pontos a resolver com evidência

1. Caracterizar o login real: token de formulário, cookies, expiração e codificação de campos. Uma sessão de navegador não é automaticamente uma sessão do backend.
2. Confirmar disponibilidade/permissões da API; uma falha de autenticação em XML não prova API desabilitada.
3. Definir tratamento do certificado do servidor com base no ambiente atual, sem ignorar TLS globalmente.
4. Confirmar o vínculo projeto/atividade; o mesmo nome pode ter IDs diferentes.
5. Definir o que ocorre quando horas são gravadas, mas a atualização opcional de status falha.
6. Confirmar os limites de duração, regras de dias duplicados e campos exigidos antes de reproduzir validações do VBA.
7. Escolher licença e revisar a proveniência do código antes de publicar material derivado do legado.

## Documentação mínima por entrega

Atualizar README e instruções de execução quando houver algo executável. Manter a documentação consistente com os testes realmente executados; não há obrigação de cenários formais. Registrar decisões importantes com motivo e trade-off, em vez de gerar documentos para cada detalhe rotineiro.

O primeiro recorte usa versão interna 0.1.0, sem release pública e sem changelog. Se um changelog for introduzido depois, aplicar as regras de aprovação de versão de Cristian antes dos commits subsequentes.

## Fontes de apoio

- [BDD: descoberta, formulação e automação](https://cucumber.io/docs/bdd/).
- [Referência Gherkin](https://cucumber.io/docs/gherkin/reference/).
- [React com ferramentas de build, incluindo Vite](https://react.dev/learn/build-a-react-app-from-scratch).
- [Express](https://expressjs.com/).
- [Usos de SQLite](https://www.sqlite.org/whentouse.html).
- [Autenticação da API Redmine](https://www.redmine.org/projects/redmine/wiki/Rest_api#Authentication).
- [Apontamentos na API Redmine](https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries).

## Ajuste aprovado e regras conferidas — 21/10/2026

Cristian aprovou o primeiro recorte e a base técnica, dispensando BDD, Cucumber e cenários formais. Usar Vitest para soma e persistência; interface manual por enquanto. Consultar o VBA e perguntar apenas diante de ambiguidade relevante.

Leitura estática atual de `ObtenhaColecaoDeApropriacoesPlanAtiva`, `SomarAPartirAte`, `ValideApropriacaoColetiva` e dos handlers de apropriação: o legado agrupa linhas por data e a validação coletiva exige tarefa, data, observação e atividade. Essa validação pertence ao envio; o recorte local permite rascunhos incompletos. Duração vazia fica sem minutos; duração malformada deve ser corrigida antes de salvar. A entrada web usa HH:MM explícito, em vez da representação numérica do Excel. Totais não param na primeira linha vazia. Não foram definidos limites de negócio novos nem portadas regras de envio.

P1 está implementado para revisão. Consulta, envio e status permanecem nas próximas etapas. Autossalvamento, cadastro de atividades e navegação mensal não fazem parte deste primeiro recorte.

Verificação do primeiro recorte: Vitest cobre soma, persistência e o transporte JSON local; TypeScript e build de produção aprovados. Conferência manual no navegador: exemplo de 02:15, edição/remoção, duração inválida, rascunho incompleto, recarga e troca de datas. Sem execução de macros e sem acesso ao Redmine. Revisão de Cristian do primeiro recorte ainda pendente.
