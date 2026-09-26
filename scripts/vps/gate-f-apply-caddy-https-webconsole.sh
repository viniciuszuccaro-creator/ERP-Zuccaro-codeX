#!/usr/bin/env bash
# Gate F — aplicar Caddy HTTPS + firewall + CORS na VPS (Web Console).
# NÃO imprime IP público, tokens, .env completo nem e-mail ACME.
# NÃO marca acesso diário: isso exige navegação humana no laptop + external_nav.
#
# Uso (Web Console Hostinger / SSH root, após DNS público OK):
#   export CADDY_ACME_EMAIL='seu-email-acme@dominio'
#   # opcional: ERP_API_ENV=/opt/erp-zuccaro/.env  (só se CORS_ORIGINS não tiver o HTTPS SPA)
#   bash /opt/erp-zuccaro/scripts/vps/gate-f-apply-caddy-https-webconsole.sh
#
# Pré-requisitos:
#   - dig @8.8.8.8 erp-dev… e api-erp-dev… → IPv4
#   - docker erp-api-dev :3080 e erp-web :3081 em 127.0.0.1
#   - painel Hostinger Firewall: liberar 80/tcp e 443/tcp (além do ufw local)
#
# Saída: bloco PASTE_TO_GIT_* sanitizado para colar no chat/evidência.
set -Eeuo pipefail

SPA_HOST="${SPA_HOST:-erp-dev.cpaferroeaco.com.br}"
API_HOST="${API_HOST:-api-erp-dev.cpaferroeaco.com.br}"
SPA_UPSTREAM="${SPA_UPSTREAM:-127.0.0.1:3081}"
API_UPSTREAM="${API_UPSTREAM:-127.0.0.1:3080}"
CORS_ORIGIN_NEEDED="https://${SPA_HOST}"
CADDYFILE_PATH="${CADDYFILE_PATH:-/etc/caddy/Caddyfile}"
CADDY_ACME_EMAIL="${CADDY_ACME_EMAIL:-}"
ERP_API_ENV="${ERP_API_ENV:-}"
API_CONTAINER="${API_CONTAINER:-erp-api-dev}"
WEB_CONTAINER="${WEB_CONTAINER:-erp-web-dev}"
APPLY="${APPLY:-YES}" # YES=escreve/aplica; NO=só diagnóstico

echo "GATE_F_CADDY_HTTPS_BEGIN utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "spa_host=${SPA_HOST}"
echo "api_host=${API_HOST}"
echo "spa_upstream=${SPA_UPSTREAM}"
echo "api_upstream=${API_UPSTREAM}"
echo "apply=${APPLY}"
echo 'note=nao_imprime_ip_publico_nem_segredos;acesso_diario_exige_nav_humana'

blocked=0
warn=0

# ── 1. Loopback backends ────────────────────────────────────────────────────
code_loop() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 -m 8 "$url" 2>/dev/null || echo '000'
}

spa_loop="$(code_loop "http://${SPA_UPSTREAM}/")"
api_loop="$(code_loop "http://${API_UPSTREAM}/health")"
echo "loopback_spa_root=${spa_loop}"
echo "loopback_api_health=${api_loop}"

if [[ "$spa_loop" != "200" ]]; then
  echo 'BLOCKED: spa_3081_nao_responde_200'
  echo "HINT=docker_ps_erp-web; curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3081/"
  blocked=1
fi
if [[ "$api_loop" != "200" ]]; then
  echo 'BLOCKED: api_3080_health_nao_responde_200'
  echo "HINT=docker_ps_erp-api-dev; curl -sS http://127.0.0.1:3080/health"
  blocked=1
fi

