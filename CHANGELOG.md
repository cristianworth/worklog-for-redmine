# Changelog — Worklog for Redmine

Histórico das versões locais. Criado em 23/10/2026 com a base anterior ao modelo registrada retrospectivamente como v0.0.0. Nenhuma dessas versões foi publicada no GitHub ou como demo pública.

## Regras de versionamento

- Usar `MAJOR.MINOR.PATCH`, começando com `0.x.y` durante a evolução inicial. Uma entrega funcional nova incrementa `MINOR`; correções da mesma entrega incrementam `PATCH` quando houver uma nova versão.
- Um commit não exige uma nova versão. Consolidar mudanças relacionadas na mesma entrega; não incrementar o número por manutenção documental isolada.
- Registrar somente alterações entregues nas versões datadas. Ideias e tarefas futuras ficam em [ROADMAP.md](ROADMAP.md), sem apresentar funcionalidades planejadas como existentes.
- `package.json` e as duas versões raiz de `package-lock.json` devem coincidir com a versão atual. A interface lê a versão do manifest durante a compilação; recompilar depois de alterá-la.
- Tags locais `vX.Y.Z` identificam a revisão de cada versão. Não mover tags já criadas nem reescrever histórico. A tag retrospectiva v0.0.0 aponta para a última revisão anterior ao P5; os manifests antigos continuam como estavam.
- Antes de cada commit/merge, ler este arquivo e seguir a regra de aprovação de Cristian. A criação deste histórico, da v0.0.0 e da v0.1.0 está explicitamente autorizada no pedido de 23/10/2026; alterações futuras de versão devem seguir a autorização da entrega.
- Nunca incluir credenciais, planilhas privadas, bancos, backups ou dados reais nos registros, tags e arquivos distribuídos.

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
