# Modelo do dia — P5

## Uso

1. Abra **Modelo do dia** e cadastre linhas recorrentes: tarefa, duração, atividade e observação. Saia do código da tarefa para consultar seu projeto e escolher a atividade por nome/código. Campos podem ficar vazios para completar no dia; duração aceita `30`/`030` → `00:30`, `130` → `01:30` ou `HH:MM`.
2. **Salvar modelo** grava somente a configuração local. O modelo começa vazio e não importa valores da planilha. Até 100 linhas; salvar sem linhas desativa o preenchimento.
3. Em um dia ainda não iniciado, use **Criar dia com modelo**. As linhas recebem identificadores novos e ficam com alterações não salvas. Ajuste os dados e use **Salvar rascunhos** normalmente.
4. **Adicionar linha / Adicionar primeira linha** continua avulso. Alterar o período não cria lançamentos nem aplica modelos em todos os dias. Salvar rascunhos continua separado de enviar ao Redmine.

O modelo só se aplica a um dia vazio, sem revisão salva e sem alterações locais. Depois de aplicado, não se aplica novamente; remover todas as linhas também não o reaplica. Dias já salvos, inclusive vazios, permanecem preservados. Alterar o modelo não reescreve cópias anteriores; atividades continuam resolvidas pelo catálogo e projeto ao consultar/preparar o envio.

Fechar o painel preserva edições locais enquanto a página estiver aberta; a saída da página avisa sobre alterações não salvas. Conflitos entre abas preservam as edições: copie o que precisar, descarte e recarregue o modelo. Se outra aba salvar um dia antes do seu rascunho criado pelo modelo, a revisão existente impede sobrescrevê-lo.

## Persistência e referência

`day_template` mantém uma configuração com revisão e linhas no mesmo SQLite. Leituras e salvamentos do modelo não escrevem dias, recibos ou catálogo, nem consultam/enviam ao Redmine. `GET/PUT /api/day-template` são locais, com validação e conflito de revisão. As linhas copiadas usam o salvamento existente; o modelo não leva datas, IDs ou estados de apropriação.

`ObtenhaModeloDeApropriacao` foi conferida diretamente no VBA privado, sem executar macros. A rotina copia o bloco da aba de modelo para a planilha ativa e fixa os valores da data. A aplicação preserva a ideia de iniciar um dia com uma cópia independente, com data explícita do calendário e proteção adicional para dias existentes. Não há agendamento, modelos múltiplos ou regras por dia da semana nesta entrega.

## Verificação

203 testes em 14 arquivos e build aprovados. Casos novos: validação, campos incompletos, IDs novos, aplicação única, dia salvo vazio, edição manual, mudança de período sem preenchimento, persistência após reabrir, banco antigo, revisão concorrente e API local sem requisições remotas. Interface conferida com dados fictícios nos dias 22–24/10; os dias 19–21/10 do banco de uso e os recibos foram preservados.

## v0.2.0 — preenchimento atualizado

Modelo e dias usam a mesma seleção de atividades por projeto, preservando textos antigos sem correspondência e explicando a ausência de cadastro. A consulta no modelo usa o mesmo cache e descarte de respostas antigas; salvar mantém o contexto consultado. A duração abreviada é interpretada também no salvamento antes do blur, sem alterar o armazenamento em minutos. 242 testes/17 arquivos e compilação aprovados; ver [changelog](../CHANGELOG.md).
