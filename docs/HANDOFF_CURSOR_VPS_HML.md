# Handoff — frente Cursor VPS / HML / legado

Atualizado em 2026-09-24. Complementa `docs/HANDOFF_ATUAL.md` **sem substituir**
os checkpoints do Codex na PR #33. Em conflito operacional, prevalecem segurança,
Regra-Mãe e o documento mestre do programa (PR #33).

## Escopo desta frente

- Gate C: auditoria VPS somente leitura.
- Preparação Gates D–F (sem execução).
- Descoberta somente leitura do backup legado (Onda 25).
- **Não** editar `codex/comercial-360` nem fazer push nela.
- **Não** merge, **não** alterar 3080, **não** aplicar migrations 016+.

## Estado

| Item | Estado |
|---|---|
| Branch | `cursor/vps-hml-gate-c-legado-392b` |
| Base | `origin/main` @ `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888` |
| PR Codex #33 | draft; HEAD consultar GitHub (não fixar SHA antigo) |
| Gate C | **PARCIAL** — bloco de leitura pronto; Web Console/MCP VPS não operáveis nesta sessão Cloud |
| Gates D–F | **PREPARADOS / NÃO EXECUTADOS** |
| 3080 | permanece R07B / `dev_headers` (não tocada) |
| Canário | não iniciado |
| Legado HD | ferramenta pronta; inventário real pendente (HD não montado no cloud) |

## Documentos

- `docs/GATE_C_CARTAO_OPERADOR.md` / `docs/GATE_C_AUDITORIA_VPS_SOMENTE_LEITURA.md`
- `docs/GATE_D_SMOKE_AUTH_CHECKLIST.md`
- `docs/GATE_E_MIGRATIONS_CARTAO.md`
- `docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md`
- `docs/vps/migrations-candidatas-comercial360.txt`
- `scripts/vps/gate-c-read-only.sh` / `score-gate-c.sh` / `gate-d-f-precheck.sh`
- `scripts/vps/rollback-dry-run-check.sh`
- Legado: inventário + mapeamento + fixture sintética

## Próxima ação concreta

1. **Bloqueio:** saída Web Console (`GATE_C_CARTAO_OPERADOR.md`) → `score-gate-c.sh`.
2. Codex: confirmar EXPECTED_RUNTIME + `supabase_user` (contrato §7).
3. Após C APROVADO: dry-run rollback; precheck 016–024; só então autorização D/E.
4. Inventário HD legado fora deste cloud.
