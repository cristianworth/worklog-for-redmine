# Documentação

Comece pelo [README do projeto](../README.md) para experimentar a demo ou instalar a aplicação local. A interface é em português; o README e o guia de contribuição usam inglês para facilitar a entrada de colaboradores.

## Guias atuais

| Preciso de… | Documento |
| --- | --- |
| Configurar e usar minha instalação | [Uso local](local-usage.md) |
| Abrir no Windows com dois cliques | [Lançador Worklog.exe](windows-launcher.md) |
| Entender os módulos e as decisões técnicas | [Arquitetura](architecture.md) |
| Publicar, conferir ou recuperar a demo | [GitHub Pages](deployment.md) |
| Entender isolamento, armazenamento e simulação | [Contrato de acesso e demo](data-access.md) |
| Revisar regras de criação/recuperação | [Envio individual](individual-submission.md) e [lotes](batch-submission.md) |
| Configurar cópias de dias recorrentes | [Modelo do dia](day-template.md) |
| Entender recibos e conferência | [Situação dos apontamentos](appropriation-status-plan.md) |
| Contribuir ou relatar um problema | [Contributing](../CONTRIBUTING.md) e [segurança](../SECURITY.md) |

## Status e referências históricas

[Roadmap](../ROADMAP.md) registra prioridades; [changelog](../CHANGELOG.md) registra entregas. [Decisões](project-decisions.md) e [plano](development-plan.md) dão contexto e limites das evidências.

[Investigação do legado](legacy-workflow.md), [exemplos antigos de comportamento](behavior-specification.md) e partes datadas de [acesso ao Redmine](redmine-access.md) preservam a investigação original. Não são requisitos novos: o catálogo por projeto foi substituído pelo catálogo único na v0.4.0, e movimentar status foi cancelado. Números de testes em seções históricas descrevem aquela execução; rode `npm test` para verificar o estado atual.

Arquivos em `docs/handoffs/` são locais e ignorados. Nenhum guia público depende deles, da planilha ou de registros privados para instalar, testar ou publicar a demo.
