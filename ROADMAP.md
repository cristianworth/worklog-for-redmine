# Roadmap — Worklog for Redmine

Atualizado em 25/10/2026. Versão atual: **v0.4.0**. P7-A implementado sem nova versão; demonstração pública ainda pendente. O [changelog](CHANGELOG.md) preserva o histórico; [decisões e aprendizados](docs/project-decisions.md) orientam as próximas implementações.

## Estado atual validado

- **Um catálogo único:** o banco de uso contém 15 atividades, com 15 nomes/códigos únicos e nenhuma cópia por projeto. Os antigos 60 vínculos já foram consolidados com backup; não repetir a migração ou repovoar o banco.
- Dias e modelo permitem escolher a atividade antes de informar o card. O projeto continua sendo informação da tarefa e parte da validação remota, sem duplicar o cadastro local.
- O mesmo código de atividade foi aceito em dois projetos. Além do readback técnico, Cristian confirmou visualmente o tipo de atividade dos dois lançamentos. O teste não comparou códigos antigo/atual nem validou todas as opções em todos os projetos.
- Rascunhos, modelo, lotes e recibos anteriores foram preservados. A v0.4.0 foi conferida com 247 testes/17 arquivos, compilação e interface fictícia. Nenhum novo envio real está pendente de execução.

## Marcos entregues

| Versão / etapa | Resultado |
| --- | --- |
| v0.0.0 / P0–P4.2 | Rascunhos em SQLite, período livre, consulta com cache, envios individuais/lotes, recibos e validação integral antes do envio |
| v0.1.0 / P5 | Modelo configurável, salvamento separado e cópia independente para dias novos |
| v0.2.0 / P6.1–P6.3 | Seleção de atividades e duração abreviada; o cadastro por projeto dessa versão foi substituído na v0.4.0 |
| v0.3.0 | Recolher/expandir tarefas por dia e publicação do código sob MIT |
| v0.4.0 / P6.4 | Catálogo único, seleção antes do card, migração com backup e conferência real em dois projetos |

## Próxima implementação — P7: preparar a demo

**Objetivo:** deixar um visitante experimentar o fluxo pelo navegador com dados fictícios, sem configurar chave ou instalar o backend. Esta etapa prepara e confere o build estático; hospedagem fica no P8.

| Chunk | Trabalho | Critério de conclusão |
| --- | --- | --- |
| A — Acesso aos dados e isolamento | Mapear as operações de tarefas, catálogo, dias, modelo e envios. Criar um ponto de acesso substituível para usar HTTP no modo local e simulação na demo, reaproveitando a interface e as regras | A demo não consulta a API local nem o Redmine, não lê SQLite ou configuração privada e não exige credenciais. O modo local conserva seus contratos |
| B — Exemplos e persistência | Criar poucos dias/cards/atividades fictícios, um catálogo único e um modelo de exemplo. Persistir as alterações somente no navegador do visitante, com identificação própria dos dados da demo | Salvar continua explícito; recarregar recupera os dados da demo. Nenhum exemplo vem da planilha ou do banco de uso; não copiar os códigos reais das 15 atividades |
| C — Experiência completa | Identificar permanentemente o modo demonstração, oferecer envio claramente simulado e restaurar exemplos. Preservar período livre, atividade antes do card, duração abreviada, modelo e dias recolhíveis | Visitante consegue editar, salvar e revisar um dia ou várias datas. Resultados são identificados como simulados; restaurar afeta somente a demo daquele navegador |
| D — Revisão integrada | Conferir instalação/build sem chave, persistência, restauração, tarefa inválida bloqueando o lote inteiro, recibos simulados e ausência de dados privados | Vitest para as regras/fronteiras relevantes e conferência manual do fluxo. Build estático funciona para visitante novo, sem chamadas aos serviços reais |

**Ordem:** A → B → C → D. Manter o catálogo simples; não reintroduzir cópias por projeto, outro framework ou uma aplicação duplicada para viabilizar a demo. Testes reais anteriores não devem ser repetidos nessa etapa.

**A implementado em 25/10/2026:** todos os acessos da interface passam pelo contrato substituível. O build separado da demo não carrega `.env`, adaptador HTTP, backend ou banco de uso. A simulação mínima mantém catálogo/dias/modelo em memória, consulta somente a tarefa fictícia 9001 e recusa explicitamente operações de envio ainda indisponíveis, sem fallback real. 316 testes/22 arquivos, builds local/demo e conferências manuais fictícias passaram. [Contratos, evidências e limites](docs/data-access.md). Exemplos persistidos, fluxo completo simulado e restauração permanecem em B/C/D; próxima implementação é B.

## P8 — Publicar e conferir a demo

O repositório [cristianworth/worklog-for-redmine](https://github.com/cristianworth/worklog-for-redmine) e a licença MIT já estão publicados. Essa parte do P8 está concluída; falta o site demonstrativo.

Direção discutida em 25/10/2026: foco em recrutadores/portfólio, com endereço `github.io` suficiente para Cristian. GitHub Pages é a recomendação atual; caminhos de publicação, workflow e publicação continuam pendentes de P8.

| Chunk | Trabalho | Critério de conclusão |
| --- | --- | --- |
| A — Destino e preparação | Definir hospedagem estática/endereço e configurar os caminhos dos arquivos. Revisar o build da demo para configuração, dados e referências privadas | Artefato distribuível contém somente interface, regras e exemplos fictícios; destino definido sem expor o backend local |
| B — Publicação | Publicar o build do P7 no destino definido e incluir o link no README e no atalho da aplicação | Outra pessoa abre a demo pelo link, sem instalar Node ou informar credenciais |
| C — Conferência externa | Executar o fluxo fictício em uma sessão nova, incluindo recarga/restauração e tela menor | Site publicado funciona e permanece isolado; versão, changelog e instruções refletem a entrega |

## Decisões e limites que permanecem

- **P5.1 — Movimentar status: cancelado.** O envio mantém o status do card; não criar uma etapa equivalente.
- Salvar rascunhos e enviar ao Redmine continuam ações separadas. Intervalo livre, sem total semanal ou cópia automática entre dias.
- Importação ampla da planilha, agendamento do modelo, múltiplos modelos e construtor genérico de campos ficam fora do escopo atual. Novos tipos de campo devem partir de uma necessidade concreta.
- Não implementar exceções de atividade por projeto sem uma incompatibilidade demonstrada e uma decisão específica. Quantidade de projetos não justifica duplicar a lista.
- Preservar os dias 19–21/10 do banco de uso. Os testes reais anteriores estão concluídos e suas autorizações consumidas; eventual exclusão manual não autoriza reenvio automático.
- Banco/credenciais compartilhados na internet, autenticação multiusuário e hospedagem do backend real são outro escopo. A demo será estática e isolada.
