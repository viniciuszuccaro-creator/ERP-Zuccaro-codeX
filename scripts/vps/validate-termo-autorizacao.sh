#!/usr/bin/env bash
# Valida se o termo D/E/F está preenchido o bastante para decisão humana.
# Não acessa VPS. Não inicia canário. Não aplica migration.
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
has_facts=0
grep -q 'Fatos comprovados (Gate C' "$TERMO" && has_facts=1 || true
has_seq=0
grep -q 'Sequência concreta para decisão' "$TERMO" && has_seq=1 || true
has_data_blank=0
grep -qE '^Responsável \(assinatura humana\): _{3,}|^Responsável: _{3,}' "$TERMO" && has_data_blank=1 || true
has_assin_blank=0
grep -qE '^Assinatura responsável: _{3,}' "$TERMO" && has_assin_blank=1 || true

echo "blank_underscore_lines=${blank_lines}"
echo "checkboxes_unchecked=${unchecked}"
echo "checkboxes_checked=${checked}"
echo "facts_section=${has_facts}"
echo "sequence_section=${has_seq}"
echo "placeholder_responsavel=${has_data_blank}"
echo "placeholder_assinatura=${has_assin_blank}"

# Fatos pré-preenchidos, mas assinatura/autorização ainda abertas
if (( has_facts == 1 && has_seq == 1 && (has_assin_blank == 1 || has_data_blank == 1 || checked < 1) )); then
  echo 'TERMO_STATUS=FACTS_READY_WAITING_SIGNATURE'
  echo 'NOTE: fatos Gate C preenchidos; falta assinatura + checkbox do gate + Codex §4'
  echo 'EXECUTE_DEF=NO'
  echo "TERMO_VALIDATE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 0
fi

if (( blank_lines > 0 || has_data_blank == 1 || has_assin_blank == 1 )); then
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
echo 'NOTE: checklist local OK — ainda exige backup novo + confirmacao Codex; EXECUTE_DEF=NO'
echo 'EXECUTE_DEF=NO'
echo "TERMO_VALIDATE_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
