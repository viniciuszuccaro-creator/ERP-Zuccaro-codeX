# Termo de autorização — Gates D / E / F

**Uso:** preencher e anexar à decisão humana. Sem este termo assinado,
Cursor/Codex **não** executam canário, migration real nem promoção 3080.

Checagem local (não executa D/E/F):

```bash
bash scripts/vps/validate-termo-autorizacao.sh
# WAITING_SIGNATURE → preencher; SIGNED_CHECKLIST_OK → ainda exige backup + Codex
```

Data (UTC): _______________  
Responsável: _______________  
PR funcional: #33 · HEAD Codex no momento: _______________  
PR infra Cursor: #34 · evidência Gate C: `docs/vps/evidence/gate-c-2026-09-24.txt`

---

## A. Decisões técnicas (Codex / arquitetura)

| Decisão | Valor escolhido | Inicial |
|---|---|---|
| `EXPECTED_RUNTIME` | `ERP-RUNTIME-08B` / outro: ________ | ___ |
| Meta canário `auth.mode` | deve ser `supabase_user` | ___ |
| Gate E — fatia migrations | 016–024 juntas / só 016–017 / outra: ________ | ___ |
| Tag imagem | `comercial360-main-<sha8>` sha8=________ | ___ |
| Porta canário | 3086 / 3090 / 3091 / outra: ________ | ___ |
| Rede Docker | `supabase_default` (Gate C) / outra: ________ | ___ |

## B. Pré-voo operacional (humano VPS)

| Item | Feito | Inicial |
|---|---|---|
| Backup **novo** em `/opt/erp-zuccaro/backups` (bytes+SHA-256) | [ ] | ___ |
| Rollback R07B inspectável (dry-run) | [ ] | ___ |
| Porta escolhida **FREE** no instante | [ ] | ___ |
| Identidade Auth sintética pronta (fora do Git) | [ ] | ___ |
| Termo lido: 3080 só muda no Gate F | [ ] | ___ |

## C. Autorizações explícitas

Marcar **apenas** o que está autorizado agora:

- [ ] **Gate E** — aplicar faltantes da **main** (não da branch)
- [ ] **Gate D** — canário isolado + smoke
- [ ] **Gate F** — promoção 3080 (exige D OK)

Assinatura responsável: _______________  
Data/hora: _______________

## D. Proibições (sempre)

Não aplicar a partir de `codex/comercial-360` sem merge.  
Não usar `dev_headers` como prova de Auth.  
Não apagar backups/rollback.  
Não commitar `.env`, tokens, PII ou dump real.
