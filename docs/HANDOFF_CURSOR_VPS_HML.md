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

- `docs/GATE_C_AUDITORIA_VPS_SOMENTE_LEITURA.md` — fatos vs inferências
- `scripts/vps/gate-c-read-only.sh` — **um** script colável / executável na Web Console
- `scripts/vps/gate-d-f-precheck.sh` — precheck local a partir da saída Gate C
- `docs/GATES_D_F_PREPARACAO_CANARIO.md`
- `docs/LEGADO_BACKUP_DESCOBERTA_SOMENTE_LEITURA.md`
- `docs/LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md`
- `scripts/legado/inventario-backup-erp-antigo.sh`

## Próxima ação concreta

1. Operador executa/cola `scripts/vps/gate-c-read-only.sh` na Web Console e devolve a saída.
2. Cursor roda `gate-d-f-precheck.sh --from-gate-c-output` e atualiza Gate C para APROVADO/BLOQUEADO.
3. Em paralelo: inventário legado na máquina com o HD externo montado.
4. Combinar com Codex: digest de imagem pós-merge, migrations faltantes 016–024, identidade Auth sintética para D.
