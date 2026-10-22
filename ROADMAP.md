# Roadmap — Worklog for Redmine

Atualizado em 22/10/2026. Acompanhamento das entregas; decisões e limites no [plano](docs/development-plan.md).

## Entregas

- [x] **P0 — Contexto:** referência privada e plano aprovados.
- [x] **P1 — Um dia:** editar, totalizar, salvar e reabrir. Validado por Cristian.
- [x] **P1.1 — Período livre:** dias por scroll, copiar código e salvar vários dias.
- [x] **P1.2 — Usabilidade:** Até hoje, filtro automático, destaques e identificação do banco local.
- [x] **P2 — Acesso e consulta:** configuração privada, exceção de certificado restrita e consulta explícita por linha. Autenticação e leitura real de assunto/status/projeto verificadas com a chave local; nenhuma hora enviada.
- [x] **P2.1 — Atividades:** catálogo manual de nome/ID por projeto, persistência local e sugestões conforme a tarefa consultada. Implementado e conferido com exemplos fictícios; aguarda revisão de uso de Cristian.
- [ ] **P3 — Envio individual:** revisão de uma linha salva, validação, confirmação e proteção contra reenvio incerto. Simulação primeiro; um alvo real específico já foi autorizado e está registrado privadamente.
- [ ] **P4 — Envio do período:** seleção/revisão de dias e linhas, resultado individual e falhas parciais. Não ampliar a autorização de teste para um lote real.
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

## Próxima etapa — P3 em chunks

| Chunk                        | Resultado esperado                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Contrato e validação     | Conferir envio individual/coletivo no VBA e o contrato aceito pela instância; resolver atividade no projeto e verificar campos/limites antes do envio                           |
| B — Preparação e revisão     | Selecionar uma linha salva, consultar dados necessários e apresentar exatamente o que será enviado; testar respostas de sucesso/falha em simulação                              |
| C — Resultado e persistência | Guardar identificação remota e separar confirmado, rejeitado e incerto; impedir clique/reenvio automático de registros confirmados ou incertos                                  |
| D — Revisão integrada        | Validar simulação e então o único teste real já autorizado. Consultar primeiro se já existe lançamento correspondente; registrar resultado privadamente e manter status do card |

## Limites e pendências

- Catálogo começa vazio; cadastro manual, sem importar IDs da planilha ou descobrir atividades automaticamente. A configuração local não comprova que um ID é aceito pelo servidor; P3 deve validar o contexto remoto antes de gravar.
- O nome digitado permanece no rascunho. O catálogo resolve nome + projeto para código; mudar/remover cadastro não reescreve rascunhos antigos. Após abrir a página, consultar a tarefa novamente para identificar seu projeto.
- Novos tipos de campo exigem implementação própria; não há construtor genérico de validações. Modelo do dia e demo continuam indisponíveis.
- A exceção de certificado foi aceita para o servidor privado conhecido; manter padrão estrito, escopo por origem e aviso visível. O `.env` é lido ao iniciar o processo; reiniciar após alterações.
- Os registros históricos da planilha já foram apropriados e não devem ser reenviados. O teste futuro específico tem autorização própria; detalhes e estado ficam fora do Git. Uma autorização não permite repetir uma criação confirmada ou incerta.
- Sem total semanal, cópia de linhas para outros dias ou hospedagem compartilhada no escopo atual. A demo pública continua entre as últimas etapas.
