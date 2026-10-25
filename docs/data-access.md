# Acesso substituível aos dados — P7-A

Implementação conferida em 25/10/2026. O contrato `WorklogDataAccess`, em `src/client/data-access.ts`, reúne os acessos operacionais de todos os componentes. `main.tsx` escolhe uma única implementação no início da página e a fornece pelo `WorklogDataProvider`. Provider ausente gera erro; nenhum caminho recorre implicitamente ao HTTP.

| Operações | Modo local | Demo mínima de P7-A |
| --- | --- | --- |
| Ler/salvar catálogo | GET/PUT `/api/activities` | Catálogo único em memória, inicialmente vazio |
| Ler/salvar dias | GET/PUT `/api/days`, envelope `{ days }` | Dias em memória, revisões e gravação atômica |
| Ler/salvar modelo | GET/PUT `/api/day-template` | Modelo independente em memória, inicialmente vazio |
| Consultar/atualizar tarefa | GET `/api/redmine/issues/:id`, refresh opcional | Somente tarefa fictícia 9001; outras retornam 404 |
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

A preferência local permanece em `worklog.period`; a demo usa `worklog.demo.period`. Somente essa preferência persiste nesta etapa. Catálogo, dias e modelo são temporários, independentes por página e descartados ao recarregar. A interface informa esse limite e não pede credenciais.

## Verificação e limites

316 testes/22 arquivos e ambos os builds passaram em 25/10/2026. Os testes exercitam todos os contratos HTTP, erros/cancelamento, reconhecimento de salvamentos, backend real com SQLite em memória e todas as operações da demo com HTTP bloqueado. Uma proteção de fonte impede acessos de rede nos componentes.

Conferência manual: demo estática sem backend, catálogo/dias/modelo, tarefa fictícia, indisponibilidade explícita dos envios e sessão vazia após recarga. Modo local conferido com SQLite em memória e transporte Redmine fictício: conexão, tarefa, modelo, salvamento, revisão/confirmação de lote, polling, atualização, recibo e verificação por leitura. Houve uma criação somente no serviço fictício, uma preparação e uma confirmação; nenhuma gravação real.

P7-B ainda prepara exemplos de vários dias e persistência do visitante; P7-C implementa envio simulado e restauração; P7-D faz a revisão completa. Essa demo técnica não é uma experiência pronta para portfólio. Hospedagem/publicação ficam em P8, sem configuração ou publicação executada nesta entrega.
