# Roadmap — Worklog for Redmine

Atualizado em 25/10/2026. Versão da entrega: **v0.5.0 / P7**. Código público sob MIT; hospedagem da demo ainda pendente. Histórico no [changelog](CHANGELOG.md), invariantes nas [decisões](docs/project-decisions.md) e detalhes técnicos no [plano](docs/development-plan.md).

## Objetivo e prioridades

A demo deve permitir que um recrutador entenda o problema e experimente editar, salvar e revisar apontamentos em poucos minutos, sem conta, credenciais ou instalação. O modo local continua sendo a aplicação de uso, com seus dados preservados.

Ordem de importância: **isolamento → dados recuperáveis → fluxo completo → apresentação/acessibilidade → qualidade → publicação**. Entregar recortes utilizáveis e conferidos; não ampliar o produto com funcionalidades sem necessidade demonstrada.

## Base entregue

| Versão / etapa | Resultado |
| --- | --- |
| v0.0.0 / P0–P4.2 | Rascunhos em SQLite, período livre, consulta com cache, envios individuais/lotes, recibos e preflight integral |
| v0.1.0 / P5 | Modelo do dia, salvamento separado e cópia independente para dias novos |
| v0.2.0 / P6.1–P6.3 | Seleção de atividades e duração abreviada; catálogo por projeto substituído na v0.4.0 |
| v0.3.0 | Dias recolhíveis e código publicado sob MIT |
| v0.4.0 / P6.4 | Catálogo único, atividade antes do card e migração com backup |
| P7-A / sem nova versão | Acesso substituível completo e build estático isolado; commit `08b78a1` |
| v0.5.0 / P7-A–E | Demo isolada completa, persistência, simulação/recibos, percurso inicial e verificações de entrega |

O cadastro privado tem 15 atividades únicas, sem cópias por projeto. Os dois testes reais anteriores mantiveram o mesmo código em dois projetos, com readback e confirmação visual de Cristian. Não validaram todas as atividades/projetos; suas autorizações estão consumidas.

## P7 — Preparar uma demo utilizável

### A — Isolamento — concluído

Todos os acessos operacionais passam pelo contrato substituível. O build da demo não carrega `.env`, adaptador HTTP, backend ou SQLite. Evidência original de A: 316 testes/22 arquivos, ambos os builds e conferência manual fictícia em 25/10/2026. A simulação completa foi entregue em C. [Contratos e limites](docs/data-access.md).

### B — Exemplos, persistência e recuperação — concluído

- Preparar poucos dias/tarefas fictícios, catálogo único e modelo; datas relativas à primeira visita, preservadas nas visitas seguintes.
- Salvar catálogo, dias e modelo explicitamente no navegador, em um espaço próprio e com formato versionado. Não persistir edições ainda não salvas.
- Manter revisão/conflitos e gravação de todos os dias ou nenhum; identificar limitações entre abas sem prometer uma transação de banco.
- Antecipar **Restaurar exemplos**: confirmação explica o descarte das alterações da demo e afeta somente seus dados, inclusive edições abertas. Não apagar outros dados do navegador.
- Tratar armazenamento bloqueado/cheio, conteúdo inválido e versão desconhecida. Informar limites e preservar o conteúdo anterior até restauração explícita.

**Aceite:** visitante abre uma demo já preenchida, edita/salva/recarrega, mantém os dados e consegue restaurar os exemplos. Sem HTTP ou alteração do modo local; falhas de gravação não aparecem como sucesso.

Implementado em 25/10/2026: três dias, catálogo/modelo e tarefas fictícios; snapshot próprio versionado, salvamento explícito, avisos/recuperação e restauração confirmada dos dados e editores abertos. 326 testes/23 arquivos e builds local/demo aprovados; recarga e cancelamento/restauração conferidos na interface. Limite: revisões entre abas não equivalem a uma transação de banco. [Detalhes](docs/data-access.md).

### C — Envio simulado e recibos — concluído

- Revisão e confirmação simuladas para uma linha, um dia ou várias datas; resultados sempre identificados como simulados.
- Reutilizar regras compartilhadas: validar toda a seleção antes da primeira criação fictícia, preservar revisões, resultados parciais e trava contra duplicação.
- Persistir recibos/lotes da demo no mesmo espaço do visitante. Conferir e reconciliar sem repetir criação; restauração inclui esses resultados.
- Manter status dos cards e distinguir claramente salvar rascunhos de enviar.