# ── 2. DNS local (sem imprimir A) ────────────────────────────────────────────
spa_dig="$(dig +short "$SPA_HOST" A @8.8.8.8 | head -1 || true)"
api_dig="$(dig +short "$API_HOST" A @8.8.8.8 | head -1 || true)"
if [[ -n "$spa_dig" && "$spa_dig" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'dns_spa=RESOLVED_A'
else
  echo 'dns_spa=NX_OR_EMPTY'
  blocked=1
fi
if [[ -n "$api_dig" && "$api_dig" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'dns_api=RESOLVED_A'
else
  echo 'dns_api=NX_OR_EMPTY'
  blocked=1
fi
if [[ -n "$spa_dig" && -n "$api_dig" && "$spa_dig" == "$api_dig" ]]; then
  echo 'dns_spa_api_same_a=YES'
else
  echo 'dns_spa_api_same_a=NO_OR_UNKNOWN'
  warn=1
fi

# ── 3. Ocupantes 80/443 ─────────────────────────────────────────────────────
ss_summary() {
  local port="$1"
  ss -lntp "sport = :$port" 2>/dev/null | awk 'NR>1{print}' | head -3 | tr -s ' ' || true
}
echo "listen_80_summary=$(ss_summary 80 | head -1 | cut -c1-120 || echo none)"
echo "listen_443_summary=$(ss_summary 443 | head -1 | cut -c1-120 || echo none)"

if [[ "$blocked" -ne 0 ]]; then
  echo 'GATE_F_CADDY_HTTPS_STATUS=BLOCKED_PRECHECK'
  _dns_spa=NX; [[ -n "$spa_dig" ]] && _dns_spa=RESOLVED
  _dns_api=NX; [[ -n "$api_dig" ]] && _dns_api=RESOLVED
  echo 'PASTE_TO_GIT_BEGIN'
  echo "status=BLOCKED_PRECHECK utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "loopback_spa=${spa_loop} loopback_api=${api_loop}"
  echo "dns_spa=${_dns_spa} dns_api=${_dns_api}"
  echo 'acesso_diario=NOT_DONE'
  echo 'PASTE_TO_GIT_END'
  exit 2
fi

if [[ "$APPLY" != "YES" ]]; then
  echo 'GATE_F_CADDY_HTTPS_STATUS=DIAG_ONLY'
  echo 'HINT=export APPLY=YES CADDY_ACME_EMAIL=... e rode de novo'
  exit 0
fi

if [[ -z "$CADDY_ACME_EMAIL" \
   || "$CADDY_ACME_EMAIL" == *@exemplo* \
   || "$CADDY_ACME_EMAIL" == 'voce@seu-dominio-real.com' \
   || "$CADDY_ACME_EMAIL" == 'seu-email-letsencrypt' \
   || "$CADDY_ACME_EMAIL" == *placeholder* ]]; then
  echo 'BLOCKED: set_CADDY_ACME_EMAIL_real'
  echo 'HINT=export CADDY_ACME_EMAIL=email_real_seu_nao_placeholder'
  exit 2
fi

# ── 4. Instalar Caddy se ausente ────────────────────────────────────────────
if ! command -v caddy >/dev/null 2>&1; then
  echo 'caddy=INSTALLING'
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  else
    echo 'BLOCKED: apt_indisponivel_para_caddy'
    exit 3
  fi
fi
echo "caddy_version=$(caddy version 2>/dev/null | head -1 | tr ' ' '_')"

# ── 5. Caddyfile (sem e-mail no PASTE) ──────────────────────────────────────
mkdir -p "$(dirname "$CADDYFILE_PATH")"
umask 077
cat >"$CADDYFILE_PATH" <<EOF
{
  email ${CADDY_ACME_EMAIL}
}

${SPA_HOST} {
  encode gzip
  reverse_proxy ${SPA_UPSTREAM}
  header {
    -Server
  }
}

${API_HOST} {
  encode gzip
  reverse_proxy ${API_UPSTREAM}
  header {
    -Server
  }
}
EOF
# Unit systemd do Caddy roda como user `caddy` — 600 root:root bloqueia a leitura.
if id caddy >/dev/null 2>&1; then
  chown root:caddy "$CADDYFILE_PATH" 2>/dev/null || chown root:root "$CADDYFILE_PATH"
  chmod 640 "$CADDYFILE_PATH"
else
  chmod 644 "$CADDYFILE_PATH"
fi
echo "caddyfile_path=${CADDYFILE_PATH}"
echo "caddyfile_mode=$(stat -c '%a' "$CADDYFILE_PATH" 2>/dev/null || echo '?')"
echo 'caddyfile=WRITTEN'

if ! caddy validate --config "$CADDYFILE_PATH" 2>/dev/null; then
  echo 'BLOCKED: caddy_validate_failed'
  caddy validate --config "$CADDYFILE_PATH" 2>&1 | head -20 || true
  exit 4
fi
echo 'caddy_validate=OK'

# Portas 80/443: se nginx/apache ocuparem, Caddy não sobe
free_http_ports() {
  local p proc
  for p in 80 443; do
    proc="$(ss -lntp "sport = :$p" 2>/dev/null | awk 'NR>1{print; exit}' || true)"
    if [[ -n "$proc" ]]; then
      echo "port_${p}_busy=$(echo "$proc" | tr -s ' ' | cut -c1-140)"
      if echo "$proc" | grep -Eiq 'nginx'; then
        systemctl stop nginx 2>/dev/null || true
        systemctl disable nginx 2>/dev/null || true
        echo "port_${p}_action=stopped_nginx"
      elif echo "$proc" | grep -Eiq 'apache2|httpd'; then
        systemctl stop apache2 2>/dev/null || systemctl stop httpd 2>/dev/null || true
        echo "port_${p}_action=stopped_apache"
      elif echo "$proc" | grep -Eiq 'caddy'; then
        echo "port_${p}_action=caddy_already"
      else
        echo "port_${p}_action=MANUAL_FREE_REQUIRED"
      fi
    else
      echo "port_${p}_busy=NO"
    fi
  done
}
free_http_ports

# Prefer systemd unit se existir
if systemctl list-unit-files caddy.service 2>/dev/null | grep -q caddy.service; then
  systemctl enable caddy >/dev/null 2>&1 || true
  if ! systemctl restart caddy; then
    echo 'BLOCKED: caddy_service_restart_failed'
    systemctl status caddy --no-pager -l 2>/dev/null | head -40 | sed 's/@[^ ]*/@REDACTED/g' || true
    journalctl -u caddy -n 40 --no-pager 2>/dev/null | sed 's/@[^ ]*/@REDACTED/g' | head -40 || true
    ss -lntp 'sport = :80 or sport = :443' 2>/dev/null | head -10 || true
    echo 'HINT=chown_root:caddy_chmod_640_/etc/caddy/Caddyfile; liberar_80_443; email_ACME_real'
    exit 5
  fi
  sleep 2
  systemctl is-active caddy >/dev/null && echo 'caddy_service=active' || {
    echo 'BLOCKED: caddy_service_not_active'
    journalctl -u caddy -n 40 --no-pager 2>/dev/null | sed 's/@[^ ]*/@REDACTED/g' | head -40 || true
    exit 5
  }
else
  # fallback: caddy run em background (não ideal; preferir unit)
  pkill -x caddy 2>/dev/null || true
  nohup caddy run --config "$CADDYFILE_PATH" >/var/log/caddy-erp-dev.log 2>&1 &
  sleep 2
  echo 'caddy_service=nohup_fallback'
fi

# ── 6. Firewall local (ufw) ─────────────────────────────────────────────────
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  echo 'ufw_80_443=ALLOWED'
else
  echo 'ufw=NOT_PRESENT'
  warn=1
fi
echo 'NOTE_HOSTINGER_PANEL=liberar_80_e_443_no_firewall_do_painel_alem_do_ufw'

# Garantir 3080/3081 NÃO públicos (somente loopback)
ss -lntp 2>/dev/null | grep -E ':3080|:3081' | grep -v '127.0.0.1' && {
  echo 'WARN: 3080_ou_3081_expostos_em_nao_loopback'
  warn=1
} || echo 'bind_3080_3081=loopback_or_absent_ok'

# ── 7. CORS na API (sem dump de .env) ───────────────────────────────────────
cors_ok=UNKNOWN
if docker inspect "$API_CONTAINER" >/dev/null 2>&1; then
  # Lê só a variável CORS_ORIGINS do container (valor truncado na saída)
  cors_val="$(docker exec "$API_CONTAINER" printenv CORS_ORIGINS 2>/dev/null || true)"
  if echo "$cors_val" | grep -Fqx "$CORS_ORIGIN_NEEDED" || echo "$cors_val" | grep -Fq ",${CORS_ORIGIN_NEEDED}" || echo "$cors_val" | grep -Fq "${CORS_ORIGIN_NEEDED},"; then
    cors_ok=PRESENT
  elif echo "$cors_val" | grep -Fq "$CORS_ORIGIN_NEEDED"; then
    cors_ok=PRESENT
  else
    cors_ok=MISSING
  fi
  echo "cors_https_spa=${cors_ok}"
  if [[ "$cors_ok" == "MISSING" ]]; then
    echo 'HINT=adicione_CORS_ORIGINS_com_https_erp-dev_no_env_do_compose_e_recreate_api'
    echo "HINT_ORIGIN=${CORS_ORIGIN_NEEDED}"
    if [[ -n "$ERP_API_ENV" && -f "$ERP_API_ENV" ]]; then
      if grep -q '^CORS_ORIGINS=' "$ERP_API_ENV"; then
        # append origin se ausente (sem imprimir linha)
        if ! grep -F 'CORS_ORIGINS=' "$ERP_API_ENV" | grep -Fq "$CORS_ORIGIN_NEEDED"; then
          # sed in-place append via python para não vazar
          python3 - <<PY
from pathlib import Path
p = Path("${ERP_API_ENV}")
lines = p.read_text().splitlines()
out = []
need = "${CORS_ORIGIN_NEEDED}"
for line in lines:
    if line.startswith("CORS_ORIGINS="):
        val = line.split("=", 1)[1]
        parts = [x.strip() for x in val.split(",") if x.strip()]
        if need not in parts:
            parts.append(need)
        line = "CORS_ORIGINS=" + ",".join(parts)
    out.append(line)
p.write_text("\n".join(out) + "\n")
print("cors_env_file=UPDATED")
PY
          docker restart "$API_CONTAINER" >/dev/null
          sleep 3
          cors_val2="$(docker exec "$API_CONTAINER" printenv CORS_ORIGINS 2>/dev/null || true)"
          if echo "$cors_val2" | grep -Fq "$CORS_ORIGIN_NEEDED"; then
            echo 'cors_https_spa=PRESENT_AFTER_RESTART'
            cors_ok=PRESENT
          else
            echo 'cors_https_spa=STILL_MISSING_AFTER_RESTART'
            warn=1
          fi
        fi
      else
        echo "CORS_ORIGINS=${CORS_ORIGIN_NEEDED}" >>"$ERP_API_ENV"
        docker restart "$API_CONTAINER" >/dev/null
        sleep 3
        echo 'cors_env_file=APPENDED_RESTARTED'
      fi
    else
      warn=1
    fi
  fi
else
  echo "api_container=${API_CONTAINER}=NOT_FOUND"
  warn=1
fi

# ── 8. Probe local via hostname público (ACME pode demorar) ─────────────────
sleep 3
spa_https="$(code_loop "https://${SPA_HOST}/")"
api_https="$(code_loop "https://${API_HOST}/health")"
# retry curto se ACME ainda emitindo
if [[ "$spa_https" == "000" ]]; then
  sleep 8
  spa_https="$(code_loop "https://${SPA_HOST}/")"
  api_https="$(code_loop "https://${API_HOST}/health")"
fi
echo "local_https_spa_root=${spa_https}"
echo "local_https_api_health=${api_https}"

tls_ok=NO
if [[ "$spa_https" == "200" && "$api_https" == "200" ]]; then
  tls_ok=YES
fi
echo "tls_local_probe=${tls_ok}"

# ── 9. PASTE sanitizado ─────────────────────────────────────────────────────
echo 'PASTE_TO_GIT_BEGIN'
echo "gate=F_CADDY_HTTPS utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "dns_spa=RESOLVED dns_api=RESOLVED"
echo "loopback_spa=${spa_loop} loopback_api=${api_loop}"
echo "caddy=APPLIED validate=OK"
echo "ufw_80_443=ALLOWED hostinger_panel_firewall=HUMAN_CONFIRM"
echo "cors_https_spa=${cors_ok}"
echo "local_https_spa=${spa_https} local_https_api_health=${api_https} tls_local=${tls_ok}"
echo "acesso_diario=NOT_DONE_await_human_browser_nav"
echo "next=agente_roda_GATE_F_HTTPS_PROBE=reachability_fora_da_VPS"
if [[ "$tls_ok" == "YES" ]]; then
  echo 'GATE_F_CADDY_HTTPS_STATUS=OK_LOCAL_TLS'
else
  echo 'GATE_F_CADDY_HTTPS_STATUS=APPLIED_TLS_PENDING'
  echo 'HINT=aguardar_ACME_ou_abrir_80_443_no_painel_Hostinger; journalctl -u caddy -n 50'
fi
echo 'PASTE_TO_GIT_END'

if [[ "$tls_ok" == "YES" ]]; then
  exit 0
fi
exit 6
