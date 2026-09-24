# Termo de autorização — Gates D / E / F

**Uso:** fatos comprovados já preenchidos. Campos de **decisão** (iniciais Codex),
**autorização de gate** e **assinatura do responsável** permanecem em aberto.
Sem assinatura + checkbox do gate correspondente, Cursor/Codex **não** executam
canário, migration real nem promoção 3080.

Checagem local (não executa D/E/F):

```bash
bash scripts/vps/validate-termo-autorizacao.sh
bash scripts/vps/go-nogo-def.sh
# GO_NOGO=YES_PENDING_HUMAN_FINAL NÃO autoriza execução (EXECUTE_DEF=NO sempre
# até checkbox do gate + assinatura + comando VPS explícito).
```

Data (UTC) preparação Cursor: `2026-09-24T12:45:00Z`
Responsável (assinatura humana): _______________
PR funcional: #33 · HEAD Codex observado: `bfdfe834` (draft — revalidar no GitHub)
PR infra Cursor: #34 · HEAD: consultar branch `cursor/vps-hml-gate-c-legado-392b`
Evidência Gate C: `docs/vps/evidence/gate-c-2026-09-24.txt` (**APROVADO**)

---

## Fatos comprovados (Gate C — não alteram sem nova evidência)

| Fato | Valor |
|---|---|
| VPS | `srv1982741` (Web Console) |
| API oficial 3080 | `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` |
| Health / ready | HTTP 200 |
| Rede Docker | `supabase_default` (API + DB) |
| Identidade DB | MATCH `postgres` / cluster `7686065785209937954` |
| Migrations DEV | 001–015 (1×); **016–024 ausentes** |
| Auth oficial 3080 | `dev_headers` (**não** homologa PR #33) |
| `auth.users` | 0 |
| Portas candidatas (snapshot) | 3086, 3090, 3091 **FREE** |
| Rollback R07B | imagem/containers preservados (dry-run local OK) |
| Backups históricos | existem (pre-pr32/pre-r08); **não** liberam Gate E |

---

## A. Decisões técnicas (Codex / arquitetura)

Propostas Cursor abaixo. **Inicial Codex** e valor final ficam em aberto até §4.

| Decisão | Proposta Cursor (fato/código) | Valor final | Inicial Codex |
|---|---|---|---|
| `EXPECTED_RUNTIME` | `ERP-RUNTIME-08B` (meta PR #33) | ________ | ___ |
| Meta canário `auth.mode` | deve ser `supabase_user` | ________ | ___ |
| Gate E — fatia migrations | proposta: 016–017 depois 018–024 | ________ | ___ |
| Tag imagem | `comercial360-main-<sha8>` pós-merge **main** | sha8=________ | ___ |
| Porta canário | candidatas FREE: 3086 / 3090 / 3091 | ________ | ___ |
| Rede Docker | `supabase_default` (Gate C) | ________ | ___ |

---

## B. Pré-voo operacional (humano VPS)

| Item | Estado preparação | Feito | Inicial |
|---|---|---|---|
| Backup **novo** `pre-gate-e-…` em `/opt/erp-zuccaro/backups` (bytes+SHA-256) | evidência sanitizada: `pre-gate-e-20260924-140304.sql` bytes=390275 sha256=`e72ca99b…cae3f80` (VPS 2026-09-24T14:03Z); dump real só na VPS | [ ] | ___ |
| Integridade sem restauração destrutiva | header/tail/sha256/mode600 = YES na evidência | [ ] | ___ |
| Rollback R07B inspectável (dry-run) | OK na evidência Gate C | [x] | ___ |
| Porta escolhida **FREE** no instante | revalidar com `ss` no momento do canário | [ ] | ___ |
| Identidade Auth sintética pronta (fora do Git) | aguarda Codex §4 | [ ] | ___ |
| Termo lido: 3080 só muda no Gate F | obrigatório antes de F | [ ] | ___ |

---

## C. Autorizações explícitas

Marcar **apenas** o que está autorizado agora. Sem marca = **não executar**.

- [ ] **Gate E** — aplicar faltantes da **main** (não da branch)
- [ ] **Gate D** — canário isolado + smoke
- [ ] **Gate F** — promoção 3080 (exige D OK)

Assinatura responsável: _______________
Data/hora da assinatura: _______________

---

## D. Proibições (sempre)

Não aplicar a partir de `codex/comercial-360` sem merge.
Não usar `dev_headers` como prova de Auth.
Não apagar backups/rollback.
Não commitar `.env`, tokens, PII ou dump real.
`GO_NOGO=YES_PENDING_HUMAN_FINAL` **não** é autorização de execução.

---

## E. Sequência concreta para decisão (após este termo)

Ordem obrigatória; parar se qualquer caixa de C estiver desmarcada para o gate:

```text
0) Codex fecha §4 do contrato (print-pedido-codex.sh → pending=0)
1) Humano assina este termo + marca o gate autorizado em C
2) VPS: create-pre-gate-e-backup.sh → colar evidência sanitizada no Git
3) go-nogo-def.sh → blockers=NONE e EXECUTE_DEF=NO
4) Só Gate E marcado: aplicar fatia autorizada da MAIN (não desta branch)
5) test:postgres real; só então Gate D se marcado
6) Gate F só com D OK + checkbox F + digest do canário
```

Comando de revalidação (workstation):

```bash
bash scripts/vps/print-pedido-codex.sh
bash scripts/vps/check-backup-novo-gate-e.sh docs/vps/evidence/gate-c-2026-09-24.txt \
  docs/vps/evidence/pre-gate-e-backup-latest.txt
bash scripts/vps/go-nogo-def.sh
bash scripts/vps/freeze-go-nogo-snapshot.sh
```
