# Contrato Cursor ↔ Codex — VPS / canário / migrations

**Status:** `PROPOSTA OPERACIONAL — AGUARDA CONFIRMAÇÃO DO CODEX`
**Frente Cursor:** PR #34 `cursor/vps-hml-gate-c-legado-392b`
**Frente Codex:** PR #33 `codex/comercial-360` (draft; **não editada por esta frente**)
**Atualizado:** 2026-09-24

Este arquivo alinha evidências e pendências **sem** autorizar canário, migration
real, promoção 3080 ou merge.

---

## 1. SHAs e artefatos (consultar GitHub; não congelar cegamente)

| Papel | Valor na data desta nota | Como revalidar |
|---|---|---|
| `main` base Cursor | `ca4171600cc30f9922c2f8b2ccb8b22d06aa6888` | `git fetch origin main && git rev-parse origin/main` |
| PR #34 HEAD | `f159ad258288d876a1f94122eb5fa18dbe7df3ae` (+ commits posteriores desta frente) | `gh pr view 34` |
| PR #33 HEAD (Codex) | `b7019c6774412bdbafd2944bde4d7edde8c223f2` | `gh pr view 33` |
| Imagem oficial VPS 3080 | `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` | Gate C / `docker inspect erp-api-dev` |
| SHA funcional 07B (handoff) | `ca0bc5f3529b9071fe80e58dae6aa966a9d6c740` | handoff / imagem |
| Imagem canário futura | `erp-zuccaro-erp-api:comercial360-main-<sha8>` do **MERGE_SHA da main** | só após merge #33 |

**Regra:** nunca construir imagem oficial a partir da branch feature.

---

## 2. Runtime / Auth — divergência a fechar com Codex

| Fonte | Runtime anunciado | Auth exigido |
|---|---|---|
| VPS 3080 (fato) | `ERP-RUNTIME-07B` | `dev_headers` |
| Meta no código PR #33 | `ERP-RUNTIME-08B` | (Auth Bearer preparado; homologação pendente) |
| Script canário PR #33 | `EXPECTED_RUNTIME` (default histórico `COMERCIAL-360-V1`) | **obriga** `auth.mode=supabase_user` |

**Ação Codex (pendente):** confirmar o valor exato de `EXPECTED_RUNTIME` /
`/api/v1/meta.runtime` que o canário deve aceitar **após merge na main**, e
garantir que o meta publique `auth.mode=supabase_user` na imagem imutável.

**Ação Cursor:** Gate C + precheck; não “corrigir” meta na branch do Codex.

`dev_headers` na 3080 **não** homologa Auth da PR #33.

---

## 3. Migrations

Lista estática (nomes apenas, **sem SQL**) em
`docs/vps/migrations-candidatas-comercial360.txt` (espelho da PR #33).

| Faixa | `main` | PR #33 | VPS (evidência histórica Gate C) |
|---|---|---|---|
| 001–015 | sim | sim | aplicadas 1× |
| 016–024 | não | sim | **ausentes** |

Gate E (futuro): aplicar **somente** faltantes presentes na **main pós-merge**,
via migrator canônico + backup novo. CI efêmera ≠ DEV.

Precheck Cursor (sem apply):

```bash
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
```

Esperado com VPS em 001–015: `missing_for_gate_e=016,017,...,024`.

---

## 4. Canário (Gate D) — checklist compartilhado

1. Gate C **APROVADO** (saída `gate-c-read-only.sh` + identidade MATCH).
2. PR #33 mergeada (ou autorização explícita equivalente) + CI verde na main.
3. `MERGE_SHA` registrado; imagem `comercial360-main-<sha8>` com digest.
4. Porta isolada ≠3080, rede = Gate C, `ENV_FILE` só na VPS.
5. `EXPECTED_RUNTIME` = valor confirmado na §2.
6. Smoke meta + smoke autenticado sintético (Bearer; RBAC negado; cross-tenant).
7. 3080 permanece 07B até Gate F.

Scripts (na PR #33 até o merge): `scripts/deploy/comercial360-{canary,smoke,rollback}.sh`.

---

## 5. Auth / perfis (dependência)

Evidência agregada histórica: `auth.users=0`, profiles ativos sem `auth_user_id`.
Homologação Auth exige gate próprio: usuário sintético, vínculo profile, token
válido/negado, escopo Grupo/Empresa. Containers “healthy” ≠ Auth de produto.

---

## 6. Legado (Onda 25) — paralelo

Cursor: inventário HD + mapeamento rascunho. Sem staging/import até autorização.
Codex: não precisa bloquear canário por legado, desde que Onda 25 continue
separada (Gate G).

---

## 7. Confirmações pedidas ao Codex (responder no PR #33 ou comentário)

- [ ] `EXPECTED_RUNTIME` canônico pós-merge = `_______________`
- [ ] Meta da imagem imutável terá `auth.mode=supabase_user`
- [ ] Lista 016–024 está completa / ordem correta para Gate E
- [ ] Digest/tag de imagem de referência após merge
- [ ] Identidade sintética Auth (sem segredo no Git) disponível para smoke D

Cursor confirma após Gate C APROVADO: rede Docker, porta livre, backup metadados,
rollback R07B preservado.
