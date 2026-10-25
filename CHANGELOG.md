# Changelog — Worklog for Redmine

Histórico das versões. Criado em 23/10/2026 com a base anterior ao modelo registrada retrospectivamente como v0.0.0. A v0.3.0 marca a primeira publicação pública do código no GitHub, sob licença MIT. A v0.5.0 entrega a demo isolada; sua hospedagem pública permanece na P8.

## Regras de versionamento

- Usar `MAJOR.MINOR.PATCH`, começando com `0.x.y` durante a evolução inicial. Uma entrega funcional nova incrementa `MINOR`; correções da mesma entrega incrementam `PATCH` quando houver uma nova versão.
- Um commit não exige uma nova versão. Consolidar mudanças relacionadas na mesma entrega; não incrementar o número por manutenção documental isolada.
- Registrar somente alterações entregues nas versões datadas. Ideias e tarefas futuras ficam em [ROADMAP.md](ROADMAP.md), sem apresentar funcionalidades planejadas como existentes.
- `package.json` e as duas versões raiz de `package-lock.json` devem coincidir com a versão atual. A interface lê a versão do manifest durante a compilação; recompilar depois de alterá-la.
- Tags locais `vX.Y.Z` identificam a revisão de cada versão. Não mover tags já criadas nem reescrever histórico. A tag retrospectiva v0.0.0 aponta para a última revisão anterior ao P5; os manifests antigos continuam como estavam.
- Antes de cada commit/merge, ler este arquivo e avaliar uma versão proporcional à entrega. Em 25/10/2026, Cristian delegou ao agente a decisão de versão neste projeto e pediu push automático dos commits coesos, sem nova confirmação rotineira. Não incrementar a versão por commit da mesma entrega. Publicação e dados reais continuam sujeitos ao escopo autorizado.
- Nunca incluir credenciais, planilhas privadas, bancos, backups ou dados reais nos registros, tags e arquivos distribuídos.

## [0.6.0] — 2026-10-25

### Preparação de publicação e repositório — P8

- Build/preview próprios para `/worklog-for-redmine/`, com auditoria dos caminhos e existência dos recursos. O workflow verifica suíte, build local, demo na raiz e Pages; somente o artefato estático aprovado pode ser publicado em `master` do repositório original. PRs/forks não publicam nesse destino; permissões de Pages/OIDC restritas ao job de deploy.
- Atalho **Abrir demonstração** habilitado no modo local, em outra aba, e link para código/documentação no rodapé. Descrição da página adicionada para apresentação do projeto.
- Rótulos de envio extraídos do componente para um módulo tipado de apresentação; estados fictícios com texto próprio. Quantidade pendente calculada uma vez na revisão. Estilos temporários sem uso removidos. Contratos HTTP, banco e regras de criação preservados.
- README reorganizado para entrada de visitantes e contribuidores; guias de uso local, arquitetura, publicação/rollback e mapa da documentação. Guia de contribuição ampliado e política de segurança adicionada. Hipóteses antigas de catálogo por projeto e mudança de status identificadas como substituídas/canceladas; instruções do agente consolidadas no comportamento atual.
- Cristian delegou ao agente a escolha de versão neste projeto e pediu push automático dos commits coesos. Manifests alinhados em 0.6.0.

### Verificação e pendência externa

- 346 testes/26 arquivos aprovados, builds local/demo/Pages e auditorias estáticas. Caminho de produção conferido manualmente: salvar/recarregar, revisar/simular dia, recuperar recibos, restaurar e navegar pela marca. Sem acesso ao banco de uso ou novo envio real.
- Ativação do Pages em sessão autenticada e conferência da URL pública ainda pendentes. A revisão automática bloqueou reutilizar credencial do Git na API; o navegador estava sem login. O workflow pronto e o destino documentado não equivalem a deploy concluído. [Estado atual](ROADMAP.md).

## [0.5.0] — 2026-10-25

### Demo isolada — P7-A–E

- Mesmo editor com acesso substituível para catálogo, dias, modelo, tarefas, conexão, recibos e lotes. Adaptador local preserva HTTP, revisões, conflitos 409, cancelamento e conferência do salvamento; catálogo único e dados de uso preservados.
- Build estático separado em `dist-demo/`, sem `.env`, adaptador HTTP, backend ou SQLite. Barreira na compilação, CSP sem conexões operacionais e auditoria reproduzível do artefato.
- Três dias relativos à primeira visita, tarefas/projetos fictícios, catálogo e modelo; salvamento explícito no navegador. Conteúdo inválido/schema futuro é preservado até restauração confirmada. Falhas de gravação mantêm dados/edições anteriores; armazenamento indisponível informa sessão temporária.
- Revisão e confirmação fictícias para uma linha, um dia ou várias datas. Validação integral antes da primeira criação, execução sequencial, resultados parciais, revisões/expiração e trava contra repetição. Recibos, lotes e conferência persistem; conferência/reconciliação não recria resultados e recarga não retoma trabalho automaticamente.
- Schema 2 aceita os dados de P7-B sem apagar alterações. Web Locks coordenam gravação, simulação e restauração quando disponíveis; sem a API, aviso para usar uma aba por vez. Restaurar inclui recibos e editores abertos, preservando outras chaves e o modo local.
- Aviso permanente de demonstração, percurso sugerido, resultados identificados como simulados, atalho para o conteúdo, foco na restauração e tabelas acessíveis por teclado. Corrigido transbordamento da página em tela menor. Atalho para a demo pública continua pendente da hospedagem.
- CI executa testes, build local/demo e auditoria estática. README e roadmap atualizados para portfólio, com GitHub Pages reservado à P8.

