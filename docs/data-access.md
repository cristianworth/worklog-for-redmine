# Acesso substituível e persistência da demo — P7-A/B

Implementação conferida em 25/10/2026. O contrato `WorklogDataAccess`, em `src/client/data-access.ts`, reúne os acessos operacionais de todos os componentes. `main.tsx` escolhe uma única implementação no início da página e a fornece pelo `WorklogDataProvider`. Provider ausente gera erro; nenhum caminho recorre implicitamente ao HTTP.

| Operações | Modo local | Demo atual |
| --- | --- | --- |
| Ler/salvar catálogo | GET/PUT `/api/activities` | Catálogo único fictício, salvo no navegador |
| Ler/salvar dias | GET/PUT `/api/days`, envelope `{ days }` | Três dias fictícios, salvamento explícito e revisões |
| Ler/salvar modelo | GET/PUT `/api/day-template` | Modelo fictício independente, salvo no navegador |
| Consultar/atualizar tarefa | GET `/api/redmine/issues/:id`, refresh opcional | Tarefas fictícias 9001, 9004 e 9007; outras retornam 404 |
| Estado/teste da conexão | GET `/api/redmine/status`, POST `/api/redmine/check` | Estado sem configuração/chave; conferência sem conexão |
| Listar recibos/lotes por período | GET `/api/submissions` e `/api/submission-batches` | Listas vazias |
| Preparar/confirmar/conferir/reconciliar recibo | POSTs individuais originais | Erro explícito 501; nenhuma tentativa real |
| Preparar/confirmar/consultar lote | POSTs/GET originais, confirmação 202 | Erro explícito 501, inclusive polling e recuperação |

## Contratos preservados

O adaptador HTTP conserva URLs, métodos, envelopes, cancelamento e erros do servidor, incluindo status 409 em `DataAccessError`. Catálogo e modelo exigem revisão seguinte e conteúdo correspondente; dias exigem reconhecimento de todas as datas e revisões seguintes. Não há repetição automática de gravações.

Conversão dos campos, estado de edição, descarte de respostas antigas e conferências da identidade do recibo continuam nos componentes. A preparação de lote compartilha sua promessa durante os efeitos de StrictMode. A confirmação perdida conserva a recuperação por leitura e o bloqueio contra nova confirmação. Backend, SQLite de uso, preflight integral e recibos não foram modificados.

## Entrada e build separados

`npm run build` gera o modo local em `dist/`. `npm run build:demo` gera somente a interface e a simulação em `dist-demo/`; `npm run preview:demo` serve esse build em `http://127.0.0.1:4173/`, sem iniciar Express ou abrir SQLite.

No modo demo, o Vite não carrega arquivos `.env` nem expõe variáveis de ambiente por prefixo. A compilação falha se o bundle incluir módulos do backend, diretórios privados/dados, o adaptador HTTP ou caminhos `/api/`. O HTML da demo inclui `connect-src 'none'` e `form-action 'none'`. Arquivos estáticos da própria página continuam sendo carregados normalmente.

A preferência local permanece em `worklog.period`; a demo usa `worklog.demo.period`. Dados da demo ficam exclusivamente em `worklog-for-redmine.demo.state`, com `schemaVersion: 1`, data de referência, catálogo, dias e modelo. A primeira visita cria exemplos; visitas posteriores preservam as datas e o conteúdo salvo. A primeira abertura e a restauração mostram o período a partir do primeiro exemplo, mantendo o intervalo livre.

## Persistência e recuperação — P7-B

`demo-examples.ts` cria os exemplos do zero: três dias anteriores à primeira visita, três atividades globais, três tarefas de dois projetos fictícios e um modelo incompleto permitido. O dia atual continua não iniciado, pronto para experimentar a cópia do modelo. Nenhum código ou descrição vem do banco de uso.

`demo-store.ts` valida o formato e usa um único snapshot por gravação. Alterações recebidas por leitura são cópias: editar não salva. Catálogo, dias e modelo salvam separadamente, preservando os demais campos. Se `setItem` falhar, o snapshot anterior fica intacto e a interface mantém as edições. Revisões detectam payloads antigos entre abas; isso não é uma transação ou exclusão mútua entre gravações simultâneas de abas distintas.

Na abertura, armazenamento indisponível gera uma sessão temporária com aviso visível. Conteúdo inválido ou schema desconhecido não é sobrescrito: a página informa o problema e bloqueia salvamentos até uma restauração explícita. Falhas de acesso ou corrupção durante o uso também bloqueiam gravações; não há recuperação silenciosa que descarte o registro anterior.

Restaurar exemplos pede confirmação, grava somente o registro da demo e remonta os editores para limpar catálogo/modelo/dias não salvos, seleções e caches de tela. O período próprio da demo volta aos exemplos atuais. Revisões avançam para rejeitar payloads antigos após o reset. Se a gravação da restauração falhar, os editores e os dados anteriores permanecem. Nenhum `localStorage.clear`, remoção de outras chaves ou operação sobre SQLite é usado.

## Verificação e limites

P7-A foi conferido com 316 testes/22 arquivos. Após P7-B, 326 testes/23 arquivos e ambos os builds passaram em 25/10/2026. Além dos contratos HTTP e do isolamento, os casos novos protegem recarga, salvamento explícito, independência dos cadastros, conflitos entre abas, gravação de vários dias, quota/acesso negado, conteúdo inválido/schema futuro, restauração e preservação de outras chaves.

Conferência manual de B: exemplos preenchidos, edição/salvamento/recarga de dias, catálogo e modelo; cancelamento e confirmação da restauração com edições abertas nos três editores; retorno ao período dos exemplos. Evidência anterior de A: modo local com SQLite em memória e transporte Redmine fictício, incluindo confirmação/consulta de lote e recibo sem repetição. Não houve novo envio real ou acesso ao banco de uso.

P7-C ainda implementa envios/recibos simulados, D prepara apresentação/acessibilidade e E consolida verificações/CI. A restauração foi antecipada para B. A demo ainda não é uma experiência completa para portfólio. Hospedagem/publicação ficam em P8, sem configuração ou publicação executada nesta entrega.
