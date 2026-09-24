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

1. Humano: preencher `docs/TERMO_AUTORIZACAO_GATES_D_E_F.md`.
2. Humano VPS: backup **novo** `pre-gate-e-…` (bytes+SHA-256).
3. Codex: marcar §4 do contrato (`bash scripts/vps/print-pedido-codex.sh`).
4. Revalidar: `bash scripts/vps/go-nogo-def.sh` → só então discutir E→D→F.
5. Legado HD: inventário somente leitura quando o volume estiver montado.
6. Congelar de novo: `bash scripts/vps/freeze-go-nogo-snapshot.sh` após mudanças.
