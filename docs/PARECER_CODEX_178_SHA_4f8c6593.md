# Parecer Cursor sobre tip Codex Comercial #178

**Canal:** documental (`docs/`, `STATUS_DO_PROJETO.md`, `HANDOFF_ATUAL.md`) — comentários de PR indisponíveis ao agente.

## Identidade revisada

| Campo | Valor |
|---|---|
| PR | #178 |
| Branch | `codex/comercial-corrige-parecer-155` |
| **SHA exato** | `4f8c6593506f681689e021226ab024f57c7aede9` |
| CI observado | frontend + backend SUCCESS |
| Estado | ainda **candidata** (não FINAL) |

## Parecer (Cursor / Expedição #199)

1. **Migrations 025–035** no tip Codex são a reserva comercial correta. Expedição #199 usa **`036_expedicao_entregas_romaneios.sql`** — composição PGlite 024→025–035→036 validada sem colisão de numeração.
2. **Tip-port Pedido/estoque:** **não autorizado** enquanto #178 for candidata. Contrato mínimo permanece em `docs/EXPEDICAO_PORTAS_PEDIDO_ESTOQUE.md` (portas `reserved` / `applied` / `failed`).
3. **Arquivos compartilhados** (`app.ts`, `router.ts`, `httpApiClient.js`): Cursor só toca superfície Expedição; não reverte trabalho Comercial neste SHA.
4. **Integração:** stack Expedição tip #199 pronta para composição **após** FINAL do #178 + tip-port explícito dos adapters; sem merge/VPS neste parecer.
5. **Risco residual:** tip Cursor comercial (`cursor/comercial360-*-tip-392b`) ainda não contém 025–028/033–035 no tree observado — a composição oficial deve usar o tip Codex `4f8c6593` (ou sucessor) como fonte das migs 025–035.

## Conclusão

**COMPATÍVEL com Expedição #199 sob contrato reserved + mig 036.**
**NÃO** tip-port. **NÃO** merge. Aguardar declaração FINAL do Codex no #178.
