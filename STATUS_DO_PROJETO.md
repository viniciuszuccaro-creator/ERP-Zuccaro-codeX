

## Onda 7 — reserva de estoque fail-closed (2026-09-28)

- Causa: o fluxo existente de aprovação acumulava falhas de reserva por item, mas prosseguia para crédito, contas, OP e status Aprovado, permitindo reserva parcial.
- Correção: aprovarPedidoCompleto interrompe os efeitos downstream quando qualquer reserva falha e compensa somente movimentos de reserva criados naquela tentativa; expõe as compensações e o bloqueio no resultado. Não cria módulo, entidade, migration ou endpoint paralelo.
- Escopo: Grupo/Empresa continuam aplicados pelos helpers existentes; movimentos e compensações usam auditoria existente. Sem VPS, dado real, migration, importação ou ativação de canal.
- Validação: testes dirigidos Pedido/Estoque 18 PASS, 0 FAIL; audit:baseline PASS; git diff --check PASS. npm run lint não executou: binário eslint ausente no worktree (infraestrutura local), sem alteração de configuração para mascarar o erro.
- Commit: consultar PR do lote; CI é pendente e não é inferida localmente.
