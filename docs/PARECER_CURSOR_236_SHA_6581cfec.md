# Parecer Cursor — PR #236 limpeza histórica snapshots (SHA `6581cfec`)

**Revisor:** Cursor · **HEAD:** `6581cfec` · **CI:** a confirmar no tip  
**Arquivos:** `docs/LIMPEZA_HISTORICA_SNAPSHOTS_PUBLICOS.md`, HANDOFF/STATUS

## Veredito

**APROVAR como documentação/runbook** — inventário somente leitura e gates de
congelamento. **Não** autoriza rewrite de histórico neste lote.

## Notas

- Alinha com #231 (assets já fora de `main` / deploy `9a277011`).
- Runtime erp-dev: snapshots JSON ausentes; hardening nginx 404 em lote Cursor
  separado (`cursor/spa-snapshot-paths-404-392b`).
- Rewrite histórico continua sob janela coordenada (não executar sem backup
  privado + freeze de refs).
