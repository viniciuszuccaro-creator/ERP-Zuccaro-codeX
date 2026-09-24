# Gate C — resultado 2026-09-24 (Web Console)

**Status:** `APROVADO` (com ressalvas documentadas)
**Evidência:** `docs/vps/evidence/gate-c-2026-09-24.txt`
**Score:** `bash scripts/vps/score-gate-c.sh docs/vps/evidence/gate-c-2026-09-24.txt` → `GATE_C_RESULT=APROVADO`
**VPS:** `srv1982741` | Janela: `2026-09-24T11:37:49Z` … `11:37:52Z`

## Fatos observados

| Item | Valor |
|---|---|
| API oficial | `erp-api-dev` Up; imagem `runtime07b-main-ca0bc5f3` |
| Rede | API e DB em `supabase_default` |
| health/ready | HTTP 200 |
| Identidade DB | `API\|postgres\|7686065785209937954` = `DIRECT\|…` → **MATCH** |
| Migrations | 001–015 exatamente 1×; `migration_rows=15`; **016+ ausentes** |
| Auth agregado | `auth_users=0`; `profiles=2`; `ativos_sem_auth=2`; groups=2; empresas=3 |
| Portas canário | 3086/3090/3091 **FREE**; 3080 em LISTEN |
| Backups | vários `.sql` com `dump_complete_marker=YES` (ex.: `pre-pr32-…` 486969 bytes) |
| Rollback | imagem/container R07B preservados; canário 07b exited |
| Supabase Auth | container healthy |

## Ressalvas (não bloqueiam Gate C; bloqueiam Auth/D/E)

1. **`meta_parse=ERR`** na execução: host sem `node`. Health/ready OK; imagem prova R07B. Script atualizado para parsear meta via `docker exec` na API.
2. **`auth.mode=dev_headers`** (histórico + nota do script) **não** homologa Auth da PR #33 (`supabase_user`).
3. **Restaurabilidade** dos backups não testada neste gate.
4. **Não aplicar** 016–024; **não** iniciar canário; **não** promover 3080 sem Gates D–F autorizados.
5. Imagens `runtime08b-*` existem no host (exited) — **não** são a API oficial.

## Precheck D–F (sem execução)

```text
missing_for_gate_e=016,017,018,019,020,021,022,023,024
identity_match=YES
PRECHECK_OK_WITH_WARNINGS  # scripts deploy ainda só na PR #33
ROLLBACK_DRYRUN_OK
```

## Próximo

1. Codex: confirmar `EXPECTED_RUNTIME` / meta com `supabase_user` (contrato).
2. Opcional: reexecutar `gate-c-read-only.sh` atualizado para capturar `meta_runtime`/`meta_auth_mode` via container.
3. Gate D/E somente com autorização humana + backup **novo** pré-migration.
