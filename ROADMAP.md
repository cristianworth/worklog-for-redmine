# Roadmap — Worklog for Redmine

Atualizado em 23/10/2026. Este arquivo descreve o que falta fazer; o [CHANGELOG.md](CHANGELOG.md) registra o que cada versão já entregou. Versão atual: **v0.1.0 — modelo do dia**.

## Versões e prioridade

| Versão | Escopo | Situação |
| --- | --- | --- |
| v0.0.0 | Base anterior ao modelo: rascunhos, períodos, catálogo por projeto, consultas, envios e proteção contra duplicação | Marco histórico concluído, P0–P4.2 |
| v0.1.0 | Modelo configurável, cópia independente para dias novos e salvamento separado | Entregue, P5 |
| v0.2.0 | Escolha de atividades por opções e duração abreviada; revisão integrada do preenchimento | Próxima versão proposta, P6.1–P6.3 |
| A definir | Demo isolada e publicação do código/demo | Depois do fluxo local validado, P7–P8 |

**Ordem de trabalho:** P6.1 (atividade) → P6.2 (duração) → P6.3 (revisão integrada) → P7 (preparar demo) → P8 (publicar). As duas melhorias de preenchimento têm prioridade sobre demo e publicação. Não foram implementadas nesta atualização de planejamento.

## Entregas já concluídas

| Etapa | O que existe |
| --- | --- |
| P0 | Leitura da referência privada e aprovação do contexto/plano |
| P1 | Um dia de rascunhos: editar, totalizar, salvar e reabrir no SQLite |
| P1.1 | Período livre, dias empilhados por scroll, cópia do código e salvamento de vários dias |
| P1.2 | Até hoje, filtro automático, destaques de envio/total e identificação do armazenamento local |
| P2 | Acesso privado à API e consulta de descrição, status e projeto da tarefa |
| P2.1 | Catálogo manual por projeto: nome e código de atividade, configuração local e sugestões na digitação |
| P3 | Envio individual com revisão, confirmação, recibo e recuperação sem reenvio automático |
| P4 | Enviar dia ou várias datas selecionadas, revisão por data e resultados parciais persistidos |
| P4.1 | Verde/check, datas e conferência das apropriações; incorporação de histórico confirmado sem criar novas horas |
| P4.2 | Consulta da tarefa no blur, cache de leitura e validação de todas as linhas selecionadas antes do primeiro envio |
| P5 | Modelo local: configurar recorrências e copiar uma vez para um dia novo, preservando dias já iniciados |

O P5 teve quatro chunks concluídos: conferir o VBA; configurar/persistir o modelo; aplicar em dia novo; verificar persistência, teclado e ausência de duplicação. Entregue com 203 testes/14 arquivos e compilação aprovada. [Uso do modelo](docs/day-template.md).

## P6.1 — Escolher atividade por opções — prioridade máxima

**Problema:** a P2.1 entregou o catálogo e a conversão nome + projeto → código, mas o campo ainda é um texto livre com `datalist`. Isso ajuda a sugerir, mas não restringe a escolha como a lista da planilha.

**O que faremos:** substituir a digitação livre por uma seleção das atividades do projeto da tarefa, mostrando nome e código. Primeiro identificar o projeto pela consulta da tarefa; depois disponibilizar suas atividades cadastradas. O modelo do dia deve seguir a mesma regra quando tiver uma tarefa definida; campos ainda não definidos podem continuar incompletos para completar no dia.

| Chunk | Entrega | Como conferir |
| --- | --- | --- |
| A — Opções por projeto | Seleção fechada baseada no catálogo existente, com nome e ID; orientar consultar a tarefa/cadastrar atividades quando necessário | Mesmo nome em dois projetos oferece o código correspondente a cada projeto |
| B — Rascunhos e modelo | Integrar a seleção ao dia e ao modelo, preservar textos históricos sem vínculo e pedir correção sem apagar valores | Trocar tarefa/projeto não conserva um código incompatível nem reescreve horas apropriadas |
| C — Envio e conferência | Manter resolução e validação de código no backend, explicar opções ausentes e conferir o fluxo completo com serviço simulado | Nenhum envio sem vínculo válido; seleção correta leva o ID esperado no payload |

**Critério de conclusão:** o usuário escolhe uma opção válida, entende a falta de configuração e consegue revisar o código antes de enviar. O rascunho continua podendo ficar incompleto; o envio continua bloqueado sem vínculo válido. A origem inicial das opções é o catálogo manual por projeto já implementado, não uma enumeração fixa/global.

**Limite conhecido:** a instância consultada nem sempre fornece a lista de atividades por projeto. Descoberta automática não será presumida: não inventar IDs, reutilizar códigos de outro projeto ou escolher a primeira atividade automaticamente. Cadastro do catálogo permanece explícito; descoberta automática é uma melhoria separada se houver uma fonte confiável.

## P6.2 — Digitar duração abreviada — prioridade alta

**Problema:** hoje a aplicação aceita apenas `HH:MM`. Queremos digitar menos e manter minutos inteiros como unidade de armazenamento e envio.

