# Gate C — cartão do operador (1 página)

**Objetivo:** fechar a auditoria somente leitura da VPS.  
**Não fazer:** migration, canário, restart da 3080, `cat` de `.env`, tokens.

## 1. Na Web Console autenticada

```bash
bash scripts/vps/gate-c-read-only.sh
```

Se o repo não estiver na VPS, abra e cole o arquivo inteiro:

https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/blob/cursor/vps-hml-gate-c-legado-392b/scripts/vps/gate-c-read-only.sh

## 2. Copie a saída completa para o chat/PR

Sem editar. O script já é agregado/sanitizado.

## 3. Na workstation (checkout desta frente)

```bash
# opcional: slim
bash scripts/vps/extract-gate-c-migrations.sh saida-gate-c.txt saida-slim.txt

# score automático
bash scripts/vps/score-gate-c.sh saida-gate-c.txt

# faltantes 016-024 (não aplica)
bash scripts/vps/gate-d-f-precheck.sh --from-gate-c-output saida-gate-c.txt \
  --candidate-list docs/vps/migrations-candidatas-comercial360.txt
```

## Resultados possíveis

| `GATE_C_RESULT` | Significado |
|---|---|
| APROVADO | Identidade MATCH + health/ready + 001–015 + backup metadados + porta livre |
| PARCIAL | Quase; falta backup metadados ou porta livre no snapshot |
| BLOQUEADO | Identidade/migrations/health falharam |

**Lembrete:** `meta_auth_mode=dev_headers` **não** homologa Auth da PR #33.  
Contrato Codex: `docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md`.
