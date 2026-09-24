# Pacote de decisão por gate — D / E / F (pós-Gate E)

## Distinção obrigatória de estado

| Estado | Significado | Valor atual |
|---|---|---|
| `READY_FOR_REVIEW` | Pacote técnico revisável | **SIM** (pré-D) |
| `AUTHORIZED` (Gate E) | Checkbox + assinatura VINICIUS | **SIM** (E) |
| `EXECUTED` (Gate E) | Migrations 016–024 no DEV + `test:postgres` | **SIM** (`GATE_E_STATUS=OK`) |
| `AUTHORIZED` / `EXECUTED` (D/F) | Canário / Auth / 3080 | **NÃO** |

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

1. ~~**Digest de imagem**~~ — **REGISTERED** (`comercial360-main-2fc2fc80` · evidência `image-digest-comercial360-latest.txt`)
2. **Auth sintético** (`PENDING_AUTH_GATE`) — identidade Supabase + profile vinculado **fora do Git**; checklist `docs/GATE_D_SMOKE_AUTH_CHECKLIST.md`
3. Autorização humana no termo §C para **Gate D** (checkbox D ainda desmarcado) + assinatura
4. Canário em porta ≠3080 com `auth.mode=supabase_user` — **não** iniciar sem (2)+(3)

## Bloqueios Gate F

1. Gate D APROVADO
2. Digest da mesma imagem
3. Autorização humana Gate F
4. 3080 permanece R07B até F autorizado

---

## Proibições desta etapa

Não canário · não Auth novo sem gate · não promoção 3080 · não dump no Git · não marcar D/F executados sem termo.
