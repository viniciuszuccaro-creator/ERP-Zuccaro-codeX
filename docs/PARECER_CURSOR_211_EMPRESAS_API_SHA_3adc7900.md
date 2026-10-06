# Parecer Cursor — export empresas API Legado @ `3adc7900`

**PR espelho:** [#211](https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211)  
**SHA Codex:** `3adc7900` (tip docs `47a19c03`)  
**Data:** 2026-10-06  
**Veredito:** **APPROVED COM RESSALVAS**

---

## Escopo

Script único Web Console somente leitura + classificador sintético CPA Ferro e Aço / 3Z LTDA operacionais; terceira linha Grupo CPA = agrupamento `neverDelete`. CADESP reusado (não re-solicitado).

## Checklist

| Critério | Resultado |
|---|---|
| Somente leitura | OK — SQL `SELECT`; teste recusa UPDATE/DELETE/INSERT no corpo |
| Nome de arquivo novo | OK — `legado-empresas-api-${STAMP}.json` sob `/root/erp-private` |
| Não pede CADESP de novo | OK — `cadesp_redocument_requested=false` |
| Não apaga 3ª linha | OK — `neverDelete` em todas as linhas |
| `importAuthorized=false` | OK — recusa export com flag true |
| Sem PII no Git | OK — fixture sanitizado; CNPJ só sha256+last4 no JSON privado |
| Coordenação #216/#217 | OK — ausência de tela ≠ importação |
| Mapper #48 | intocado |

## Intervenção humana (exata)

1. hPanel → VPS DEV → Web Console (root)  
2. Colar `scripts/legado/exportar-empresas-api-somente-leitura.sh` inteiro  
3. Devolver só `PASTE_TO_GIT_*`  
4. Transferir JSON privado para `BACKUP ERP ANTIGO - CODEX/04_REPORTS/` — nunca GitHub  

## Ressalvas

- VPS/HD **não** executados neste VM (`DATABASE_URL`/MCP/HD ausentes). Evidência real = paste humano.  
- SQL usa `digest(...,'sha256')` (extensão `pgcrypto`). Se faltar na VPS, o paste deve reportar o erro — não improvisar hash no cliente.  
- Matching por rótulo (nome) + CADESP já confrontado; IDs reais vêm só do export da API.

## Testes locais (espelho)

`legado-empresas-api-classificar` + plano gate → **9/9 PASS**