| Entrada | Resultado ao sair do campo |
| --- | --- |
| `30` ou `030` | `00:30` |
| `130` ou `0130` | `01:30` |
| `800` | `08:00` |
| `01:30` | `01:30`, formato atual preservado |
| Vazio | Continua incompleto, sem inventar duração |
| `160` ou `1:60` | Erro claro; não converter silenciosamente minutos inválidos |

Na forma compacta, os dois últimos dígitos representam minutos e os anteriores representam horas; um ou dois dígitos representam minutos. Não incluir segundos nessa entrada, nos totais ou no envio. Essa regra foi solicitada por Cristian; a implementação atual ainda não a oferece.

| Chunk | Entrega | Como conferir |
| --- | --- | --- |
| A — Regra única | Conversor de entrada abreviada para minutos, preservando `HH:MM`, vazio e erros | Vitest dos exemplos, limites de minutos e valores inválidos |
| B — Dia e modelo | Normalizar ao sair do campo; total e salvamento usam a mesma interpretação mesmo antes do blur | Preencher por teclado, salvar e reabrir mantendo o mesmo total |
| C — Compatibilidade | Preservar valores salvos e recibos existentes; nenhuma mudança no payload de minutos/horas | Dados anteriores permanecem iguais e os dias protegidos não são usados como massa de teste |

## P6.3 — Revisão integrada da v0.2.0

Esta etapa fecha a versão de preenchimento; não é uma refatoração ampla.

- Conferir por teclado: código → consulta → atividade → duração abreviada → observação → salvar → revisar envio.
- Conferir modelo, cópia de tarefa entre dias, troca de período com edições pendentes, catálogo vazio e tarefa inválida.
- Verificar mensagens de erro, estados de carregamento, conflitos entre abas, foco e uso em telas menores; corrigir problemas observados.
- Atualizar instruções e changelog somente com o que foi entregue. Fechar versão/manifest/rodapé e tag juntos.
- Usar Vitest para regras, persistência e payload, com interface e Redmine simulados. Testes reais exigem alvos especificamente autorizados; não repetir autorizações consumidas.

**Critério de conclusão:** preencher e revisar vários dias sem digitação livre de atividade, sem inserir dois-pontos a cada duração e sem perder edições ou duplicar apropriações.

## P7 — Preparar uma demonstração segura para visitantes

**Objetivo:** permitir experimentar a interface sem instalar Node, configurar chave ou acessar dados de trabalho. Esta etapa prepara a demo; hospedagem e endereço público ficam no P8.

| Chunk | Entrega | Como conferir |
| --- | --- | --- |
| A — Isolamento | Armazenamento próprio do visitante no navegador e serviço simulado, reaproveitando a interface | A demo não chama a API local/Redmine e não lê o SQLite real |
| B — Experiência | Exemplos fictícios de vários dias, tarefas/atividades fictícias e envio explicitamente simulado | Visitante consegue editar, salvar, revisar e ver resultados sem credenciais |
| C — Identificação e restauração | Aviso permanente de demo, atalho funcional e Restaurar exemplos limitado àquele visitante | Recarregar preserva a brincadeira; restaurar afeta só os dados da demo |

**Critério de conclusão:** build da demo funciona como site estático e é inspecionado sem chave, host privado, banco ou dados reais. O modo local continua usando Node + SQLite. Não criar um acesso público ao backend privado para viabilizar a demo.

## P8 — Publicar código e demonstração

**Objetivo:** entregar um projeto apresentável, com código acessível e link para experimentar a demo. Publicar o repositório não hospeda a aplicação automaticamente.

| Chunk | Entrega | Como conferir |
| --- | --- | --- |
| A — Destino e licença | Confirmar conta GitHub, visibilidade, licença, endereço e serviço de hospedagem | Destinos e direitos de distribuição definidos, sem supor conta/domínio |
| B — Revisão de publicação | Revisar arquivos, histórico Git e build para dados privados; conferir instruções, licença e versão | Clone limpo roda com configuração de exemplo; nenhum material da planilha/empresa é distribuído |
| C — Código e site | Criar/configurar o repositório autorizado e publicar a demo isolada no destino aprovado | README oferece instruções locais, changelog e link público funcional |
| D — Conferência externa | Abrir o site publicado e executar o fluxo fictício completo, inclusive restauração | Funciona para um visitante novo e continua sem acesso aos dados/serviços reais |

**Critério de conclusão:** outra pessoa consegue entender o projeto, executar o modo local ou experimentar a demo pelo navegador. Hospedagem do backend real, contas compartilhadas e sincronização de bancos entre usuários não fazem parte desta etapa.

## Cortes e limites vigentes

- **P5.1 — Movimentar status do card: cancelado por Cristian em 23/10/2026.** Não implementar nem substituir por uma etapa equivalente. A aplicação registra horas e mantém o status do card; sua consulta continua disponível como informação.
- Sem total semanal, cópia automática de linhas entre dias, importação ampla do histórico da planilha, agendamento do modelo ou construtor genérico de campos.
- Preservar os dias 19, 20 e 21/10 no banco de uso. Usar outros dias e serviços fictícios para testes. Não reenviar lançamentos já confirmados.
- A exceção de certificado continua opt-in e restrita à origem privada configurada, com aviso visível; nenhuma alteração global de TLS.
