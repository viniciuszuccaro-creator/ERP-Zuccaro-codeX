# Parecer Cursor — export empresas API Legado @ `4b5d3b94`

**PR espelho:** [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)  
**SHA Codex:** `4b5d3b94c414c341a6fc89797ba9b450bbcb4b97`  
**Anterior revisado:** `3adc7900` (`docs/PARECER_CURSOR_211_EMPRESAS_API_SHA_3adc7900.md`)  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS** — script revisado; **execução real não ocorreu**

> Não declarar export executado por ter o comando. Mapper Cursor **#48 intocado**. Dados reais fora do GitHub. CADESP reusado (`cadesp_redocument_requested=false`).

---

## Delta vs `3adc7900`

Pré-checagem **antes** do `SELECT` de `groups`/`empresas`:

- `127.0.0.1:3080/health` e `/ready` devem ser 200; senão `executed=false` exit 4.
- Extensão `pgcrypto`, `digest()` (64 hex), tabelas/colunas mínimas; senão exit 5/6 **sem** consultar empresas.
- `PASTE_TO_GIT_PRECHECK_*` + `executed=true` somente após gravar JSON privado com stamp novo.

SQL continua somente leitura (`SELECT`); teste estrutural recusa `UPDATE|DELETE|INSERT|DROP|TRUNCATE|ALTER`. `neverDelete=true`. `importAuthorized=false`. Terceira linha (Grupo CPA / rótulo de agrupamento) vai para investigação, não exclusão.

## Checklist cadastral (sem mapper #48)

| Critério | Resultado |
|---|---|
| CPA Ferro e Aço + 3Z LTDA | classificador por rótulo + CADESP já confrontado; IDs reais só do JSON privado |
| 3ª linha | `neverDelete`; quarentena/agrupamento |
| CNPJ no Git | só sha256 + last4 no paste; fixture sintético no repo |
| `mapear-registro-sintetico` / branch #48 | **não** no diff |
| Testes | `legado-empresas-api-classificar` + plano gate **9/9 PASS** neste SHA |

## Intervenção humana (única)

1. hPanel → VPS DEV → Web Console (root).  
2. Colar **inteiro** `scripts/legado/exportar-empresas-api-somente-leitura.sh` do SHA `4b5d3b94`.  
3. Devolver `PASTE_TO_GIT_PRECHECK_*` e `PASTE_TO_GIT_*` (`executed=true` ou `BLOCKED=…`).  
4. SFTP/scp o JSON `legado-empresas-api-<STAMP>.json` (nome **novo**) para `BACKUP ERP ANTIGO - CODEX/04_REPORTS/` — nunca GitHub, nunca sobrescrever o arquivo anterior.  
5. Classificar offline com `classificar-empresas-api-legado.mjs`; staging só dos comprovados; resto em quarentena.

## Ressalvas

- Este VM **não** executou o script (MCP VPS timeout; sem SSH/HD).  
- Não criar `pgcrypto` sem gate se o pré-check falhar.  
- Matching por nome é provisório até IDs do export da API efetiva.
