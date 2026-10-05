# Parecer Cursor — PR #209 @ `bb3ef069`

**SHA revisado:** `bb3ef069d06b494c01b681487dcf67016a69c475`  
**Branch:** `codex/cliente360-top-produtos-20261004`  
**Data:** 2026-10-05  
**Revisor:** Cursor (revisão operacional, sem tip-port)

## Escopo

Central Cliente 360 — bloco `produtosMaisComprados` agregando quantidades de Pedidos **FINALIZADOS** por `produto_id` + `unidade_id`, além da paginação do bloco de pedidos.

## Checklist solicitado

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Agregação além da paginação | **OK** | `topProducts` dedicado (SQL/in-memory); teste com `pedidos_limit=1` + 205 pedidos → total `20.500000` |
| Estados incluídos | **OK (explícito)** | Somente `status='FINALIZADO'` + `ativo=true` (+ item `ativo`). EM_ABERTO/CANCELADO/intermediários fora. Follow-up Cursor cobre exclusão explícita. |
| Quantidades decimais | **OK + reforço** | Memória em micros 6 casas; coluna `NUMERIC(18,6)`. PG agora normaliza com `to_char(..., FM…000000)` para paridade com memória. |
| Produto/unidade | **OK** | Chave composta `produto_id:unidade_id`; ORDER estável. |
| RBAC | **OK** | `PedidoService.topProducts` → `prepare(..., 'visualizar')` → `Comercial.pedido.visualizar`. Central 360 preserva máscara PII existente. |
| Isolamento empresarial | **OK** | Filtro `group_id` + `empresa_id` + `cliente_empresa_id`; teste A/B vazio na outra empresa; PG e2e `other` scope → `[]`. |

## Achados

1. **Não bloqueante / corrigido nesta revisão:** `SUM(i.quantidade)::text` podia omitir zeros à direita (`20.5` vs `20.500000`). Normalizado no repositório PG.
2. **Residual UX (não bloqueia):** UI mostra UUID truncado do produto/unidade, sem código/descrição. Melhoria futura nos Cadastros existentes — sem inventar cadastro paralelo.
3. **Composição:** delta mínimo em `pedidoService` (`topProducts`). Ao integrar com #207 / margem / à vista, preservar este método sem sobrescrever alçadas Cursor (#205/#206).

## Veredito

**APPROVED com follow-up Cursor** no HEAD desta revisão (normalização decimal + teste de estados). CI do SHA original #209 já estava SUCCESS; revalidar CI deste tip.

## Fora de escopo

Merge em main, VPS, tip-port, Auth, publisher externo, saldo de abertura.