### Verificação e limites

- 342 testes/25 arquivos aprovados, ambos os builds e auditoria de cinco arquivos estáticos. Instalação limpa sem `.env`, chave ou banco aprovada.
- Interface conferida com dados fictícios: confirmação de uma linha, dia e várias datas, recarga/conferência, bloqueio integral por tarefa inválida, restauração com recibos, teclado e viewport de 375px. Testes cobrem quota, corrupção, conflitos, rejeição parcial, resposta perdida e interrupção sem retomada.
- Nenhum envio real, acesso ou alteração do SQLite de uso. Simulação não comprova permissões/disponibilidade do Redmine. Limpar dados do site perde o histórico fictício; sem Web Locks, usar uma aba por vez.
- Cristian aprovou v0.5.0, commit e push. Os recortes A/B foram registrados inicialmente sem mudar a v0.4.0; esta versão consolida P7. Publicação da demo e conferência por visitante independente continuam na P8.

## [0.4.0] — 2026-10-24

### Catálogo único — P6.4

- Validação visual de Cristian em 24/10/2026: os dois testes ficaram com o tipo de atividade esperado. Planejamento e decisões consolidados; o catálogo de uso permanece com 15 atividades únicas, sem cópias por projeto.
- Um catálogo de atividades para a instância configurada, com nome e código únicos. Dias e modelo permitem escolher a atividade antes de preencher/consultar o card; Configurações não repete atividades por projeto.
- Migração automática de vínculos antigos equivalentes com backup consistente, revisão incrementada e preservação dos rascunhos, modelo, lotes e recibos. Conflitos impedem a migração sem escolher um código silenciosamente; páginas antigas precisam recarregar.
- Validação integral do lote preservada: consulta atual da tarefa, conta e disponibilidade da atividade por projeto quando a API a fornece. Recibos apropriados continuam mostrando os códigos originais.
- Catálogo privado de uso consolidado em 15 atividades; quatro códigos corrigidos, com autorização, após comparação por nome com a API. Nenhum código privado incluído como padrão da aplicação.
- 247 testes/17 arquivos aprovados; compilação e interface fictícia conferidas. Dois testes reais autorizados confirmaram o mesmo código de atividade em dois projetos, com leitura posterior e status mantidos. Autorização consumida, resultados somente no registro privado; exclusão manual fica com Cristian.

## [0.3.0] — 2026-10-23

### Navegação e publicação do código

