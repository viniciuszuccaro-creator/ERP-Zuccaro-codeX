# Parecer Cursor — PR #227 HEAD `5e50e6b1`

**PR:** [#227](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/227)  
**Branch:** `codex/cadastros-empresa-edit-safe-20261006`  
**Base:** `codex/comercial-expedicao-cliente360-207-209-20261005` (Expedição)  
**SHA:** `5e50e6b13b342053a3442d86a39b0a1a212bc8bd`  
**CI tip:** SUCCESS (frontend/backend/concurrency/expedicao-compose)  
**Papel Cursor:** revisar e coordenar com #226 — **sem** desenvolver correção concorrente de Empresas.

## Veredito

**APROVAR conteúdo técnico do tip; NÃO mergear #227 em `main` como está.**  
Base Expedição arrasta candidata estoque/expedição. Veículo de merge = **#226** (`cursor/cadastros-empresas-edicao-392b` → `main`), consolidando o que #227 tem a mais.

## O que #227 traz (preservar na consolidação)

| Item | Evidência no tip |
|---|---|
| `loadEmpresaForEdit` + `isEditRequestCurrent` | `contextoMultiempresaPolicy.js` — bloqueia parcial, ID trocado, grupo estranho; invalida leitura ao Novo/troca contexto |
| Gate cartão Empresas | `Bloco5Organizacional`: `Cadastros.Organizacional.visualizar` + auditoria alinhada |
| Testes comportamentais | `tests/cadastro-empresa-edicao.test.js` (leitura completa, falha/retentativa, request stale) |
| EmpresaForm | bloqueio save com carga incompleta; RBAC granular certificado |

## O que #226 já cobre (não reimplementar)

| Item | SHA referência |
|---|---|
| Tenant master lista por `group_id` + `localBase44` | `f9b926e2` |
| `cadastroEditLoadPolicy` + `getInContext` | `f9b926e2` |
| Deep-merge nested forms + `userTemAcessoEmpresa` string[] | `f9b926e2` |
| CI PASS em base `main` | `f9b926e2` / docs `88d7a6cc` |

## Coordenação (Codex Comercial)

1. Portar para #226 (base `main`): `loadEmpresaForEdit`, `isEditRequestCurrent`, Bloco5 `Organizacional`, testes `cadastro-empresa-edicao.test.js`.
2. Unificar com `cadastroEditLoadPolicy` / `isCadastroEditLoadComplete` (sem duplicar caminhos de load).
3. Fechar #227 como supersedida após #226 consolidada + CI verde — ou rebase tip só das fatias Cadastros sobre #226.
4. Arquivos quentes Cadastros: `VisualizadorUniversalEntidadeV24.jsx`, `EmpresaForm*.jsx`, `Bloco5Organizacional.jsx`, `contextoMultiempresaPolicy.js`, `cadastroEditLoadPolicy.js`, `useContextoVisual.jsx`, `localBase44Client.js`.
5. Cursor **não** abre terceira PR de Empresas.

## Riscos

- Merge direto #227 → `main`: contamina Expedição.
- Duas policies de load (`loadEmpresaForEdit` vs `getInContext`/`isCadastroEditLoadComplete`) sem unificação = duplicidade.
- Prova UI erp-dev / Bearer: ainda sob gate Auth — não inventar token.

## Próximo Cursor

- Acompanhar consolidação Codex em #226; parecer do SHA consolidado final.
- Pacote Financeiro #225 e comparação implantado vs candidata em paralelo.
