#!/usr/bin/env bash
# Valida se o termo D/E/F está preenchido o bastante para decisão humana.
# Não acessa VPS. Não inicia canário. Não aplica migration.
# Exit 0 = termo ainda aguarda assinatura OU checklist local OK (ver TERMO_STATUS).
# Exit 2 = arquivo ausente / inválido.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TERMO="${1:-$ROOT/docs/TERMO_AUTORIZACAO_GATES_D_E_F.md}"

echo "TERMO_VALIDATE_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "termo_path=${TERMO#"$ROOT"/}"

if [[ ! -f "$TERMO" ]]; then
  echo 'TERMO_STATUS=MISSING'
  echo 'BLOCKED: termo ausente' >&2
  echo "TERMO_VALIDATE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 2
fi

blank_lines="$(grep -cE '_{5,}' "$TERMO" || true)"
unchecked="$(grep -cE '^\- \[ \]' "$TERMO" || true)"
checked="$(grep -cE '^\- \[[xX]\]' "$TERMO" || true)"
has_runtime_blank=0
grep -qE 'ERP-RUNTIME-08B.*/ outro: _{3,}|outro: _{3,}' "$TERMO" && has_runtime_blank=1 || true
# Heurística: placeholder de data/responsável ainda em branco
has_data_blank=0
grep -qE '^Data \(UTC\): _{3,}' "$TERMO" && has_data_blank=1 || true
has_resp_blank=0
grep -qE '^Responsável: _{3,}' "$TERMO" && has_resp_blank=1 || true
has_assin_blank=0
grep -qE '^Assinatura responsável: _{3,}' "$TERMO" && has_assin_blank=1 || true

echo "blank_underscore_lines=${blank_lines}"
echo "checkboxes_unchecked=${unchecked}"
echo "checkboxes_checked=${checked}"
echo "placeholder_data_utc=${has_data_blank}"
echo "placeholder_responsavel=${has_resp_blank}"
echo "placeholder_assinatura=${has_assin_blank}"

if (( blank_lines > 0 || has_data_blank == 1 || has_resp_blank == 1 || has_assin_blank == 1 )); then
  echo 'TERMO_STATUS=WAITING_SIGNATURE'
  echo 'NOTE: preencher docs/TERMO_AUTORIZACAO_GATES_D_E_F.md antes de D/E/F'
  echo 'EXECUTE_DEF=NO'
  echo "TERMO_VALIDATE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

if (( checked < 1 )); then
  echo 'TERMO_STATUS=WAITING_GATE_CHECKBOX'
  echo 'NOTE: marcar ao menos um gate autorizado (E/D/F) no termo'
  echo 'EXECUTE_DEF=NO'
  echo "TERMO_VALIDATE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

echo 'TERMO_STATUS=SIGNED_CHECKLIST_OK'
echo 'NOTE: checklist local OK — ainda exige backup novo + confirmacao Codex EXPECTED_RUNTIME'
echo 'EXECUTE_DEF=NO'
echo "TERMO_VALIDATE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
