# Roadmap — Worklog for Redmine

Atualizado em 23/10/2026. Este arquivo descreve o que falta fazer; o [CHANGELOG.md](CHANGELOG.md) registra o que cada versão já entregou. Versão atual: **v0.3.0 — dias recolhíveis e código público sob MIT**.

## Versões e prioridade

| Versão | Escopo | Situação |
| --- | --- | --- |
| v0.0.0 | Base anterior ao modelo: rascunhos, períodos, catálogo por projeto, consultas, envios e proteção contra duplicação | Marco histórico concluído, P0–P4.2 |
| v0.1.0 | Modelo configurável, cópia independente para dias novos e salvamento separado | Entregue, P5 |
| v0.2.0 | Escolha de atividades por opções e duração abreviada; revisão integrada do preenchimento | Entregue, P6.1–P6.3 |
| v0.3.0 | Recolher/expandir dias, catálogo privado preenchido e publicação do código com licença MIT | Entregue; código público sob MIT |
| A definir | Demo isolada e publicação da demonstração | Depois do fluxo local validado, P7–P8 |

**Ajuste entregue após P6:** recolher/expandir tarefas por dia; **Adicionar linha** reabre e foca a linha nova. Edições preservadas e preferência visual mantida durante a página, inclusive ao trocar o período. Registrado na v0.3.0, aprovada por Cristian. O catálogo privado de uso foi preenchido com a lista fornecida, sem criar dados padrão para novas instalações ou alterar recibos.

**Próxima etapa:** P7 (preparar demo) → P8 (publicar a demo). O código foi publicado antecipadamente por pedido de 23/10/2026. P6.1–P6.3 foram concluídas na v0.2.0. Destino verificado: `cristianworth/worklog-for-redmine`, público, licença MIT. A autorização atual antecipa o código; não inclui hospedar o backend privado ou implementar a demo agora.

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

## P6.1 — Escolher atividade por opções — concluído

A P2.1 já resolvia nome + projeto → código, mas a interface aceitava texto livre. Na v0.2.0, dias e modelo usam uma seleção fechada com nome e ID das atividades cadastradas para o projeto da tarefa.

| Chunk | Resultado |
| --- | --- |
| A — Opções por projeto | Consulta identifica o projeto; a lista oferece somente suas atividades, sem seleção inicial automática |
| B — Rascunhos e modelo | Integração nos dois editores; valores antigos sem cadastro preservados e identificados; recibos apropriados continuam bloqueados com seu código original |
| C — Envio e conferência | Backend mantém resolução/validação por projeto; testes conferem código correto em dois projetos e zero envio de atividade sem vínculo |

**Uso:** saia do código da tarefa ou use Consultar; depois escolha nome/código na lista. Se o projeto não tiver atividades cadastradas, o campo explica como usar Configurações. O rascunho pode continuar incompleto; o envio permanece bloqueado sem vínculo válido.

**Limite:** o catálogo continua manual por projeto. A instância nem sempre fornece a lista remota; descoberta automática não foi incluída, e nenhum ID é inventado, buscado em outro projeto ou escolhido como padrão.

## P6.2 — Digitar duração abreviada — concluído

| Entrada | Resultado ao sair do campo |
| --- | --- |
| `30` ou `030` | `00:30` |
| `130` ou `0130` | `01:30` |
| `800` | `08:00` |
| `01:30` | Formato atual preservado |
| Vazio | Continua incompleto |
| `90`, `160` ou `1:60` | Erro de minutos inválidos, sem correção silenciosa |

Os dois últimos dígitos são minutos; os anteriores são horas. Um ou dois dígitos representam minutos. O conversor é o mesmo no total, salvamento e blur dos dias/modelo; salvar antes do blur produz o mesmo resultado. Segundos não entram nessa digitação; não são arredondados nem enviados. Minutos persistidos, recibos e parser do transporte `HH:MM` foram preservados, sem migração.

## P6.3 — Revisão integrada da v0.2.0 — concluído