**Aceite:** completar o percurso de preenchimento até recibo; tarefa inválida bloqueia o lote inteiro. Recarregar ou repetir confirmação não duplica resultados simulados.

Entregue: recibos individuais e lotes sequenciais, validação integral, resultados parciais e reconciliação sem recriação. Snapshot da demo evoluído para schema 2, preservando dados de B. Web Locks coordenam mutações entre abas quando disponíveis; alternativa informa uso em uma aba. Interrupção nunca retoma automaticamente.

### D — Primeira experiência e acessibilidade — concluído

- Explicar brevemente o problema resolvido e oferecer um percurso sugerido de poucos minutos, sem tutorial obrigatório.
- Destacar o modo demonstração, as tarefas fictícias disponíveis, o salvamento e a restauração; eliminar rótulos temporários de implementação.
- Conferir leitura em tela menor, foco visível, ações por teclado, nomes acessíveis, erros compreensíveis e contraste dos estados.
- Ajustar README com contexto, decisões/trade-offs e instruções rápidas para demo e instalação local; não criar uma segunda aplicação para apresentar o projeto.

**Aceite:** uma pessoa nova entende o propósito e completa o percurso sem explicação no chat, usando mouse ou teclado; o fluxo principal permanece acessível em tela menor.

Entregue e conferido: aviso permanente de simulação, percurso curto, rótulos fictícios, atalho para o conteúdo, foco na restauração, tabelas roláveis pelo teclado e página sem transbordamento a 375px. Percurso executado manualmente com teclado e tela menor; avaliação independente por um visitante continua na P8.

### E — Verificação de entrega — concluído

- Automatizar testes, build local e build demo em CI antes de publicar; manter a barreira que impede backend/API/dados privados no bundle.
- Conferir instalação limpa sem chave, nova visita, recarga, restauração, conflitos e falhas de armazenamento, preservando os dados locais.
- Revisar o artefato distribuível e documentação; escolher a versão da entrega consolidada com Cristian. Sugestão: v0.5.0, sem incremento a cada recorte.

**Aceite:** verificações reproduzíveis passam e as limitações remanescentes estão documentadas. Publicação usa somente o artefato da demo.

342 testes/25 arquivos, builds local/demo e auditoria do artefato aprovados; instalação limpa sem `.env`, chave ou banco conferida. CI definida para repetir os mesmos checks em pushes/PRs. Revisões, quota, corrupção, reset durante trabalho e interrupção cobertos por testes. Cristian aprovou v0.5.0, commit e push em 25/10/2026. A execução remota da CI é conferida após o push; este roadmap não equivale a um deploy.

## P8 — GitHub Pages e conferência pública

Direção: recrutadores/portfólio e endereço `github.io`, conforme conversa de 25/10/2026. GitHub Pages é a recomendação; nenhuma hospedagem foi configurada ou publicada.

1. **Preparar destino:** confirmar Pages e endereço do projeto, configurar o subdiretório dos arquivos e o workflow de publicação do build demo. Conferir o artefato sob esse caminho antes de publicar.
2. **Publicar:** habilitar/publicar no destino autorizado; incluir o endereço no README e no atalho local. Código público e licença MIT já estão resolvidos.
3. **Conferir como visitante:** sessão nova, recarga, restauração, tela menor e caminho direto; conferir versão e disponibilidade real do link.

**Aceite:** outra pessoa experimenta a demo sem instalar Node, informar credenciais ou alcançar o backend real.

## Depois da primeira publicação

Coletar observações reais de uso e priorizar correções que impeçam entender ou completar o percurso. Novas funcionalidades dependem desse retorno; não adicionar login, análises de uso, domínio próprio ou backend público só para ampliar o portfólio.

## Limites preservados

- **P5.1 — Movimentar status: cancelado.** Não reintroduzir.
- Período livre, sem total semanal obrigatório, cópia automática entre datas ou agendamento do modelo.
- Catálogo único; não duplicar por projeto sem incompatibilidade concreta e decisão específica.
- Banco de uso, recibos e especialmente os dias 19–21/10 permanecem protegidos. Não repetir migração, população, importação ou envios reais anteriores.
- Planilha, VBA, credenciais, bancos, backups e resultados reais ficam fora do Git e da demo. Exemplos são criados do zero.
- Importação ampla, múltiplos modelos, autenticação multiusuário e hospedagem do backend de uso ficam fora deste roteiro.
