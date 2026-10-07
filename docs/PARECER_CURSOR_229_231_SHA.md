# Parecer Cursor — #229 gate + #231 snapshots (SHA exato)

**Data:** 2026-10-07  
**Chat:** [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)

## #226 vs #229

| PR | HEAD | Base |
|---|---|---|
| [#226](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/226) | tip unificado (inclui port #229) | `main` |
| [#229](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/229) | `2350a05f` | tip #226 |

### Gap #229 (fechado no veículo #226)

#226 ainda aceitava aliases `Sistema.Empresas` / `Cadastros.Empresa` (visualizar) e Bloco5 com OR amplo.  
#229 alinha UI ao backend local (`Empresa` → `Cadastros.Organizacional` apenas).

**Veredito:** portar #229 → #226; **não** mergear #229 sozinha (já baseada em #226). Após port: arquivar #229.

## #231 — snapshots públicos

| PR | HEAD | Base |
|---|---|---|
| [#231](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/231) | `47d3a148` | `main` |

Remove `public/base44-local-*.json` do tree, `.gitignore`, desliga hidratação em `main.jsx`, `recover.html` só com arquivo local, testes `public-snapshot-exposure-guard`.

**Veredito:** **APROVAR merge #231 → main** (segurança).  
Limpeza histórica (purge Git LFS/histórico): tarefa **separada**, sem rewrite de branches compartilhadas neste lote.  
Preservar cópia privada fora do GitHub / fora de `public/`.

## Coordenação deploy

Implantação erp-dev só após merge `main` contendo #231 (assets fora do build) + #226/#225.  
#230 = bootstrap **local** apenas — **não** substitui Auth Supabase da VPS.
