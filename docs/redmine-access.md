# Conferir acesso ao Redmine

## O que foi observado

Em 22/10/2026, o endereço privado configurado na planilha resolveu por DNS. Consultas sem credenciais a `/login` e `/users/current.json` falharam no Node com `CERT_HAS_EXPIRED`, tanto na configuração normal quanto com os certificados confiáveis do Windows. O Python também encontrou uma falha de confiança na cadeia. O Node é o transporte da aplicação; o certificado vencido é a barreira confirmada para ele.

Cristian confirmou usar o mesmo endereço e autorizou usar esse servidor apesar do certificado inválido. Com exceção restrita e os caminhos completos configurados na planilha (incluindo o subcaminho da instalação), o formulário de login respondeu **200** e `/users/current.json` respondeu **401 em JSON**, sem credenciais. Isso confirma que chegamos à autenticação; ainda não confirma aceitação de uma chave específica ou permissões da conta. Nenhuma credencial, cookie, hora ou mudança de status foi enviada.

## Exceção local autorizada

`REDMINE_ALLOW_INVALID_CERTIFICATE=true` permite consultar somente a origem HTTPS configurada em `REDMINE_URL`, incluindo a porta. O padrão do projeto e do exemplo é `false`. Nenhuma variável global de TLS, agente global ou outro destino é alterado. O transporte não segue redirecionamentos e o painel de acesso informa a exceção ativa.

A exceção aceita erros de cadeia de confiança, nome e datas do certificado; não consegue isolar apenas o vencimento. HTTPS continua criptografado, mas sem a autenticação do servidor pelo certificado há risco de interceptação. A decisão foi aceita por Cristian para o endereço privado conhecido; não é uma recomendação para outros servidores.

O arquivo `.env` local foi preparado com o endereço completo da planilha e a exceção autorizada, sem chave ou senha. Ele está ignorado pelo Git. Desative a exceção quando o certificado for corrigido.

## Sequência de validação

1. Preferir um certificado válido. Para o servidor privado conhecido, a exceção autorizada já está preparada no `.env` local. Instalar uma CA confiável não corrige validade vencida ou nome incompatível.
2. Em uma nova instalação, copiar `.env.example` para `.env` e preencher `REDMINE_URL` com o subcaminho completo da instalação. Nunca sobrescrever a configuração local existente. Salvar rascunhos e reiniciar a aplicação.
3. Em **Configurações**, usar **Testar acesso à API**. O teste consulta somente a conta atual. Se indicar autenticação, obter a chave de acesso à API em **Minha conta** no Redmine, quando disponível, preencher `REDMINE_API_KEY` localmente e reiniciar. Não enviar senha/chave pelo chat.
4. Consultar um código de tarefa à qual a conta tem acesso. O aplicativo mostra assunto, status e projeto; não registra horas e não altera a observação. Uma resposta 404 pode representar recurso oculto para a conta.

Se a seção de chave não estiver disponível, conferir com a administração se a API REST está habilitada. Não concluir que a API é inexistente a partir de um problema de certificado ou de uma sessão de navegador recusada. Caso seja necessário manter autenticação por formulário, caracterizar e implementar esse transporte em um recorte próprio, preservando o fluxo legado.

## Contrato portado e fontes

Leitura estática do VBA confirmou dois caminhos: `ConsultarIssueRedmine` faz GET JSON com `X-Redmine-API-Key`, enquanto `ObtenhaStatusIssueGet` lê o formulário HTML usando cookie. `Logar` usa token de formulário e sessão; a chamada para obter chave de API está comentada. O recorte P2 implementa apenas a consulta JSON, validando o corpo em vez de extrair campos por posição textual. Retorna assunto (o legado chama de descrição), status e projeto; não carrega a descrição longa ou outros dados desnecessários.

- [Autenticação REST do Redmine](https://www.redmine.org/projects/redmine/wiki/Rest_api#Authentication)
- [Flags de certificado do WinHTTP](https://learn.microsoft.com/en-us/windows/win32/winhttp/option-flags#winhttp_option_security_flags)
- [Consulta de tarefa](https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Showing-an-issue)

O padrão documentado suporta chave no cabeçalho. A compatibilidade e as permissões desta instância permanecem pendentes. Os testes usam somente respostas fictícias, inclusive redirecionamentos, falhas de certificado e autenticação.