- Código público em [cristianworth/worklog-for-redmine](https://github.com/cristianworth/worklog-for-redmine), licença MIT, instruções de clone e exclusão explícita dos handoffs locais. Publicação do código antecipada por pedido de Cristian; demo continua em P7 e publicação da demo em P8.
- Seta no cabeçalho para recolher/expandir as tarefas de cada dia. Data, situação, total e ações do dia continuam visíveis.
- Recolher preserva edições e seleções; **Adicionar linha** expande o dia e leva o foco à tarefa nova. O estado visual acompanha as datas ao trocar o período enquanto a página estiver aberta; recarregar abre todos os dias.
- Catálogo do banco local de uso preenchido com as 15 atividades fornecidas por Cristian, reutilizando a lista nos projetos das tarefas conhecidas. Operação privada com backup e conferência, sem valores reais no código, catálogo padrão ou alteração dos recibos antigos.
- 242 testes/17 arquivos e compilação aprovados. Interface conferida com dados fictícios: editar, recolher, salvar, adicionar com foco e trocar o período. Banco auditado contra backup: rascunhos, recibos, lotes e modelo inalterados; nenhuma hora real enviada. Revisão de privacidade também conferiu 227 blobs do histórico Git, preservado sem reescrita.

## [0.2.0] — 2026-10-23

### Adicionado — P6.1–P6.3, preenchimento

- Seleção fechada de atividades nos dias e no modelo, com nome e código das opções cadastradas para o projeto da tarefa. Consultar/sair do código identifica o projeto; nenhum código global ou opção inicial é inventado.
- Valores antigos sem correspondência permanecem visíveis, identificados e corrigíveis, sem apagar rascunhos. Linhas apropriadas mostram o código do recibo e continuam protegidas, mesmo após alterações no catálogo.
- Consulta de tarefa no modelo com o mesmo cache e descarte de respostas antigas dos dias. Uma nova consulta suspende o contexto anterior até confirmar o projeto atual.
- Duração abreviada em dias e modelo: `30`/`030` → `00:30`, `130`/`0130` → `01:30`, `800` → `08:00`. O formato `HH:MM` continua aceito; a normalização ocorre ao sair do campo.
- Totalização e salvamento interpretam a duração abreviada mesmo antes de sair do campo. Minutos fora de 00–59, decimais, sinais e segundos são recusados, sem conversão silenciosa.

### Preservado e verificado

- Mesmos contratos de persistência e envio: duração em minutos inteiros, nome de atividade no rascunho e código resolvido por projeto no backend. Nenhuma migração dos dados anteriores.
- Modelo mantém o contexto da tarefa ao salvar; fechar o painel preserva edições. Foco de teclado e estilo dos seletores integrados aos campos existentes.
- 242 testes em 17 arquivos e compilação aprovados; testes integrados conferem IDs de projetos distintos, payload `HH:MM`, bloqueio de atividade sem vínculo e reabertura do banco.
- Interface conferida com dias/projetos fictícios, duração inválida, correção de valor antigo, modelo e lote simulado de dois dias. Nenhuma hora real enviada; dias 19–21/10 e recibos preservados.
- P5.1 removido do escopo por decisão de Cristian; envios continuam mantendo o status do card. Demo e publicação permanecem P7/P8.

### Limites

- O catálogo de atividades continua sendo cadastrado em Configurações por projeto. Não há descoberta automática de IDs; sem catálogo válido, novos envios continuam bloqueados.
- O formato compacto usa os últimos dois dígitos como minutos: `90` e `160` são inválidos. Não há entrada de segundos nem arredondamento de minutos.

## [0.1.0] — 2026-10-23

### Adicionado — P5, modelo do dia

- Painel **Modelo do dia** para configurar tarefa, duração, atividade e observação recorrentes. Começa vazio, aceita campos incompletos e permite até 100 linhas.
- **Salvar modelo** persiste a configuração no SQLite, separadamente dos rascunhos e do envio ao Redmine, com proteção contra conflito entre abas.
- **Criar dia com modelo** copia as linhas uma vez para um dia ainda não iniciado, com identificadores novos. A cópia fica editável e não salva até a ação **Salvar rascunhos**.
- Proteção de dias existentes, inclusive dias salvos vazios e edições locais. Alterar o modelo não modifica cópias anteriores; abrir um período não preenche seus dias automaticamente.
- **Adicionar linha** continua criando uma linha avulsa. Fechar o painel preserva suas edições enquanto a página estiver aberta; sair da página avisa sobre alterações não salvas.
- Versão visível no rodapé, derivada do manifest, e histórico de alterações neste arquivo.

### Verificação

- 203 testes em 14 arquivos e compilação aprovados na entrega do P5; interface conferida com dados fictícios, incluindo persistência, aplicação única e independência entre modelo e dias.
- Nenhum lançamento ou mudança de status real executado nessa entrega; dias protegidos e recibos existentes preservados.

## [0.0.0] — 2026-10-23

Base histórica anterior ao modelo do dia, correspondente às etapas P0–P4.2 e ao commit `e018fed`. O rótulo v0.0.0 identifica esse marco retrospectivamente; não altera os manifests nem as datas dos commits antigos.

### Incluído na base

- Rascunhos locais em SQLite, edição de vários dias por scroll, intervalo livre e opção **Até hoje**.
- Duração persistida em minutos, total por dia, cópia rápida do código da tarefa e salvamento explícito de todos os dias alterados.
- Configuração privada do Redmine no backend, consulta automática de tarefa ao sair do código e cache temporário de leitura.
- Catálogo manual de atividades por projeto, com associação nome/código e validação no backend. A interface ainda aceita texto livre com sugestões; seleção fechada fica para a próxima versão.
- Envio individual, por dia e por seleção de vários dias, com revisão e confirmação, validação integral antes do primeiro envio e parada na primeira falha durante as criações.
- Recibos duráveis, trava contra duplicação, sinalização e datas de apropriação, conferência por leitura e preservação de resultados parciais/incertos.
- Incorporação controlada de histórico já confirmado, com backup e sem reenvio das horas.

### Limites desse marco

- Sem modelo do dia e sem demo pública. Digitação de duração exige `HH:MM`; atalhos como `30` e `130` ainda não existem.
- 190 testes em 13 arquivos e compilação aprovados na última entrega anterior ao P5.
