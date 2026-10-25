# Publicação da demo no GitHub Pages

Destino deste repositório: **https://cristianworth.github.io/worklog-for-redmine/**. O código é público sob MIT; somente a demo estática é hospedada. O serviço Node, configuração privada e SQLite continuam locais.

## Caminhos e artefato

| Comando | Saída / endereço de prévia |
| --- | --- |
| `npm run build` | Aplicação local em `dist/`; não publicar no Pages |
| `npm run build:demo` | Demo em `dist-demo/`, base `/` |
| `npm run preview:demo` | `http://127.0.0.1:4173/` |
| `npm run build:pages` | Demo em `dist-demo/`, base `/worklog-for-redmine/` |
| `npm run preview:pages` | `http://127.0.0.1:4174/worklog-for-redmine/` |

Os dois builds de demo compartilham a saída: a última compilação substitui a anterior. Use a prévia correspondente. A auditoria recebe a base esperada: `npm run check:demo -- /worklog-for-redmine/` para Pages e `npm run check:demo` para raiz.

O app não usa rotas de página: o período fica no estado/preferência do navegador, e a marca aponta para a base do build. Não é necessário um fallback de SPA/404 para datas. A CSP bloqueia conexões operacionais e envio de formulários; o navegador continua carregando os arquivos estáticos da página. Nenhum arquivo `.env`, banco ou backend é necessário para compilar/publicar.

## Configuração inicial

1. Em **Settings → Pages**, configure **Source: GitHub Actions** para este repositório público. A configuração equivalente na API é `build_type: workflow`.
2. Mantenha `.github/workflows/verify.yml` na branch `master`. O workflow roda testes, build local, demo na raiz, demo no subdiretório e as auditorias.
3. Apenas se todos os checks passarem, o job de verificação envia **somente `dist-demo/`** como artefato `github-pages`.
4. O job `deploy` depende da verificação, usa o ambiente `github-pages` e publica com as ações oficiais. Só ele recebe `pages: write` e `id-token: write`; o build tem `contents: read`. Não há chave de deploy pessoal nos arquivos.
5. PRs e forks verificam sem publicar no destino original. Push em `master` e execução manual nessa branch podem publicar. Deploys são serializados, sem cancelar uma publicação já iniciada.

Para um fork, altere a base nos scripts, o destino em `src/client/app-links.ts`, os links da documentação e a condição de repositório no workflow. Configure o Pages do novo repositório. Não reutilize o endereço original como seu destino.

## Conferência de uma entrega

- Confira o SHA no workflow, o resultado de cada check, o job de deploy e o endereço retornado pelo GitHub.
- Abra a URL pública em uma visita nova; verifique a versão do rodapé e os três dias de exemplos.
- Edite/salve, simule após revisão, recarregue, confira recibo e restaure exemplos. Verifique teclado e uma tela menor.
- Abra diretamente `/worklog-for-redmine/` e recarregue. Confira que a marca preserva esse caminho e que JS/CSS carregam sem erro.
- Acessar ou digitar `/api/...` no mesmo host não pode alcançar o serviço local. O artefato não contém esse transporte; a demo não precisa de servidor de aplicação.

Esses passos são conferência técnica; uma avaliação independente por um recrutador/visitante é retorno de uso, não algo que um teste automatizado comprove.

## Recuperação e rollback

Uma falha nos checks não publica uma nova versão. Se o deploy falhar, consulte o job e o estado do Pages antes de anunciar o endereço como disponível. Não troque para publicar a raiz do repositório nem envie `dist/` como atalho.

Para corrigir uma regressão publicada, faça uma correção ou `git revert` coeso em `master`, revise o changelog/versão e deixe a CI republicar. Não force push nem mova tags. Dados da demo pertencem ao visitante: rollback do código não restaura armazenamento apagado e uma versão mais antiga pode recusar um schema novo. Preserve compatibilidade ou mostre recuperação explícita; não apague dados silenciosamente.

Para problemas de recursos 404, confira primeiro a base, a última compilação e o caminho do artefato. Para site ainda indisponível, confira **Settings → Pages**, o ambiente `github-pages`, o commit publicado e o job de deploy. A prévia Vite é uma ferramenta local, não o servidor da publicação.

## Referências oficiais

- [Vite: deploy estático e base no GitHub Pages](https://vite.dev/guide/static-deploy)
- [GitHub: fonte de publicação](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub: ações de deploy e permissões](https://github.com/actions/deploy-pages)
