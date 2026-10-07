# Parecer Cursor — integração/implantação erp-dev (2026-10-07)

## Acesso efetivo

| Canal | Resultado |
|---|---|
| GitHub | OK |
| Hostinger VPS MCP `vps_virtual-machines_list` | **timeout** |
| Self-hosted workers | **0** |
| erp-dev HTTP | health/ready/meta 200 · `ERP-RUNTIME-08B` · HTML `last-modified: 2026-09-27` |

## Pré-requisitos de merge (ordem sugerida)

1. **#231** snapshots fora de `public/` (segurança)
2. **#226** Cadastros (inclui #229)
3. **#225** Financeiro launchpad
4. (#230 opcional para DEV local — **não** altera Auth VPS)

## Gates vigentes (não contornar)

- Backup novo + rollback R07B/imagem preservada antes de promover 3080/erp-dev
- Build só do SHA da `main` pós-merge
- Confirmar no artefato implantado: **ausência** de `base44-local-*.json` públicos
- Smoke: login Supabase → CPA/3Z → Cadastros/Empresas → Financeiro 15 cards

## Estado

| Fase | Status |
|---|---|
| integrado | **não** — PRs abertos |
| implantado | **não** — MCP VPS timeout; main sem PRs |
| validado VPS | **não** |

**BLOCKED específico:** `VPS_MCP_TIMEOUT` + `MAIN_WITHOUT_FIX_PRS` — não declarar correção no domínio até merge+deploy comprovados.
