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
| Gate C | **APROVADO** (2026-09-24 Web Console; ver `GATE_C_RESULTADO_2026-09-24.md`) |
| Gates D–F | PREPARADOS / **NÃO EXECUTADOS** |
| 3080 | R07B `ca0bc5f3` preservada |
| Canário | não iniciado |
| Auth PR #33 | **não** homologado (`dev_headers`) |
| Legado HD | ferramenta pronta; inventário real pendente |

## Próxima ação concreta

1. Preencher `docs/TERMO_AUTORIZACAO_GATES_D_E_F.md` (EXPECTED_RUNTIME / Auth / fatia E).
   Checagem local: `bash scripts/vps/validate-termo-autorizacao.sh` → deve sair de
   `WAITING_SIGNATURE` para `SIGNED_CHECKLIST_OK` (ainda `EXECUTE_DEF=NO`).
2. Sem termo + backup novo: **não** D/E/F.
3. Legado: com HD montado, inventário; mapper sintético cobre carimbo staging,
   chave idempotente e lote com detecção de duplicata (`mapLegadoLoteSintetico`).
4. Opcional: reexecutar `gate-c-read-only.sh` (meta via docker exec).
