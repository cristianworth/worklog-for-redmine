# Uso local

Requisitos e instalação estão no [README](../README.md). A aplicação serve em `http://127.0.0.1:3000`; desenvolvimento e execução compilada usam a mesma porta, então encerre um antes de iniciar o outro. `PORT` permite escolher outra porta.

No Windows, o [Worklog.exe](windows-launcher.md) prepara dependências/build quando necessário, inicia com `npm start` e abre o navegador na porta efetiva. Mantenha o executável junto de `package.json`; a janela dele controla o serviço, e a interface de trabalho continua no navegador. O banco existente permanece no mesmo lugar.

## Dados e conexão

Uma instalação nova começa sem exemplos e com catálogo vazio. O Node abre `data/worklog.sqlite`, criando o arquivo somente se necessário. Reiniciar reutiliza os dados. O período é preferência do navegador; rascunhos, modelo, catálogo e recibos ficam no SQLite. Faça backup com o serviço parado e preserve os recibos junto dos rascunhos. Não troque o banco por uma cópia antiga enquanto a aplicação estiver aberta.

Para consultar e enviar ao Redmine, copie `.env.example` para `.env` e preencha `REDMINE_URL` (HTTPS, preservando eventual subdiretório) e `REDMINE_API_KEY`, se necessário. Reinicie após editar: variáveis do processo prevalecem sobre `.env`. A chave só é lida pelo backend; nunca use variáveis `VITE_` para credenciais.

Abra **Configurações → Testar acesso à API**. O teste lê somente a conta atual; não registra horas. O login do navegador não autentica o Node. Certificados são validados por padrão; a exceção opcional é restrita à origem configurada, aparece na interface e reduz a garantia de identidade do servidor. Não ative uma exceção global de TLS. [Detalhes e diagnóstico](redmine-access.md).

## Catálogo e preenchimento

Em **Configurações → Atividades**, cadastre nome/código uma vez para a instância e use **Salvar catálogo**. Nomes e códigos são únicos, sem projeto. Não há importação automática nem descoberta de códigos. A [API de enumerações do Redmine](https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations) lista os códigos; a criação continua sujeita às permissões remotas.

Selecione **De** e **Até**, ou **Até hoje** para acompanhar a data atual. Datas incompletas/invertidas preservam a última visualização válida. Adicione linhas, escolha atividade, informe tarefa e saia do campo para consultar assunto/status/projeto. O ícone de cópia copia somente o código; o navegador pode limitar a área de transferência.

A visualização mostra somente segunda a sexta dentro do intervalo. Sábados/domingos já salvos continuam no banco, sem exclusão ou migração; um período só de fim de semana mostra um aviso. A seleção de atividades nos dias/modelo exibe apenas o nome. Os códigos continuam no catálogo, nos recibos e na revisão do envio.

Use `30`/`030` para 30 minutos, `130` para 1h30 ou `01:30`. `90`, `160`, sinais, decimais e segundos são inválidos; não há arredondamento. Linhas incompletas podem ser salvas como rascunho. Total diário inclui todos os rascunhos; uma duração malformada exige correção/limpeza antes de salvar.

Para acrescentar tempo, clique no **+** verde à esquerda da duração. Digite o acréscimo em **Tempo a somar**, confira **Novo total** e pressione **Enter** ou **Somar**. Por exemplo, `01:00` + `030` resulta em `01:30`. **Esc**, o × ou clicar novamente no + cancela sem alterar o valor. Uma duração vazia parte de zero; uma duração atual inválida precisa ser corrigida antes. Digitar diretamente no campo principal continua substituindo o valor. A soma altera só o rascunho: ainda é necessário salvar. Recibos protegidos não permitem somar tempo.

**Salvar rascunhos** grava todos os dias alterados, inclusive fora do período visível. Catálogo e modelo salvam separadamente. Recolher um dia preserva edições e seleções. **Modelo do dia** permite iniciar uma data ainda não tocada com uma cópia independente; nunca substitui um dia existente, inclusive um dia salvo vazio. [Guia do modelo](day-template.md).

Dias totalmente apropriados iniciam com tarefas recolhidas. Dias vazios, parcialmente apropriados, pendentes ou a conferir ficam abertos. Clique em qualquer área livre do cabeçalho para alternar; a seta continua disponível por teclado. Selecionar texto ou clicar nos botões não dispara a alternância do cabeçalho. Expandir/recolher manualmente prevalece enquanto a página estiver aberta; recarregar reaplica o padrão. Adicionar linha expande o dia e leva o foco à tarefa nova.

## Envio e recuperação

1. Salve os dias. Escolha **Enviar dia** ou marque linhas/dias e use **Enviar selecionados**. Uma linha também usa a revisão de lote; o limite é 100 linhas por seleção.
2. Confira datas, tarefas/projetos, durações, observações e atividades/códigos. Preparar a revisão não envia horas. Resolver um impedimento requer nova revisão.
3. Confirme explicitamente. A revisão expira em 15 minutos e alterações de revisão/contexto a invalidam. Toda a seleção é validada antes da primeira criação, sem depender do cache de preenchimento.
4. O lote é sequencial e para na primeira falha. Resultados anteriores ficam preservados; equivalentes não são criados novamente. Status dos cards não muda.
5. Fechar a janela não cancela trabalho aceito. Reabra por **Envios recentes neste período → Ver lote**. Reiniciar o serviço não retoma automaticamente as linhas restantes.
6. Para resultado incerto, use **Ver resultado** e a ação de conferência/reconciliação. Ela lê sem reenviar. Confirmados, existentes, iniciados e incertos permanecem protegidos, mesmo se uma leitura posterior não encontrar o lançamento.

Se outra aba salvar antes, o conflito preserva suas edições. Copie o que precisa, descarte/recarregue pelo fluxo da tela e reaplique conscientemente; não apague recibos para liberar um reenvio. Catálogo/modelo mantêm alterações ao fechar o painel. Recarregar/sair avisa sobre edições pendentes.

## Atualização de bancos antigos

A v0.4.0 substituiu o catálogo por projeto por uma lista única. Ao iniciar com o formato antigo, a migração faz backup consistente em `backups/`, consolida apenas nomes/códigos equivalentes e incrementa a revisão. Conflitos abortam sem escolher um código silenciosamente: resolva-os na versão anterior antes de atualizar. Não use uma versão antiga contra o banco convertido; preserve o backup. Dias, modelo e códigos dos recibos anteriores não são reescritos. Páginas antigas devem recarregar antes de salvar.

## Demo e problemas comuns

**Abrir demonstração** abre o [site público](https://cristianworth.github.io/worklog-for-redmine/) em outra aba, usando dados fictícios próprios. A demo não importa sua instalação nem acessa o SQLite.

| Sintoma | Conferência inicial |
| --- | --- |
| Porta ocupada | Encerre o outro modo ou escolha `PORT` |
| Chave/endereço alterado sem efeito | Reinicie o Node e confira variáveis do processo |
| Erro de autenticação/permissão | Confira acesso da conta à API/tarefa; não trate 404 como prova de inexistência |
| Atividade antiga sem correspondência | Preserve o texto e ajuste pelo catálogo; não altere IDs históricos de recibos |
| Resultado incerto | Confira por leitura; não repita criação nem remova o recibo |

Relatos públicos devem usar exemplos fictícios e indicar versão/modo. Não inclua banco, `.env`, chave, servidor privado ou descrições reais. [Contribuição](../CONTRIBUTING.md) e [segurança](../SECURITY.md).
