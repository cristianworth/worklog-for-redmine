# Lançador Windows — Worklog.exe

O lançador abre o Worklog no **navegador padrão**. A pequena janela serve para mostrar preparação/status, reabrir o navegador e encerrar o serviço. Não é uma versão Electron nem um instalador independente do projeto.

## Usar

1. Mantenha `Worklog.exe` na raiz do projeto, junto de `package.json`, `src/` e `scripts/`. Um atalho do Windows pode apontar para esse arquivo; não mova somente o executável.
2. Tenha **Node.js 24.20 ou mais recente da linha 24.x, com npm**, e .NET Framework 4.x do Windows. Não são necessários privilégios de administrador. Se faltar Node compatível, o lançador orienta a instalação pelo site oficial; não instala ferramentas de sistema silenciosamente.
3. Dê dois cliques em **Worklog.exe**. Ele confere dependências, roda `npm ci` quando estiverem ausentes/incompletas ou com versões diferentes do lockfile, compila com `npm run build` quando necessário e inicia com **`npm start`**.
4. O navegador abre quando a verificação de saúde confirmar o serviço desta pasta. A porta segue `PORT` do ambiente ou `.env`, com padrão 3000; se outro programa ocupá-la, uma porta local livre é escolhida. O endereço efetivo aparece no navegador.
5. **Abrir navegador** reabre a mesma URL. Um segundo clique no `.exe` restaura a janela existente, sem duplicar a inicialização. Fechar a janela pelo X a oculta na bandeja; o serviço continua aberto. Na bandeja, use **Mostrar lançador**, **Abrir navegador** ou **Sair**.
6. **Encerrar e sair** solicita fechamento do serviço criado pelo lançador. Se houver gravação ou envio em andamento, o encerramento é recusado: aguarde terminar e tente novamente. O lançador não encerra um serviço que apenas reutilizou.

Ao reutilizar um serviço já aberto por `npm run dev`/`npm start`, não há reinstalação/build. Para atualizar esse serviço, encerre-o no terminal com Ctrl+C e abra o lançador novamente. Salve rascunhos pendentes antes de encerrar seu serviço; fechar o lançador não fecha as abas do navegador.

## Dados e preparação

O banco continua em `data/worklog.sqlite`, e a configuração em `.env`, na mesma pasta. O lançador não importa exemplos, apaga dados, muda credenciais nem envia horas. Somente o backend lê a configuração Redmine; etapas de instalação/build não recebem as variáveis do arquivo `.env`.

`local/launcher-state.json` registra hashes de fontes e saída para detectar build antigo, alterado ou ausente. `local/launcher-runtime.json` registra porta/PID de um serviço próprio para permitir reutilização; não guarda chave de API nem o token de encerramento. `local/launcher.lock` impede preparação concorrente, e bloqueios de processos já encerrados são recuperados. Um bloqueio inválido é informado, não apagado silenciosamente.

A primeira preparação precisa de Internet se os pacotes não estiverem no cache. Depois, com dependências válidas e build inalterado, a abertura pula essas etapas. `npm ci` usa o lockfile e pode executar scripts das dependências conhecidas do projeto. Não tente atualizar dependências enquanto outro terminal desta pasta usa seus arquivos.

## Problemas e recuperação

| Situação | Comportamento / ação |
| --- | --- |
| Node/npm ausente ou incompatível | Instale Node 24.x compatível com npm e reabra |
| Porta ocupada por outro programa | Usa outra porta, sem encerrar o programa existente |
| Worklog desta pasta já rodando | Abre esse serviço, sem assumir seu controle |
| Instalação/build falhou | Mostra a falha e habilita **Tentar novamente**; confira `local/launcher.log` |
| Arquivo em uso / EPERM | Feche terminais dev/start desta pasta; tente novamente |
| Serviço não ficou pronto em 45s | Interrompe somente a tentativa criada pelo lançador e informa a falha |
| Gravação/envio em andamento | Recusa encerramento para você aguardar a conclusão |
| Fechamento forçado do processo do lançador | O Windows encerra seus descendentes; recibos existentes continuam protegendo contra repetição. Prefira o encerramento normal |
| Aviso do Windows/antivírus | O executável é compilado localmente e não tem assinatura comercial. Não desative proteções; confira origem, código e políticas da máquina |

Instalação tem limite de dez minutos; build, três minutos. Erros não geram repetição automática. Logs ficam somente em `local/`, com rotação/limite de tamanho; revise-os antes de compartilhar porque podem conter caminhos locais ou mensagens operacionais. Não publique `.env`, SQLite ou respostas reais.

## Gerar e verificar

```sh
npm run launcher:build
```

Esse comando usa Node e o compilador C# do .NET Framework instalado no Windows, sem alterar políticas de execução. Gera `Worklog.exe` na raiz, com versão derivada de `package.json`. O binário e arquivos temporários são ignorados pelo Git; o código em `launcher/` e `scripts/` é versionado. Feche o lançador antes de recompilar o próprio `.exe`.

```sh
npm test
npm run launcher:build
npm run launcher:check
```

`launcher:check` cria uma pasta temporária com espaço no nome, fontes públicas, configuração vazia e SQLite fictício. Confere bootstrap nativo, instalação/build iniciais, porta ocupada, identidade da pasta, reutilização sem encerrar o serviço original, encerramento normal, abertura seguinte sem recompilar e persistência de um rascunho fictício. Não usa `.env`, banco ou credenciais da instalação normal. Em falha preserva a pasta para diagnóstico; em sucesso remove somente a pasta que criou. A CI repete esses checks no Windows.

## Fronteiras técnicas

`launcher/WorklogLauncher.cs` fornece janela, bandeja, instância única e um Windows Job Object: processos externos reutilizados não pertencem a esse job. O worker aguarda o sinal do lançador antes de iniciar npm, garantindo que todos os descendentes sejam vinculados ao job. `scripts/launcher-core.mjs` concentra preparação/estado, com IO substituível para testes. npm é chamado pelo seu CLI com o executável Node, sem compor comandos de shell a partir de caminhos.

`GET /api/health` retorna apenas aplicação, versão e identidade opaca da pasta, sem configuração/dados. `POST /api/launcher/shutdown` existe somente para um serviço iniciado com token aleatório do lançador; exige esse token, preserva as barreiras locais/de origem e recusa trabalhos em andamento. O token não aparece no health, navegador, arquivo de estado ou logs do lançador. O fluxo de envio e as proteções de recibos permanecem os mesmos.
