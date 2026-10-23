# Roadmap — Worklog for Redmine

Atualizado em 23/10/2026. Acompanhamento das entregas; decisões e limites no [plano](docs/development-plan.md).

## Entregas

- [x] **P0 — Contexto:** referência privada e plano aprovados.
- [x] **P1 — Um dia:** editar, totalizar, salvar e reabrir. Validado por Cristian.
- [x] **P1.1 — Período livre:** dias por scroll, copiar código e salvar vários dias.
- [x] **P1.2 — Usabilidade:** Até hoje, filtro automático, destaques e identificação do banco local.
- [x] **P2 — Acesso e consulta:** configuração privada, exceção de certificado restrita e consulta explícita por linha. Autenticação e leitura real de assunto/status/projeto verificadas com a chave local; nenhuma hora enviada.
- [x] **P2.1 — Atividades:** catálogo manual de nome/ID por projeto, persistência local e sugestões conforme a tarefa consultada. Implementado e conferido com exemplos fictícios; aguarda revisão de uso de Cristian.
- [x] **P3 — Envio individual:** seleção de linha salva, revisão/confirmar, recibos persistidos e recuperação sem reenvio. Teste real autorizado confirmado e conferido; autorização consumida.
- [x] **P4 — Envio do período:** Enviar dia, seleção múltipla, revisão, recibos e interrupção na primeira falha. Simulação/interface conferidas; um lote real de um dia e outro de dois dias confirmados com autorização específica consumida.
- [x] **P4.1 — Apropriações e uso real:** verde/check e data por linha, resumo completo/parcial, conferência e incorporação dos três dias confirmados com seus recibos, preservando rascunhos existentes. Entregue com os nove recibos no banco de uso, sem reenvio; dois rascunhos preservados.
- [ ] **P5 — Modelo do dia:** recorrências aplicadas uma vez, sem sobrescrever dias existentes.
- [ ] **P5.1 — Status opcional:** operação separada das horas; manter confirmações existentes se a movimentação falhar.
- [ ] **P6 — Consolidação local:** teclado, mensagens, testes e instruções proporcionais.
- [ ] **P7 — Demo pública:** dados fictícios, armazenamento do visitante, envio simulado e restauração. Sem acesso ao banco/API/Redmine reais.
- [ ] **P8 — Publicação:** confirmar conta, visibilidade, licença e proveniência; revisar conteúdo e publicar código/demo.

## P2.1 — chunks entregues

| Chunk                       | Entrega e verificação                                                                                                                                                                                                     | Estado    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A — Catálogo local          | Nome, código de atividade e código do projeto no mesmo SQLite; nomes/IDs únicos dentro de cada projeto; gravação com revisão e conflito; abrir banco antigo sem mudar dias existentes                                     | Concluído |
| B — Configurações           | Adicionar/editar/remover e salvar catálogo separadamente; descartar/recarregar explicitamente; fechar o painel preserva edições e a saída da página avisa de mudanças pendentes                                           | Concluído |
| C — Preenchimento e revisão | Consultar tarefa identifica o projeto; sugestões e resolução de ID ficam nesse projeto; trocar código invalida o vínculo anterior. Textos históricos e rascunhos incompletos continuam salvos sem remapeamento automático | Concluído |

Verificação: **110 testes em 9 arquivos passaram**, com build aprovado. Revisão visual em banco temporário e serviço fictício conferiu o mesmo nome com IDs distintos por projeto, atualização após salvar catálogo, edições preservadas ao fechar Configurações e recuperação após recarga. Nenhum dado fictício foi gravado no banco de uso e nenhuma hora foi enviada.

## P3 — chunks entregues

| Chunk                        | Resultado esperado                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A — Contrato e validação     | VBA e API conferidos; identidade, tarefa/projeto, atividade e duplicidade consultados; política da instância sem inventar limites fixos  |
| B — Preparação e revisão     | Seleção de uma linha salva, diálogo de revisão, cancelamento sem POST e confirmação explícita                                            |
| C — Resultado e persistência | Estado iniciado gravado antes da criação, ID remoto e estados separados; linha protegida e recuperação de resultado por leitura          |
| D — Revisão integrada        | Simulação e interface conferidas. Um único teste real autorizado foi criado e verificado, com status mantido; registro privado consumido |

