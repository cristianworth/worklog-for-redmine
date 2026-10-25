# Plano de desenvolvimento

Atualizado em 25/10/2026. O checklist está no [roadmap](../ROADMAP.md), o histórico de versões no [changelog](../CHANGELOG.md) e as evidências/limites nas [decisões e aprendizados](project-decisions.md).

## Objetivo e fluxo real

Construir uma aplicação pessoal pequena, inicialmente local e demonstrável em portfólio, preservando o fluxo útil do Excel/VBA.

Cristian costuma recompor vários dias em uma sessão e enviá-los depois, frequentemente às quartas. O período é livre, com dias por scroll, cópia rápida do código, total por dia e opção de recolher tarefas. Salvar rascunhos e enviar horas são intenções distintas. Não impor uma semana de segunda a sexta.

## Decisões vigentes

- Node.js, React, Vite, TypeScript, Express e SQLite. Um repositório, estrutura simples e dependências apenas para uma necessidade real.
- Vitest para regras, persistência e fronteiras relevantes; interface conferida manualmente. BDD/Cucumber dispensados; automação adicional de interface só quando trouxer benefício.
- Banco aberto pelo Node e preservado entre execuções. Salvamento local explícito; envio exige revisão/confirmar. Cache de preenchimento não substitui a validação atual antes do envio.
- **Catálogo único por instância configurada do Redmine.** O cadastro de uso tem 15 atividades sem cópias por projeto, disponível em dias/modelo antes de informar o card. Instalações novas começam com catálogo vazio; 15 não é um limite fixo da aplicação.
- A consulta do card continua fornecendo descrição/status/projeto. A validação integral do lote permanece; se a API fornecer atividades disponíveis por projeto, elas também são conferidas. Uma lista remota ausente não prova permissão nem proibição.
- Recibos guardam códigos/datas originais e protegem contra duplicação. Resultado incerto exige conferência por leitura; nenhuma repetição automática após falha ou exclusão remota.
- Modelo é salvo separadamente e só é copiado uma vez para um dia não iniciado. Alterar modelo ou catálogo não reescreve dias/recibos anteriores. Movimentação de status foi cancelada.
- Código já público em `cristianworth/worklog-for-redmine`, licença MIT. Permanecer na `master`, manter commits coesos e seguir as regras de versão do changelog. Planilha, VBA, configuração, bancos, backups e resultados reais ficam fora do Git.

## Marco atual — v0.5.0 / P7 implementado e verificado

Demo isolada completa: exemplos persistidos, envio e recibos fictícios individuais/lotes, recuperação sem repetição, percurso inicial, teclado/tela menor e CI de testes/builds/auditoria. 342 testes/25 arquivos, builds local/demo e instalação limpa sem configuração privada aprovados. Versão, commit e push autorizados por Cristian; hospedagem permanece P8. [Contratos e limites](data-access.md).

### Base preservada — P6.4

A duplicação de atividades por projeto foi removida. Os 60 vínculos foram consolidados em 15 atividades com backup, revisão incrementada e recusa de conflitos; quatro códigos foram corrigidos com autorização após comparação com a API. Todos os demais dados do banco de uso foram preservados.

247 testes/17 arquivos, compilação e interface fictícia foram aprovados. Dois lançamentos autorizados usaram o mesmo código em dois projetos, com readback e status mantidos. Cristian confirmou visualmente que ambos ficaram com o tipo de atividade esperado. O teste não comparou código antigo/atual nem validou todas as atividades em todos os projetos. Os alvos estão apenas no registro privado; a autorização foi consumida e não se repete.

## Ordem do trabalho restante

1. **P8 — Site:** configurar o subdiretório do build demo para GitHub Pages, publicar e conferir o uso por uma pessoa nova. O repositório público e a licença já estão resolvidos. P7-A–E concluídos; a publicação não faz parte dessa implementação.

Critérios e chunks detalhados estão no roadmap e a fronteira implementada em [acesso aos dados](data-access.md). Não ampliar o catálogo por projeto nem transformar a demo em um backend público compartilhado. Cristian orientou foco em recrutadores/portfólio e informou que `github.io` é suficiente; GitHub Pages é a recomendação para P8. Nenhuma hospedagem foi configurada ou publicada.
