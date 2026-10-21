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
| P1 — Primeiro fluxo local | Preparar lançamentos de um dia, totalizar e salvar rascunhos com dados fictícios | Concluído em `dd8bd4d`; 18 testes e build aprovados. Cristian conferiu o fluxo e confirmou o funcionamento em 21/10/2026 |
| P1.1 — Preenchimento por período | Exibir dias empilhados, copiar código, salvar o período e refinar a apresentação | Intervalo livre com fim fixo ou até hoje; dados existentes preservados; abrir/reabrir mantém rascunhos; salvar não envia ao Redmine |
| P2 — Acesso e consulta | Portar autenticação e consulta de descrição/status para Node | Contrato reproduzido em simulação; consulta real somente de leitura quando houver acesso; nenhuma credencial exposta |
| P2.1 — Atividades configuráveis | Criar o catálogo equivalente à aba de validações da planilha | Incluir/editar tipos de atividade sem mudar o código da tela; resolver IDs no projeto correto antes do envio |
| P3 — Apropriação individual | Preparar e enviar um apontamento, distinguindo resultado confirmado e incerto | Contrato de envio, confirmação, duplo envio e resposta incerta verificados em simulação; conferência real depende de alvo e autorização específicos |
| P4 — Apropriação coletiva | Selecionar lançamentos/dias e acompanhar resultados por item | Falha parcial e proteção contra reenvio indevido verificadas em simulação |
| P5 — Modelos e paridade restante | Preencher novos dias com um modelo e incorporar movimentação opcional de status | Modelo caracterizado no VBA e aplicado sem duplicar linhas; sucesso das horas não depende do sucesso posterior do status |
| P6 — Uso e apresentação | Ajustar teclado, mensagens, documentação de execução e demonstração fictícia | Fluxo principal praticável, verificações registradas, exemplos públicos sem dados reais |

P1 foi concluído e validado por Cristian. O próximo recorte recomendado é P1.1: adaptar o preenchimento ao uso de vários dias em uma mesma sessão, antes de iniciar a integração.

## Melhorias pequenas admitidas

- Cadastro editável de atividades, com associação por projeto quando necessária.
- Salvamento explícito de rascunhos, total por dia e navegação por teclado. Autossalvamento é uma possível melhoria futura, sem autorização para substituir silenciosamente o botão de salvar.
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

P1 foi implementado e aceito por Cristian após sua conferência prática. Consulta, envio, cadastro de atividades e status permanecem nas próximas etapas.

Verificação do primeiro recorte: Vitest cobre soma, persistência e o transporte JSON local; TypeScript e build de produção aprovados. Conferência manual no navegador: exemplo de 02:15, edição/remoção, duração inválida, rascunho incompleto, recarga e troca de datas. Sem execução de macros e sem acesso ao Redmine. Cristian confirmou que os passos solicitados funcionaram; o primeiro marco de implementação está validado.

## Uso real e próximo recorte — alinhamento de 21/10/2026

Cristian costuma reconstruir e salvar vários dias de uma vez e apropriar o período depois, frequentemente às quartas. O intervalo não é uma semana fixa de segunda a sexta. A mesma tarefa pode aparecer em dias seguidos; navegar rolando e copiar somente o código atende melhor que trocar de data a cada edição.

### P1.1 — escopo da próxima implementação

- Mostrar os dias de um intervalo livre, em ordem cronológica e empilhados, com total individual. Não incluir total semanal nem ação de copiar uma linha para outros dias.
- Manter início e fim inclusivos e mostrar as datas explicitamente. Não assumir que quarta a quarta equivale sempre a cinco datas ou omitir fins de semana automaticamente.
- No fim do intervalo, oferecer **Data específica** ou **Até hoje**. No segundo modo, calcular o dia atual no calendário local do usuário; conservar a data inicial. Persistir a escolha do modo, em vez de congelar a data final. Ao reabrir, atualizar o fim; se houver edições ao atravessar a meia-noite ou voltar à tela, preservá-las antes de atualizar os dias exibidos.
- Colocar um ícone de copiar junto ao código da tarefa, com rótulo acessível e retorno de sucesso/erro. Copiar somente o código e manter o uso habitual de colar em outra linha.
- Refinar os ícones e a apresentação, mantendo uma tabela compacta e o preenchimento por teclado.
- **Salvar rascunhos** deve persistir todos os dias alterados, independentemente da seleção para envio. O filtro de período não deve descartar edições pendentes. Preservar os dados existentes e os conflitos entre abas; só anunciar salvamento completo após confirmação dos dias envolvidos. Caso o mecanismo permita sucesso parcial, identificar os dias salvos e manter os demais como pendentes.
- Reservar ações claramente separadas para salvar e enviar. **Enviar ao Redmine…** é o nome recomendado, ainda sujeito a ajuste. Na fase local, deixar a ação indisponível com indicação de funcionalidade futura. Quando existir, abrir revisão do conteúdo salvo e dos dias selecionados antes da confirmação remota.
- Mostrar **Modelo do dia** e **Configurações** como botões desabilitados, identificados como **Em breve**. Não simular telas, salvamento de configurações ou aplicação de modelos que ainda não existem.

Esta atualização registra o roadmap; P1.1 e os botões acima ainda não foram implementados.

### Pendências funcionais posteriores

| Item | Direção e limite |
| --- | --- |
| Modelo do dia | Consultar `ObtenhaModeloDeApropriacao` e a estrutura do modelo privado antes de portar o preenchimento. Permitir configurar entradas recorrentes, como reunião diária, sem incluir dados reais em exemplos públicos. Recomendação: aplicar uma vez ao criar o dia; **Adicionar linha** continua criando uma entrada avulsa. Não reaplicar ao apenas abrir uma data nem sobrescrever dias existentes. Esses detalhes são propostas para a etapa P5. |
| Configurações → Atividades | Equivalente inicial ao catálogo de validações da planilha. Manter nome e mapeamento por projeto/ID no armazenamento local; permitir manutenção sem alterar as sugestões fixas no código. IDs podem variar por projeto. A etapa P2.1 deve existir antes de permitir envio real. |
| Validação dos campos | Regras de formato permanecem em funções compartilhadas e são verificadas também pelo backend. Regras obrigatórias de envio serão separadas das permissões de rascunho. Um novo tipo de atividade é dado de cadastro; um novo campo com comportamento próprio exige mudança de código. Não há proposta de um construtor genérico de formulários nesta etapa. |
| Revisão e envio em lote | Permitir selecionar dias salvos, revisar e enviar. Proteger contra duplo envio, preservar confirmação por linha, falha parcial e resultado incerto; não reenviar automaticamente. Implementar individual primeiro e lote depois, mantendo o uso acumulado como fluxo principal. |
| Publicação | Repositório GitHub segue autorizado; conta, visibilidade, licença e proveniência precisam ser resolvidas antes da primeira publicação. Não faz parte da mudança documental atual. |

Interpretação adotada para “tipos de campos”: o catálogo de tipos de atividade, equivalente à aba de validações do Excel. Se Cristian estiver se referindo a outro cadastro ou a campos novos, ajustar essa parte do plano antes de implementá-la.

Ordem recomendada: **P1.1 → P2 → P2.1 → P3 → P4 → P5 → P6**. P5 inclui o modelo recorrente, que pode ser antecipado após a revisão de P1.1 se o benefício no preenchimento justificar. Não transformar esse cadastro ou modelo em requisito para usar os rascunhos locais.
