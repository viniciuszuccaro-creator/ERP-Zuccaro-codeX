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
| Gates D–F | PREPARADOS / **NÃO EXECUTADOS** / `GO_NOGO=NO` |
| Prep. autônoma Cursor | **ESGOTADA** — aguarda humano + Codex |
| Snapshot | `docs/vps/evidence/go-nogo-snapshot-2026-09-24.txt` |
| 3080 | R07B `ca0bc5f3` preservada |
| Canário | não iniciado |
| Auth PR #33 | **não** homologado (`dev_headers`) |
| Legado HD | ferramenta pronta; inventário real pendente |

## Próxima ação concreta

1. **VPS (humano):** `bash scripts/vps/create-pre-gate-e-backup.sh` → colar
   bloco sanitizado em `docs/vps/evidence/pre-gate-e-backup-latest.txt`.
2. **Codex:** fechar §4 do contrato (`print-pedido-codex.sh` → pending=0).
3. **Humano:** assinar termo + marcar checkbox do gate em C.
4. Revalidar: `go-nogo-def.sh` (ainda `EXECUTE_DEF=NO` / `AUTHORIZATION=NOT_GRANTED`).
5. Só então decidir E→D→F; **não** interpretar `YES_PENDING_HUMAN_FINAL` como go.
