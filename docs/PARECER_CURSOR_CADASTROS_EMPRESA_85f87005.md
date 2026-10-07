# Parecer Cursor — Cadastros Empresa edit/load (consolidação #226+#227)

Fontes:
- Tip Comercial `85f87005` (`cursor/cadastros-empresa-edit-load-cb6a`) — CI PASS; **base Expedição** → não mergear em main
- #226 `cursor/cadastros-empresas-edicao-392b` — veículo contra `main`
- #227 `5e50e6b13b342053a3442d86a39b0a1a212bc8bd` (`codex/cadastros-empresa-edit-safe-20261006`) — CI PASS; **base Expedição** → portar conteúdo, não tip-merge

## Veredito

**Solução única = evolução da #226 contra `main`.** Não mergear #227 nem tip `85f87005` (arrastariam Expedição).

## O que cada lado contribui

| Item | #226 (main) | #227 (Expedição) | Consolidado |
|---|---|---|---|
| Tenant master lista | `group_id` only | — | #226 |
| Policy `cadastroEditLoadPolicy` | sim | — | #226 |
| `getInContext` / deep-merge | sim | parcial | #226 |
| `userTemAcessoEmpresa` string[] | sim | quebrava string[] | #226 |
| `loadEmpresaForEdit` + request/scope | — | sim | #227 |
| ID somente leitura | — | sim | #227 |
| Gate `Cadastros.Organizacional` | — | exclusivo | unificado (+ Empresa + Sistema.Empresas) |
| Certificado granular | — | sim | #227 |
| Não reenviar `configuracao_fiscal` no update | — | sim | #227 |
| Bloco5 cartão Empresas | aliases frouxos | só Organizacional | Organizacional + aliases |

## RBAC

Aceita qualquer um (fail-closed; sem bypass `role=admin` sozinha):
- `Cadastros.Organizacional.*` (canônico localBase44 / cartão)
- `Cadastros.Empresa.*`
- `Sistema.Empresas.*`

## Ação

1. HUMAN: revisar/merge **#226** após CI do tip consolidado.
2. Fechar ou arquivar #227 como portada (não mergear tip Expedição).
3. Expedição (persistência/rollback/idempotência): lote **separado**, outros arquivos.
