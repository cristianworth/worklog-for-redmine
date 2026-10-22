# Roadmap — Worklog for Redmine

Atualizado em 22/10/2026. Lista de acompanhamento; decisões e detalhes ficam no [plano](docs/development-plan.md).

## Entregas

- [x] **P0 — Contexto:** referência privada e escopo conferidos; plano aprovado.
- [x] **P1 — Um dia de rascunhos:** editar, totalizar, salvar e reabrir. Validado por Cristian.
- [x] **P1.1 — Período livre:** dias em sequência por scroll, copiar código e salvar vários dias.
- [x] **P1.2 — Usabilidade:** Até hoje previsível, filtro automático, total e envio destacados; identificação do banco local. Implementado; revisão de uso continua disponível.
- [ ] **P2 — Acesso e consulta:** configuração privada, teste de autenticação e consulta de tarefa. Implementado e verificado em simulação; acesso anônimo real conferido; validação autenticada pendente.
- [ ] **P2.1 — Atividades:** cadastro de nome/ID por projeto, equivalente ao catálogo da planilha.
- [ ] **P3 — Envio individual:** revisar uma linha salva, validar campos, confirmar criação e bloquear reenvio incerto. Simulação primeiro; gravação real exige alvo e autorização específicos.
- [ ] **P4 — Envio do período:** selecionar dias/linhas, revisar e acompanhar resultados individuais e falhas parciais.
- [ ] **P5 — Modelo do dia:** preencher recorrências uma vez, sem sobrescrever dias existentes. O botão atual continua indisponível.
- [ ] **P5.1 — Status opcional:** operação separada do registro de horas, preservando resultados já confirmados.
- [ ] **P6 — Consolidação local:** fluxo completo, teclado, mensagens, testes e instruções proporcionais.
- [ ] **P7 — Demo pública:** mesma interface, dados fictícios e armazenamento exclusivo do navegador; envio simulado e restauração dos exemplos. Sem banco/API/Redmine reais.
- [ ] **P8 — Publicação:** confirmar conta, visibilidade, licença e proveniência; revisar conteúdo e publicar código/demo com instruções.

## Entrega atual: P2 em chunks

| Chunk                             | Entrega e critério                                                                                                                                                              | Estado                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A — Caracterização e configuração | Conferir login/consultas no VBA; criar `.env.example` e carregar configuração somente no servidor, mantendo rascunhos disponíveis sem integração                                | Concluído                                                            |
| B — Consultas no backend          | Testar `/users/current.json` e consultar `/issues/:id.json`; validar JSON, projeto e status; distinguir autenticação, permissão, TLS e rede sem expor chave ou respostas brutas | Concluído                                                            |
| C — Interface                     | Habilitar Configurações com teste de acesso e consulta explícita por linha; mostrar assunto/status/projeto sem alterar rascunhos ou enviar horas                                | Concluído                                                            |
| D — Revisão integrada             | Testes simulados com dados fictícios, build e conferência visual. Validar uma consulta real quando houver acesso seguro                                                         | Simulação e acesso sem credenciais concluídos; autenticação pendente |

Verificação desta entrega: **93 testes em 7 arquivos passaram**, com build TypeScript/Vite aprovado. Conferência visual cobriu configuração ausente, sucesso simulado, consulta sem alterar o rascunho e troca de código durante resposta pendente. A exceção de certificado restrita foi conferida no backend e na interface contra a API real: erro de autenticação, sem enviar chave. Nenhuma hora foi enviada e o banco existente não recebeu dados de teste.

**Próximo passo:** preencher a chave localmente e validar autenticação e uma consulta real de leitura; depois iniciar P2.1, atividades por projeto. P3/P4 continuam sem gravações reais autorizadas.

## Pendências e limites conhecidos

- **Acesso real, conferido em 22/10/2026:** DNS resolve; Node retorna `CERT_HAS_EXPIRED` em `/login` e `/users/current.json`, inclusive com certificados do Windows. Nenhuma credencial foi enviada. Cristian confirmou usar o mesmo endereço da planilha. Após autorização de Cristian para uma exceção restrita ao servidor conhecido, login respondeu 200 e API respondeu 401 JSON sem credenciais. Preservar o subcaminho da instalação. Exceção opt-in implementada; autenticação real pendente de chave local.
- A API exige autenticação (401); ainda não foi possível concluir se aceitará uma chave específica. O primeiro transporte implementado é a consulta JSON já encontrada no VBA. Se a API não estiver disponível, caracterizar o caminho HTML/sessão antes de ampliar; não exigir migração do envio para API como pré-condição.
- Credenciais de acesso real serão inseridas localmente; não colocar senha/chave em chat, fixtures ou Git. Login no navegador não autentica o backend.
- O catálogo por projeto e novos tipos de campo continuam pendentes; não há construtor genérico de campos. A configuração inicial trata acesso, depois atividades.
- Os dados históricos da planilha já foram apropriados. Servem como referência privada, nunca como carga de pendências ou alvo de reenvio.
- Envio ao Redmine, modelo do dia e demo continuam indisponíveis até suas respectivas etapas. Não há total semanal nem cópia de linhas para outros dias no escopo.
