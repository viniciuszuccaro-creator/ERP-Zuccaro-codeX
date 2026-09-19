# ERP-RUNTIME-08A — Especificação de Condição de Pagamento

**Base:** `77878395164ef6e41b6eb75bceea8176070af9a8`.
**Escopo:** somente o agregado canônico Condição de Pagamento. Não implementa
Forma/MeioPagamento, recebimento, crédito, Orçamento, Pedido, Estoque ou tela
Comercial 360º.

## Conceito e responsabilidade

Condição de Pagamento informa **quando** o valor de um documento comercial
vence: à vista, 28 dias, 28/35/42 ou entrada mais parcelas. Ela não informa
**como** o cliente paga: PIX, boleto, cartão, dinheiro e gateways são meios de
pagamento futuros. Ela não materializa valor monetário, título nem Conta a
Receber.

Um futuro Orçamento/Pedido calculará valores em centavos e aplicará uma regra
de resíduo explícita no próprio documento. O agregado R08 só conserva a regra
de prazo e proporção; o documento deve snapshotar `id`, `codigo`, `nome` e as
parcelas no momento de sua confirmação.

## Ownership, compartilhamento e defaults

- O cabeçalho possui `group_id` e `empresa_id` de origem.
- A dona é vinculada automaticamente. Compartilhamento entre Empresas do mesmo
  Grupo ocorre somente por `condicao_pagamento_empresas`, N:N explícita e
  auditável; não há cópia física para empresas do Grupo.
- `cliente_empresas.condicao_pagamento_id` é nullable e representa apenas uma
  preferência específica da relação Cliente×Empresa. Nunca vai para o Cliente
  master.
- Cada Empresa pode ter no máximo uma Condição ativa como padrão. O padrão fica
  no vínculo N:N, como TabelaPreco.
- A futura resolução fail-closed é: específica ativa/autorizada → padrão ativo
  da Empresa → `null` (sem condição). Não existe fallback implícito de Grupo.

## Modelo relacional e regras de parcelas

`condicoes_pagamento` contém UUID, `group_id`, Empresa de origem, código
reservado pelo backend, nome, descrição opcional, ativo, campos de legado,
actors e timestamps. Não haverá vigência: não há requisito comprovado e não se
adiciona campo por simetria.

`condicao_pagamento_parcelas` é uma tabela filha, não JSON opaco. Cada parcela
tem `ordem` positiva, `dias` maior ou igual a zero e `percentual` decimal
positivo com até seis casas. A identidade permanente é
`(condicao_pagamento_id, ordem)`. A regra de soma é exata: parcelas ativas
devem somar `100.000000`; a aplicação não arredonda nem corrige a soma. Não há
condição ativa sem ao menos uma parcela ativa válida.

Exemplos válidos:

| Condição | Parcelas |
|---|---|
| À vista | ordem 1, dia 0, 100% |
| 28 dias | ordem 1, dia 28, 100% |
| 28/35/42 | ordens 1/2/3, dias 28/35/42, 33.333333/33.333333/33.333334% |
| Entrada + parcelas | ordem 1, dia 0, 30%; ordens posteriores com percentuais explícitos que completem 100% |

Alterações de parcelas são substituição atômica do conjunto inteiro. O serviço
valida o payload completo antes de abrir a transação e o repositório substitui
as linhas na mesma transação; em falha não existe estado parcial.

## Segurança, concorrência e ciclo de vida

As tabelas novas terão FKs tenant-aware, triggers para integridade Grupo/Empresa,
`ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` e revogação padrão. Sem
contexto, a política falha fechada. Toda operação exige actor, Grupo, Empresa e
permissão `cadastros.condicao_pagamento.*`; backend e banco são as barreiras.

Soft delete preserva a identidade; restore não altera código. Não se pode
inativar condição padrão ou referenciada por ClienteEmpresa ativa. Concorrência
de código é resolvida por `reserve_entity_codigo`; padrão é protegido por índice
único parcial e lock transacional; parcelas têm PK/unique por ordem e troca
atômica.

Cada mutação e sua auditoria pertencem à mesma transação: create, update,
inactivate, restore, link/unlink/restore Empresa, padrão, troca de parcelas e
set/clear do default ClienteEmpresa. Snapshots mínimos excluem PII, dados
bancários, títulos e valores de crédito.

## Checkpoint

```text
RUNTIME-08A SPEC CLOSED
OWNERSHIP=group_id + empresa_id de origem
SHARING=N:N explícito condicao_pagamento_empresas; dona auto-vinculada
DEFAULT CLIENTEEMPRESA=condicao_pagamento_id nullable, validada por Empresa
PADRAO EMPRESA=um vínculo ativo por Empresa
PARCELAS=tabela filha; ordem/dias/percentual; substituição atômica
SUM RULE=parcelas ativas somam exatamente 100.000000, sem arredondamento implícito
FALLBACK=específica ativa/autorizada -> padrão Empresa -> sem condição
SOFT DELETE=preserva identidade; bloqueia condição em uso/padrão
RLS=ENABLE + FORCE fail-closed, FKs/triggers tenant-aware
RBAC=cadastros.condicao_pagamento.* fail-closed no backend
AUDIT=mutação e auditoria na mesma transação, snapshots mínimos
BLOCKERS=NENHUM
```
