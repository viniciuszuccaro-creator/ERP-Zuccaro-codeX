# Pacote de autorização — Gates D / E (pós Gate C)

**Status:** `PRONTO PARA DECISÃO HUMANA — PREPARAÇÃO AUTÔNOMA ESGOTADA`
**Gate C:** APROVADO em 2026-09-24 (`docs/GATE_C_RESULTADO_2026-09-24.md`)
**Snapshot:** `docs/vps/evidence/go-nogo-snapshot-2026-09-24.txt` → `GO_NOGO=NO`
**Frente Cursor:** PR #34 · **Frente Codex:** PR #33 draft HEAD `200000bb` (consultar GitHub)

Este pacote **não** autoriza canário, migration nem promoção. Serve para
humanos/Codex decidirem o próximo gate com evidência congelada.

Cursor **não** avançará D/E/F sem termo assinado + backup novo + §4 Codex.

---

## 1. Congelado pelo Gate C (FATO)

| Item | Valor |
|---|---|
| VPS | `srv1982741` |
| API 3080 | `erp-zuccaro-erp-api:runtime07b-main-ca0bc5f3` |
| Rede | `supabase_default` (API + DB) |
| Identidade DB | MATCH `postgres` / cluster `7686065785209937954` |
| Migrations DEV | 001–015 (1×); **016–024 ausentes** |
| Portas livres (snapshot) | 3086, 3090, 3091 |
| Auth oficial | `dev_headers` (não homologa PR #33) |
| `auth.users` | 0 · profiles ativos sem Auth: 2 |
| Rollback R07B | imagem/containers preservados |
| Backups | vários `.sql` com marker YES (ex. pre-pr32 486969 B) |

---

## 2. Proposta Cursor → Codex (EXPECTED_RUNTIME)

| Fonte | Valor |
|---|---|
| Meta no código PR #33 | `runtime: 'ERP-RUNTIME-08B'` |
| Default do script canário PR #33 | `COMERCIAL-360-V1` |
| **Proposta Cursor** | `EXPECTED_RUNTIME=ERP-RUNTIME-08B` |

Motivo: o smoke/canário exige `m.runtime === EXPECTED_RUNTIME` **e**
`auth.mode === 'supabase_user'`. Usar o default `COMERCIAL-360-V1` **falharia**
contra o meta atual da branch.

**Pedido ao Codex (marcar no PR #33):**

- [ ] Confirmar `EXPECTED_RUNTIME=ERP-RUNTIME-08B` **ou** alterar o meta para o
      valor canônico escolhido (um só).
- [ ] Garantir que a imagem imutável pós-merge publique `auth.mode=supabase_user`.
- [ ] Confirmar se Gate E aplica **016–024** de uma vez ou em fatias (016/017
      comercial vs 018–024 produto/DAM/canais).
- [ ] Informar digest/tag após merge: `comercial360-main-<sha8>`.

---

## 3. Ordem proposta (quando autorizado)

```text
1) Backup NOVO em /opt/erp-zuccaro/backups (bytes+SHA-256)
2) Gate E — migrations faltantes da MAIN (não da branch)
3) test:postgres real (>0, 0 fail/skip)
4) Build imagem imutável da MAIN
5) Gate D — canário porta FREE (ex. 3086) + smoke meta + smoke Auth sintético
6) Gate F — só com autorização expressa (3080 permanece 07B até lá)
```

Scripts (PR #33 até merge): `comercial360-{canary,smoke,rollback}.sh`  
Checklists Cursor: `GATE_D_SMOKE_AUTH_CHECKLIST.md`, `GATE_E_MIGRATIONS_CARTAO.md`

Variáveis canário (exemplo — **não executar**):

```bash
IMAGE='erp-zuccaro-erp-api:comercial360-main-<sha8>'
ENV_FILE='/opt/erp-zuccaro/.env'          # só na VPS
ERP_DOCKER_NETWORK='supabase_default'     # do Gate C
EXPECTED_RUNTIME='ERP-RUNTIME-08B'        # se Codex confirmar
CANARY_PORT='3086'                        # revalidar FREE no instante
```

---

## 4. Bloqueadores restantes

| Bloqueio | Dono |
|---|---|
| PR #33 draft / sem merge | Codex + review |
| Auth sintético + profiles vinculados | gate Auth separado |
| Backup **novo** pré-E + restauração isolada (ainda não testada) | humano VPS |
| Confirmação EXPECTED_RUNTIME | Codex |
| Autorização explícita D e E | humano |

---

## 5. O que Cursor NÃO fará sem autorização

- Aplicar 016–024
- Subir canário / promover 3080
- Rotacionar Auth / criar users reais
- Ativar Produto HTTP / scanner / buckets
- Editar branch `codex/comercial-360`

---

## 6. Comandos de revalidação imediata (somente leitura)

```bash
# Na workstation, com a evidência já versionada:
bash scripts/vps/score-gate-c.sh docs/vps/evidence/gate-c-2026-09-24.txt
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output docs/vps/evidence/gate-c-2026-09-24.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
bash scripts/vps/rollback-dry-run-check.sh --from-gate-c-output docs/vps/evidence/gate-c-2026-09-24.txt
bash scripts/vps/validate-termo-autorizacao.sh
bash scripts/vps/check-backup-novo-gate-e.sh
bash scripts/vps/print-gate-e-fatias.sh
bash scripts/vps/go-nogo-def.sh
# → GO_NOGO=NO enquanto termo/backup/Codex pendentes

# Opcional na Web Console (script atualizado — meta via docker exec):
bash scripts/vps/gate-c-read-only.sh
```
