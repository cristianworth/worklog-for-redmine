# Arquitetura e decisões técnicas

Uma aplicação pessoal, com dois modos e a mesma interface. O modo local usa Node e SQLite; a demo pública usa somente arquivos estáticos e dados fictícios no navegador.

## Mapa do código

| Responsabilidade | Entrada / contrato |
| --- | --- |
| Escolher o modo e montar React | `src/client/main.tsx` |
| Contrato tipado de dados | `src/client/data-access.ts`, `WorklogDataProvider.tsx` |
| Editor, seleção e estado não salvo | `App.tsx`, `DaySection.tsx`, `editor.ts` |
| Revisar e exibir resultados | `BatchReview.tsx`, `SubmissionReview.tsx`, `ReceiptBadge.tsx` |
| HTTP local e seus erros/reconhecimentos | `http-data-access.ts` |
| Exemplos, snapshot e simulação | `demo-examples.ts`, `demo-store.ts`, `demo-submissions.ts` |
| Validação e tipos compartilhados | `src/shared/` |
| Iniciar serviço local/configuração | `src/server/index.ts` |
| Rotas e fronteira HTTP | `src/server/app.ts` |
| Persistência/revisões/recibos | `src/server/storage.ts` |
| Fluxo individual/lotes | `src/server/submissions.ts`, `batches.ts` |
| API, transporte e cache temporário | `redmine.ts`, `redmine-transport.ts`, `issue-lookup.ts` |

## Fluxos principais

1. **Editar:** componentes mantêm alterações na página; durações são convertidas para minutos inteiros. Trocar o período não descarta os dias editados fora da tela.
2. **Salvar:** o contrato envia a revisão conhecida; dias são gravados todos ou nenhum. Catálogo e modelo possuem salvamentos/revisões próprios. Conflito preserva a edição para recuperação deliberada.
3. **Revisar:** seleção de linhas salvas gera snapshots de data, tarefa, atividade/código, observação, conta e revisões. Uma revisão não cria horas e expira após 15 minutos.
4. **Confirmar:** todo o lote passa por validação atual antes da primeira criação. Cada linha mantém sua conferência final, e seu estado iniciado é persistido antes da chamada remota. Só HTTP 201 mais um resultado correspondente confirma criação.
5. **Recuperar:** resultado incerto permanece protegido. Conferência/reconciliação lê o serviço sem repetir criação. Lotes param na primeira falha, preservam sucessos e nunca retomam automaticamente.

## Por que estas escolhas

- **SQLite embutido:** persistência local sem instalar outro serviço, com transações para rascunhos. Redmine continua externo: não existe transação que desfaça um lote remoto inteiro.
- **Minutos inteiros:** soma e transporte não dependem de ponto flutuante. A entrada compacta é conveniência do editor; o contrato `HH:MM` continua estrito.
- **Catálogo único:** nome/código é configuração da instância, disponível antes da consulta da tarefa. O projeto continua na validação remota, sem duplicar atividades locais.
- **Contrato substituível:** a interface não conhece URLs nem SQLite. A seleção do adaptador ocorre uma vez na entrada, sem fallback HTTP na demo. Evita uma segunda aplicação só para o portfólio.
- **Simulação no navegador:** dispensa conta, chave e backend público. O custo é perder dados ao limpar o site e depender da capacidade de armazenamento do navegador. Web Locks coordenam mutações por origem; a alternativa orienta uma aba por vez.
- **Salvamento/confirmação explícitos:** favorecem controle sobre vários dias e recuperação de falhas. Não há repetição automática de criação incerta nem alteração de status do card.

## Builds e publicação

`build` gera `dist/` para o serviço local. `build:demo` gera `dist-demo/` na raiz da prévia; `build:pages` gera a mesma demo com base `/worklog-for-redmine/`. A marca usa `import.meta.env.BASE_URL`. O Vite elimina o adaptador HTTP no modo demo e falha se encontrar backend, diretórios privados/dados ou caminhos de API no bundle. A CSP bloqueia conexões operacionais; a auditoria final confere tipos de arquivos e referências de recursos.

O workflow verifica testes, TypeScript, builds e artefato antes de publicar. Somente o job de publicação recebe permissões `pages: write` e `id-token: write`; PRs e forks não publicam no destino original. [Operação e rollback](deployment.md).

## Limites

Não há servidor multiusuário, descoberta automática de atividades, sincronização de demo entre dispositivos ou promessa de compatibilidade com toda customização do Redmine. Cache de preenchimento não autoriza envios. A demo não testa autenticação ou permissões reais. Segurança e exclusões de dados em [SECURITY.md](../SECURITY.md); contratos detalhados em [data-access.md](data-access.md).