Verificação P3: **142 testes em 10 arquivos passaram** e build aprovado. A perda de resposta após criação foi simulada e recuperada por consulta. Campos/ID do teste real ficam somente em `private/authorized-time-entry-test.json`; nenhuma linha de teste foi adicionada ao banco de uso. [Detalhes do envio](docs/individual-submission.md).

## P4 — chunks entregues

| Chunk                 | Entrega                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Seleção           | Checkboxes por linha/dia, seleção de vários dias e atalho **Enviar dia**; exigir rascunhos salvos                                                                                  |
| B — Revisão           | Datas, campos finais e impedimentos; voltar sem enviar; revisão local antes de criar                                                                                               |
| C — Execução          | Um trabalhador por lote, resultado por linha, parada na primeira falha, histórico e consulta após recarga; sem retomada automática                                                 |
| D — Revisão integrada | 158 testes/11 arquivos e build aprovados; interface com dados fictícios; dois lotes reais especificamente autorizados confirmados, com nove registros conferidos e status mantidos |

[Uso, resultados e limites](docs/batch-submission.md). Os dados dos testes reais ficam apenas na área privada.

## P4.1 — chunks entregues

| Chunk              | Entrega                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| A — Estado e datas | Data original de confirmação, origem e última conferência; compatibilidade com recibos atuais                                |
| B — Sinalização    | Verde/check e Apropriado/data na linha; resumo de dia completo ou parcial; incertos diferenciados                            |
| C — Conferência    | Ler o registro remoto por ID e apontar divergências sem liberar reenvio automático                                           |
| D — Uso real       | Backup e incorporação local dos três dias com recibos/IDs; preservar rascunhos existentes e impedir duplicatas na importação |

175 testes/12 arquivos e build aprovados. Verde/check e datas por linha, conferência por ID e incorporação atômica conferidos. Nove recibos no banco de uso, dois rascunhos preservados e backup criado; somente consultas remotas. [Análise do VBA e proposta](docs/appropriation-status-plan.md). Implementação e incorporação concluídas em 23/10/2026.

## Próxima etapa — P5 em chunks

| Chunk             | Recorte proposto                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------- |
| A — Comportamento | Conferir o modelo e a rotina do VBA e definir quais campos são recorrentes                   |
| B — Configuração  | Configurar um modelo local simples, sem importar dados históricos como pendências            |
| C — Aplicação     | Preencher um dia novo uma vez, preservando dias existentes; Adicionar linha continua avulso  |
| D — Verificação   | Conferir persistência, uso por teclado e ausência de linhas duplicadas em exemplos fictícios |

## Limites e pendências

- Catálogo começa vazio; cadastro manual, sem importar IDs da planilha ou descobrir atividades automaticamente. A configuração local não comprova que um ID é aceito pelo servidor; o envio verifica o contexto remoto e avisa quando a API não fornece a lista do projeto; o Redmine decide a aceitação final do código na criação.
- O nome digitado permanece no rascunho. O catálogo resolve nome + projeto para código; mudar/remover cadastro não reescreve rascunhos antigos. Após abrir a página, consultar a tarefa novamente para identificar seu projeto.
- Novos tipos de campo exigem implementação própria; não há construtor genérico de validações. Modelo do dia e demo continuam indisponíveis.
- A exceção de certificado foi aceita para o servidor privado conhecido; manter padrão estrito, escopo por origem e aviso visível. O `.env` é lido ao iniciar o processo; reiniciar após alterações.
- Os registros históricos da planilha já foram apropriados e não devem ser reenviados. O teste específico autorizado já foi confirmado; detalhes e estado ficam fora do Git. A autorização individual está consumida. Os lotes P4 têm autorização própria registrada separadamente, sem liberar outros reenvios.
- Sem total semanal, cópia de linhas para outros dias ou hospedagem compartilhada no escopo atual. A demo pública continua entre as últimas etapas.
