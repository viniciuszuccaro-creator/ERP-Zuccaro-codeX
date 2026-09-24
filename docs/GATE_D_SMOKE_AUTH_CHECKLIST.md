# Gate D — checklist de smoke autenticado (sintético)

**Status:** `PREPARADO / NÃO EXECUTAR` sem autorização Gate D + Auth sintético + digest
**Pré-condição satisfeita:** Gate E `OK` (schema 016–024 no DEV; `test:postgres` OK).
**Não usar:** `dev_headers` como prova de Auth.
**Não publicar:** mídia (`CLEAN` de scan ≠ aprovação comercial).

Complementa `docs/GATES_D_F_PREPARACAO_CANARIO.md` e o contrato
`docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md`.

---

## Pré-requisitos

| # | Item | Evidência |
|---|---|---|
| 1 | Gate C APROVADO | `score-gate-c.sh` |
| 2 | Gate E OK (schema 016–024 DEV) | `gate-e-webconsole-2026-09-24.txt` |
| 3 | `EXPECTED_RUNTIME=ERP-RUNTIME-08B` | canary default + `/meta` da imagem main |
| 4 | Imagem imutável `comercial360-main-<sha8>` da **main** | digest **REGISTERED** (`2fc2fc80` · evidência Git) |
| 5 | Canário up em porta ≠3080 | `comercial360-canary.sh` |
| 6 | Meta do canário: `auth.mode=supabase_user` | smoke script |
| 7 | Identidade sintética Auth (Bearer) + profile vinculado | **fora do Git** · gate Auth |
| 8 | Contexto Grupo/Empresa autorizados ao profile | seed sintético |

---

## Sequência mínima (após canário ready)

### A. Meta / superfície HTTP

```bash
BASE_URL="http://127.0.0.1:${CANARY_PORT}" \
EXPECTED_RUNTIME="<valor confirmado>" \
  ./scripts/deploy/comercial360-smoke.sh
```

Exige: runtime batendo, `supabase_user`, entidades `Orcamento` e `Pedido`.

### B. Bearer sintético — permitido

Com token válido e escopo correto (sem colar o token em logs/PR):

1. Orçamento: list → get → create → update → cancel  
2. Conversão idempotente Orçamento→Pedido (mesma chave duas vezes = 1 pedido)  
3. Pedido: list → get → update → status → cancel → histórico  
4. Totais recalculados pelo servidor (não confiar no client)

### C. Negativos obrigatórios

| Caso | Esperado |
|---|---|
| Sem Authorization | 401/403 fail-closed |
| Token inválido/expirado | negado |
| Profile sem permissão Orçamento/Pedido | 403 |
| `empresa_id` de outra empresa do grupo sem vínculo | bloqueado |
| `group_id` adulterado / outro grupo | 403 ou 404 (sem vazamento) |
| Duplo submit create sem idempotency | sem duplicata indevida / ou 409 conforme contrato |

### D. Auditoria

Mutações geram audit atômico; snapshots **sem** PII desnecessária.
Falha de audit → rollback da mutação (padrão do runtime).

### E. Limpeza

Remover apenas IDs sintéticos criados pelo gate, respeitando FKs/auditoria.
Não truncar tabelas. Não tocar dados de outros tenants.

---

## O que este checklist NÃO cobre

- Scanner ClamAV real / buckets DAM  
- Produto HTTP ligado  
- Promoção 3080 (Gate F)  
- Importação legado (Onda 25)

(Gate E / migrations 016–024: **já concluído** em 2026-09-24 — ver evidência Gate E.)

---

## Registro de evidência (sanitizado)

Ao executar no futuro, gravar no handoff Cursor apenas:

- `CANARY_PORT`, `IMAGE` tag (sem digest secreto se sensível), `EXPECTED_RUNTIME`
- `meta_auth_mode=supabase_user`
- contagem de casos B/C pass/fail
- **nunca** token, e-mail, senha, UUID de cliente real