- 242 testes/17 arquivos e compilação aprovados. Cobertura nova de atalhos, minutos inválidos, seleção restrita por projeto, histórico preservado, payload e reabertura do banco.
- Interface conferida em instância isolada com SQLite em memória: código por Tab, opções por projeto, edição de duração, mensagem de erro, correção de atividade antiga, salvar/reabrir modelo e lote simulado de dois dias.
- Estilos/foco de teclado dos seletores integrados aos campos existentes; rolagem horizontal e tamanho de fonte em telas menores preservados. A conferência visual ocorreu no navegador integrado; teste adicional em telefone real fica para a revisão da demo/publicação.
- Changelog, manifests, rodapé e tag da v0.2.0 fechados juntos. Dias 19, 20 e 21/10 de uso e seus recibos intactos. Nenhuma criação remota real nessa entrega.

## P7 — Preparar uma demonstração segura para visitantes

**Objetivo:** permitir experimentar a interface sem instalar Node, configurar chave ou acessar dados de trabalho. Esta etapa prepara a demo; hospedagem e endereço público ficam no P8.

| Chunk | Entrega | Como conferir |
| --- | --- | --- |
| A — Isolamento | Armazenamento próprio do visitante no navegador e serviço simulado, reaproveitando a interface | A demo não chama a API local/Redmine e não lê o SQLite real |
| B — Experiência | Exemplos fictícios de vários dias, tarefas/atividades fictícias e envio explicitamente simulado | Visitante consegue editar, salvar, revisar e ver resultados sem credenciais |
| C — Identificação e restauração | Aviso permanente de demo, atalho funcional e Restaurar exemplos limitado àquele visitante | Recarregar preserva a brincadeira; restaurar afeta só os dados da demo |

**Critério de conclusão:** build da demo funciona como site estático e é inspecionado sem chave, host privado, banco ou dados reais. O modo local continua usando Node + SQLite. Não criar um acesso público ao backend privado para viabilizar a demo.

## P8 — Publicar código e demonstração

**Atualização de 23/10/2026:** Cristian pediu antecipar a publicação pública do repositório com licença open source. Conta autenticada conferida: `cristianworth`; licença escolhida: MIT. Revisão aprovada dos arquivos atuais e de 227 blobs do histórico Git; código em [cristianworth/worklog-for-redmine](https://github.com/cristianworth/worklog-for-redmine). Handoffs, planilha, VBA, configuração e dados privados ficam fora da distribuição. Publicação da demo continua dependendo do P7; URL/hospedagem da demo ainda serão definidas.

**Objetivo:** entregar um projeto apresentável, com código acessível e link para experimentar a demo. Publicar o repositório não hospeda a aplicação automaticamente.

| Chunk | Entrega | Como conferir |
| --- | --- | --- |
| A — Destino e licença | Código: conta `cristianworth`, repositório público e MIT definidos. Demo: escolher hospedagem/endereço após P7 | Repositório e LICENSE disponíveis; destino da demo continua pendente |
| B — Revisão de publicação | Código: arquivos, histórico e build revisados; handoffs ignorados. Repetir a revisão no build da futura demo | Clone usa catálogo/banco novos e configuração de exemplo; dados de uso ficam locais |
| C — Código e site | Repositório público com versões publicado. Site da demo continua pendente do P7 | README oferece clone, changelog e licença; link para brincar só após publicar a demo |
| D — Conferência externa | Abrir o site publicado e executar o fluxo fictício completo, inclusive restauração | Funciona para um visitante novo e continua sem acesso aos dados/serviços reais |

**Critério de conclusão:** outra pessoa consegue entender o projeto, executar o modo local ou experimentar a demo pelo navegador. Hospedagem do backend real, contas compartilhadas e sincronização de bancos entre usuários não fazem parte desta etapa.

## Cortes e limites vigentes

- **P5.1 — Movimentar status do card: cancelado por Cristian em 23/10/2026.** Não implementar nem substituir por uma etapa equivalente. A aplicação registra horas e mantém o status do card; sua consulta continua disponível como informação.
- Sem total semanal, cópia automática de linhas entre dias, importação ampla do histórico da planilha, agendamento do modelo ou construtor genérico de campos.
- Preservar os dias 19, 20 e 21/10 no banco de uso. Usar outros dias e serviços fictícios para testes. Não reenviar lançamentos já confirmados.
- A exceção de certificado continua opt-in e restrita à origem privada configurada, com aviso visível; nenhuma alteração global de TLS.
