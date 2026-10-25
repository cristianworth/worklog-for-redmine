# Exemplos históricos de comportamento

## Situação atual

Em 21/10/2026, Cristian dispensou BDD, Cucumber e a obrigação de formalizar funcionalidades em cenários. Este documento preserva exemplos de planejamento; não é um processo obrigatório nem uma suíte executável.

O primeiro recorte usa Vitest para totalização (`src/shared/worklogs.test.ts`) e persistência (`src/server/storage.test.ts`). A interface será conferida manualmente. Playwright fica para depois, se trouxer benefício.

**Referência histórica, não contrato atual.** Os blocos abaixo preservam hipóteses de planejamento de 21/10/2026. B04 (códigos por projeto) foi substituído pelo catálogo único na v0.4.0; B10 (movimentar status) foi cancelado. Validação, parada de lotes e reconciliação já foram implementadas depois dessa investigação. Use os [guias atuais](README.md), o código e a suíte como fonte do comportamento entregue.

Todos os números, nomes de projetos e respostas usados aqui são fictícios. Não representam a configuração do servidor privado.

## Vocabulário

- **Apontamento / worklog:** registro local de data, tarefa, duração, atividade e comentário.
- **Rascunho:** apontamento salvo localmente, ainda não confirmado no Redmine.
- **Tarefa / issue:** item existente no Redmine ao qual se atribuem horas.
- **Atividade:** categoria do trabalho, com identificador válido para o projeto da tarefa.
- **Confirmado:** criação reconhecida pelo contrato do serviço; manter o identificador remoto quando fornecido.
- **Resultado incerto:** a criação pode ter ocorrido, mas a resposta não permite confirmá-la.

## B01 — Salvar e recuperar rascunhos

Origem: adaptação necessária do armazenamento que a planilha oferece.

```gherkin
Dado um apontamento de 01:30 para uma tarefa e uma data
Quando eu salvar e reabrir a aplicação
Então devo encontrar o mesmo apontamento com os dados preservados
E ele deve continuar identificado como rascunho
```

## B02 — Totalizar o dia sem arredondamento indevido

Origem: equivalência funcional com a soma de durações do legado; modelo interno em minutos proposto.

```gherkin
Dado um dia com apontamentos de 01:30 e 00:45
Quando eu consultar o total diário
Então devo ver 02:15
```

## B03 — Identificar dados inválidos antes do envio

Origem: legado valida dados, mas suas condições exatas ainda precisam de caracterização.

```gherkin
Dado um apontamento sem tarefa ou com duração inválida
Quando eu solicitar a apropriação
Então devo ver quais campos impedem o envio
E nenhuma criação deve ser solicitada ao Redmine para esse apontamento
```

Validar com Cristian quais campos são obrigatórios, incluindo comentário, e os limites de duração. Não transformar erro acidental do VBA em regra de negócio.

## B04 — Resolver atividade no projeto correto — substituído

Origem: diferença entre IDs por projeto observada no servidor durante a investigação.

```gherkin
Dado que a atividade "Revisão" usa o código 201 no projeto A e 302 no projeto B
E o apontamento pertence a uma tarefa do projeto B
Quando eu preparar o envio com a atividade "Revisão"
Então devo usar o código 302
```

O primeiro cadastro pode ser manual e editável. A descoberta automática de atividades não é requisito para começar a portar o fluxo.

## B05 — Confirmar um apontamento individual

Origem: paridade com apropriação individual, com confirmação mais explícita.

```gherkin
Dado um apontamento válido e uma conexão autenticada
Quando eu enviar o apontamento e o Redmine confirmar sua criação
Então devo vê-lo como confirmado
E devo conseguir distinguir o registro remoto do rascunho local
```

O código de sucesso depende do transporte utilizado: API e formulário HTML têm contratos distintos. Não codificar "HTTP 200 = sucesso" como regra universal.

## B06 — Evitar duplo envio durante a mesma operação

Origem: melhoria pequena proposta para a interface web.

```gherkin
Dado um apontamento com envio em andamento
Quando eu acionar o envio novamente
Então a aplicação não deve iniciar uma segunda criação para esse apontamento
```

## B07 — Preservar resultados parciais de um lote

Origem: legado envia coletivamente, interrompendo ao encontrar falha; a interface proposta explicita o resultado.

```gherkin
Dado um lote de três apontamentos pendentes
Quando o primeiro for confirmado e o segundo falhar
Então devo ver o primeiro como confirmado e o segundo como falha
E devo ver o terceiro como não enviado se a política validada for interromper o lote
```

A interrupção é o primeiro comportamento candidato por proximidade com o legado. Conferir a atualização local após falha antes de decidir a política final.

## B08 — Não reenviar um apontamento confirmado

Origem: o legado procura ignorar tarefas já apropriadas; persistência e tratamento de falhas precisam ser conferidos.

```gherkin
Dado um apontamento já confirmado no Redmine
Quando eu selecionar novamente um lote que o contém
Então ele não deve gerar outra criação automática
```

## B09 — Tratar uma resposta de criação perdida

Origem: melhoria de confiabilidade proposta, não comportamento já demonstrado no legado.

```gherkin
Dado que a conexão foi interrompida depois de a criação ser solicitada
Quando não houver resposta suficiente para confirmar ou rejeitar o apontamento
Então devo ver que o resultado é incerto
E a aplicação não deve reenviá-lo automaticamente
```

O procedimento de conferência/reconciliação será definido na integração; bloqueio de duplo clique sozinho não resolve esse caso.

## B10 — Separar o apontamento da movimentação de status — cancelado

Origem: ambos existem no legado, mas não devem ser tratados como uma única transação remota.

```gherkin
Dado que as horas foram confirmadas no Redmine
Quando a mudança opcional do status da tarefa falhar
Então as horas devem continuar aparecendo como confirmadas
E devo ver a falha da movimentação sem reenviar as horas
```

## B11 — Consultar uma tarefa sem criar apontamentos

Origem: consulta de descrição/status já identificada nas macros.

```gherkin
Dado o número de uma tarefa existente
Quando eu solicitar sua consulta
Então devo ver a descrição e o status retornados pelo serviço
E nenhuma hora deve ser registrada por essa consulta
```

## Registro de automação

Os blocos acima não são testes executáveis. Os testes reais do primeiro recorte estão nos arquivos indicados no início; o resultado atual deve ser obtido com `npm test`. Regras de envio, inclusive B03, permanecem fora do primeiro recorte. Não realizar gravações reais no Redmine em testes rotineiros.

Atualização de escopo em 23/10/2026: os exemplos antigos de movimentação de status são apenas referência histórica; P5.1 foi cancelado por Cristian. Não implementar alterações de status com base nesses exemplos. Prioridades e critérios atuais no roadmap.
