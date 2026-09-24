#!/usr/bin/env bash
# Varredura de vazamento em artefatos sanitizados da frente VPS/legado.
# Não acessa VPS. Não imprime valores suspeitos completos.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "SANITIZE_SCAN_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

targets=(
  "$ROOT/docs/vps"
  "$ROOT/docs/TERMO_AUTORIZACAO_GATES_D_E_F.md"
  "$ROOT/docs/HANDOFF_CURSOR_VPS_HML.md"
  "$ROOT/docs/PACOTE_AUTORIZACAO_GATES_D_E.md"
  "$ROOT/docs/CONTRATO_CURSOR_CODEX_VPS_CANARIO.md"
  "$ROOT/docs/GATE_C_RESULTADO_2026-09-24.md"
  "$ROOT/docs/GATE_E_MIGRATIONS_CARTAO.md"
  "$ROOT/docs/GATE_F_PROMOCAO_CARTAO.md"
  "$ROOT/docs/GATE_D_SMOKE_AUTH_CHECKLIST.md"
  "$ROOT/fixtures/legado"
)

# Padrões de valor real (não a palavra "senha" em documentação).
patterns=(
  'Bearer[[:space:]]+[A-Za-z0-9._-]{20,}'
  '-----BEGIN[[:space:]]+(RSA[[:space:]]+)?PRIVATE[[:space:]]+KEY-----'
  'postgres(ql)?://[^[:space:]]+:[^[:space:]]+@'
  'sk_live_[A-Za-z0-9]{10,}'
  'sk-[A-Za-z0-9]{20,}'
  'hapi_[A-Za-z0-9]{20,}'
  'ghp_[A-Za-z0-9]{20,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'AKIA[0-9A-Z]{16}'
)

hits=0
for target in "${targets[@]}"; do
  [[ -e "$target" ]] || continue
  for pat in "${patterns[@]}"; do
    # ripgrep se disponível; senão grep -R
    if command -v rg >/dev/null 2>&1; then
      if rg -n --hidden -g '!*.png' -g '!*.jpg' -e "$pat" "$target" >/tmp/sanitize-scan-hits.txt 2>/dev/null; then
        count="$(wc -l </tmp/sanitize-scan-hits.txt | tr -d ' ')"
        if (( count > 0 )); then
          echo "HIT pattern_family=$(echo "$pat" | cut -c1-24)... count=${count} path=${target#"$ROOT"/}"
          hits=$((hits + count))
        fi
      fi
    else
      if grep -RInE --exclude='*.png' --exclude='*.jpg' -e "$pat" "$target" >/tmp/sanitize-scan-hits.txt 2>/dev/null; then
        count="$(wc -l </tmp/sanitize-scan-hits.txt | tr -d ' ')"
        if (( count > 0 )); then
          echo "HIT pattern_family=$(echo "$pat" | cut -c1-24)... count=${count} path=${target#"$ROOT"/}"
          hits=$((hits + count))
        fi
      fi
    fi
  done
done

echo "hit_count=${hits}"
if (( hits > 0 )); then
  echo 'SANITIZE_SCAN_STATUS=BLOCKED_LEAK_CANDIDATE'
  echo 'NOTE: remover segredo do Git antes de qualquer gate'
  echo "SANITIZE_SCAN_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit 1
fi

echo 'SANITIZE_SCAN_STATUS=CLEAN'
echo 'EXECUTE_DEF=NO'
echo "SANITIZE_SCAN_END utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit 0
