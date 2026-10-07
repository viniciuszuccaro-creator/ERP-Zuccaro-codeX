# Parecer Cursor — consolidação Empresas #226 / #227 / #228 (SHA exato)

**Data:** 2026-10-07  
**Chat:** [ERP ZUCCARO - CODEX/CURSOR](bc-d973626e-1060-4071-a25a-6a549769392b)  
**Método:** comparação por SHA dos HEADs; **não** se presume que #226 já contém #228.

| PR | Branch | Base | HEAD (no parecer) |
|---|---|---|---|
| [#226](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/226) | `cursor/cadastros-empresas-edicao-392b` | `main` | tip #226 (inclui port #227 + testes #228) |
| [#227](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/227) | `codex/cadastros-empresa-edit-safe-20261006` | Expedição `codex/comercial-expedicao-cliente360-207-209-20261005` | `5e50e6b13b342053a3442d86a39b0a1a212bc8bd` |
| [#228](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/228) | `codex/cadastros-consolidacao-226-227-20261007` | tip #227 | `9ab5ec5a8492766f31f873f2a656e54607f3d6c2` |

## Veredito

| Ação | Decisão |
|---|---|
| Merge #226 → `main` | **APROVAR** (veículo único) |
| Merge #227 → `main` | **NÃO** (base Expedição) |
| Merge #228 → `main` | **NÃO** (base #227/Expedição); conteúdo de escopo mestre **portado/verificado** em #226 |
| Tip #227/#228 pós-merge #226 | arquivar / fechar sem merge |

## Matriz SHA (código runtime)

| Capacidade | #226 (main-bound) | #227 | #228 |
|---|---|---|---|
| `loadEmpresaForEdit` + `isEditRequestCurrent` | sim | sim | sim |
| `isTenantMasterEntity` / lista sem `empresa_id` de contexto | sim (`tenantMaster ? null`) | parcial | sim (`9ab5ec5a`) |
| Não carimbar `empresa_id` do contexto no save (mestre) | sim (`buildCadastroEditSavePayload`) | via viewer | via viewer |
| Deep-merge / `saveBlocked` / carga incompleta | **sim (só #226)** | não | não |
| `userTemAcessoEmpresa` com `string[]` | sim | via #228 | sim |
| RBAC Organizacional + Certificado granular | sim | sim | sim |
| Teste regressão lista-mestre / vínculo string | **portado de #228 neste lote** | — | sim |

## Gap #228 → #226 (fechado neste lote Cursor)

Commit #228 `9ab5ec5a` (“Corrige escopo mestre…”) altera 4 arquivos runtime + testes. Comparação tip-a-tip:

1. **Runtime já presente em #226** antes deste parecer: filtro `tenantMaster`, policy de save sem carimbo de `empresa_id`, form sem `empresa_id: contexto === "empresa"`, vínculos string.
2. **Faltava em #226:** testes de regressão de #228 (`isTenantMasterEntity`/`userTemAcessoEmpresa`, asserts de filtro/save, lista mestre com `empresaId: null` retornando ambas empresas). **Portados** em `tests/cadastro-empresa-edicao.test.js` adaptados ao helper `buildCadastroEditSavePayload` da #226.

## Riscos

- Não cherry-pickar tip #228 inteiro em main (puxaria stack Expedição).
- `loadEmpresaForEdit` ainda exige `complete.id === empresaId` **quando** `empresaId` é passado (escopo empresa editando outra empresa) — comportamento intencional e coberto por teste.

## Coordenação

- Veículo merge: **somente #226**.
- Cursor/Financeiro (#225) e Legado (#211) em arquivos/branches separados.
- Implantação VPS: gates vigentes; MCP Hostinger timeout neste ciclo → **não** marcar implantado.
