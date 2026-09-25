# Pacote de decisão por gate — D / E / F (pós-Gate E)

## Distinção obrigatória de estado

| Estado | Significado | Valor atual |
|---|---|---|
| `READY_FOR_REVIEW` | Pacote técnico revisável | **SIM** (pré-D) |
| `AUTHORIZED` (Gate E) | Checkbox + assinatura VINICIUS | **SIM** (E) |
| `EXECUTED` (Gate E) | Migrations 016–024 no DEV + `test:postgres` | **SIM** (`GATE_E_STATUS=OK`) |
| `AUTHORIZED` / `EXECUTED` (D) | Auth + canário + smokes Gate D | **SIM** (D EXECUTADO 2026-09-25) |
| `AUTHORIZED` / `EXECUTED` (F) | Promoção 3080 | **AUTHORIZED_OPTION_A** · **WAITING_MERGE** · **NÃO EXECUTADO** |

`GATE_*_READY=YES` **nunca** autoriza nem executa.

## Fatos pós-#35 e pós-Gate E (2026-09-24)

| Item | Valor |
|---|---|
| Main | `2fc2fc80adb9ca876be6ca3d29aab49305839e8a` (PR #35 = #33+#34) |
| Gate E | **OK** — evidência `docs/vps/evidence/gate-e-webconsole-2026-09-24.txt` |
| Schema DEV | 001–024 · `pending=[]` · `vps_schema_016_024=APPLIED` |
| `test:postgres` | OK (R01AUTH=14 R08B=2 R08C=2 R09=2 R10C=2 R10=5 · fail=0) |
| API 3080 | ainda `ERP-RUNTIME-07B` / `dev_headers` · imagem R07B preservada |
| Canary default | `EXPECTED_RUNTIME=ERP-RUNTIME-08B` (corrigido; sem `COMERCIAL-360-V1`) |

---

## Bloqueios restantes para Gate D

~~Concluídos~~ — Auth OK · canário OK · Bearer/browser/mutação/negativos/limpeza OK (2026-09-25).

## Bloqueios Gate F

1. ~~Gate D APROVADO~~ — **OK**
2. ~~Autorização humana Gate F~~ — **OK** opção A · VINICIUS · 2026-09-25
3. **Merge do fix na main** — **PENDENTE** (PR #37)
4. Build `comercial360-main-<MERGE_SHA8>` + re-smoke mutação nessa tag
5. 3080 permanece R07B até promoção **EXECUTED**
6. Pós-F: re-provision Auth sintético (limpo no §E) antes do smoke Bearer na 3080

---

## Proibições desta etapa

Não inventar assinatura Gate F · não promover 3080 sem texto A/B assinado · não dump no Git · não marcar F executado sem termo.
