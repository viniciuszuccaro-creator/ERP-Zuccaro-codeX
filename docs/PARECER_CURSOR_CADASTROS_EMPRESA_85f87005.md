# Parecer Cursor — Cadastros Empresa edit/load `85f87005`

Fonte: agente [Comercial Cadastros Empresas](bc-55d5261f-d7a1-5e68-9b15-bd09a65ecb6a)  
Branch tip: `cursor/cadastros-empresa-edit-load-cb6a` @ `85f8700596b605a53581d04a7218ce794ce3d90d`  
CI tip: SUCCESS `37504756327` · testes `cadastro-empresa-edit-load` 9/9

## Veredito

**Aprovar conteúdo técnico; não mergear a branch tip como PR para `main`.**

A tip está empilhada sobre a candidata Expedição (`codex/comercial-expedicao-cliente360-207-209-20261005`): o diff vs `main` arrasta milhares de linhas alheias. Veículo de merge = **#226** (`cursor/cadastros-empresas-edicao-392b`), já baseado em `main`.

## O que o tip Comercial acertou (portado para #226)

| Item | Tip `85f87005` | #226 pós-consolidação |
|---|---|---|
| Carga completa | `getInContext` + `entities.get` | idem |
| Completude Empresa | `isCadastroEditLoadComplete` (nome+CNPJ) | policy extraída |
| Save sem wipe | `buildCadastroEditSavePayload` merge | policy + **sem** carimbo `empresa_id` em tenant master |
| RBAC owner | `Cadastros.Empresa` **ou** `Sistema.Empresas` | `hasCadastroEntityPermission` |
| Isolamento | assert grupo/empresa | `assertCadastroRecordInTenant` |
| Lista vazia em contexto empresa | (não tratado) | filtro tenant master por `group_id` + `localBase44` |
| Vínculos `string[]` | (não tratado) | `userTemAcessoEmpresa` |

## Riscos no tip

1. **Base errada para main** — merge direto contaminaria Expedição.
2. `buildCadastroEditSavePayload` no tip ainda carimbava `empresa_id` do contexto em Empresa — corrigido na policy da #226.
3. Prova UI erp-dev BLOCKED (`/meta` 401) — aceito; não inventar Bearer.

## Ação Cursor

- Portar helpers + testes para #226 (este lote).
- Manter tip Comercial como referência; não abrir segunda PR de Cadastros contra main.
- HUMAN: merge #226 após CI do SHA consolidado; tip `85f87005` pode arquivar/fechar quando #226 cobrir.
