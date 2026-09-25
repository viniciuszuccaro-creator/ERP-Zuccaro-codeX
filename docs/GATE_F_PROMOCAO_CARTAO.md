# Gate F — promoção 3080 (cartão)

**Status:** `READY_FOR_HUMAN_SIGNATURE` — Gate D **completo**; execução **BLOQUEADA** até checkbox + assinatura no termo.
**Não executar** promoção neste lote Cursor sem o texto de autorização abaixo.

## Pré-requisitos

| # | Item | Estado |
|---|---|---|
| 1 | Gate C APROVADO | OK |
| 2 | Gate E APROVADO (schema 016–024) | OK |
| 3 | Gate D completo (Bearer · browser · mutação · negativos · limpeza) | OK (`15:28Z`) |
| 4 | Mesmo digest a promover × digest aprovado no canário | **DECISÃO HUMANA** (ver §Digest) |
| 5 | Backup novo + rollback R07B preservados | confirmar no precheck VPS |
| 6 | `comercial360-rollback.sh` dry-run OK no instante | confirmar no precheck VPS |
| 7 | Autorização humana no termo §C Gate F | **PENDENTE** |

## Digest — escolha obrigatória na assinatura

A mutação Orçamento→Pedido passou em:

`erp-zuccaro-erp-api:comercial360-gate-d-2b45292e` (from-checkout)

A tag MAIN `comercial360-main-2fc2fc80` **não** contém o fix do map Orçamento (`descricao`/`unidade_sigla`).

| Opção | O que autoriza | Quando usar |
|---|---|---|
| **A (recomendada)** | Após merge do fix na `main` + build `comercial360-main-<MERGE_SHA8>` + re-smoke mutação no canário com essa tag → promover **essa** tag imutável | Promoção alinhada ao contrato MAIN |
| **B** | Promover agora a imagem do canário aprovado `comercial360-gate-d-2b45292e` (digest local do build) | Só com aceite explícito de promover tag de branch, não MAIN |

Sem escolher A ou B no texto de autorização → **não executar**.

## Texto para o responsável colar no chat (assinatura)

Copiar **um** dos blocos (preencher data UTC):

### Opção A

```text
Autorizo Gate F (promoção 3080) na opção A:
merge do fix Orçamento→Pedido na main, build comercial360-main-<MERGE_SHA8>,
re-smoke mutação no canário com essa tag, depois promover essa imagem.
Não autorizo promoção da tag MAIN antiga 2fc2fc80 sem o fix.
Assinatura: VINICIUS
Data (UTC): YYYY-MM-DD
```

### Opção B

```text
Autorizo Gate F (promoção 3080) na opção B:
promover a imagem do canário aprovado comercial360-gate-d-2b45292e
(digest local do build Gate D). Aceito que não é tag MAIN imutável pós-merge.
Assinatura: VINICIUS
Data (UTC): YYYY-MM-DD
```

Sem esse texto + assinatura formal → Cursor/Codex **não** executam Gate F.

## Precheck VPS (somente leitura / dry-run — sem promoção)

Rodar **antes** da assinatura ou imediatamente após, ainda sem tocar 3080:

```bash
cd /opt/erp-zuccaro
git pull origin cursor/pos-gate-e-prep-d-392b

curl -sS -o /dev/null -w 'health_3080=%{http_code}\n' http://127.0.0.1:3080/health
curl -sS http://127.0.0.1:3080/api/v1/meta | head -c 400; echo
docker ps --format '{{.Names}} {{.Image}}' | grep -E 'erp-api|canary' || true

# Dry-run rollback (NÃO promove; exige ROLLBACK_CONTAINER preservado R07B)
ROLLBACK_CONTAINER='erp-api-dev' \
OFFICIAL_CONTAINER='erp-api-dev' \
CONFIRM_ROLLBACK=NO \
  bash scripts/deploy/comercial360-rollback.sh || true

echo 'PASTE_TO_GIT_BEGIN'
echo "gate_f_precheck_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo 'alter_3080=NOT_PERFORMED'
echo 'AUTHORIZES_GATE_F=NO'
echo 'NOTE=precheck_only_awaiting_human_signature'
echo 'PASTE_TO_GIT_END'
```

Cole só `PASTE_TO_GIT_*` + meta sanitizada (sem segredos).

**Nota Auth:** a identidade sintética foi **banida** na limpeza §E. Pós-promoção F exige **re-provision** Auth sintético antes do smoke Bearer na 3080.

## Regras de execução (só após AUTHORIZED)

- Promover **somente** a imagem escolhida na assinatura (A ou B).
- 3080 permanece R07B até este gate executar.
- Rollback de API ≠ rollback de schema.
- `CONFIRM_ROLLBACK=YES` só com autorização.
- Pós-promoção: health/ready/meta (`ERP-RUNTIME-08B` · `supabase_user`) + re-provision Auth + Bearer/mutação smoke + auditoria.

## Parar se

Digest divergente da escolha A/B, backup falhou, canário ≠ imagem a promover,
Auth ainda `dev_headers` na imagem nova, ou termo sem assinatura Gate F.
