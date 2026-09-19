# ERP-RUNTIME-08B — Condição de Pagamento canônica

O R08B implementa Condição de Pagamento como cadastro de prazo e parcelas, sem FormaPagamento, títulos, ContaReceber, Orçamento, Pedido ou frontend HTTP.

## Contrato

- ownership `group_id` + Empresa de origem;
- uso por Empresa somente por vínculo N:N ativo;
- padrão único ativo por Empresa;
- referência nullable somente em `cliente_empresas`;
- resolução futura: específica autorizada, padrão da Empresa, ou sem condição;
- parcelas relacionais ordenadas, dias não negativos e percentuais que somam exatamente `100.000000`;
- troca de parcelas atômica e soft delete/restore sem troca de identidade.

## Segurança

`014_condicoes_pagamento.sql` adiciona FKs e triggers tenant-aware, RLS + FORCE e revogação de acesso público. A API exige contexto Grupo/Empresa e RBAC fail-closed `cadastros.condicao_pagamento.*`. Create, update, inactivate, restore, vínculo, padrão e parcelas gravam auditoria na mesma transação.

`CondicaoPagamento.frontendHttp=false`; ela não foi incluída em `HTTP_PILOT_ENTITIES`. O Cliente master bloqueia o campo; a validação do vínculo Cliente×Empresa revalida condição ativa e autorizada.

## Validação local

O servidor passou typecheck, build e a suíte local (74 testes aprovados; uma integração externa é opcional quando `DATABASE_URL` não existe). O seed sintético é idempotente e inclui A/A2/B, compartilhamento, padrão, à vista e 28 dias. Isto não substitui o gate PostgreSQL real da VPS.
