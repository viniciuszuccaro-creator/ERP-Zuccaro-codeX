# DNS + HTTPS ERP DEV — preparação (sem aplicar segredos)

**Status:** PREP · DNS público ainda **não** resolve (`erp-dev` / `api-erp-dev` → NX).  
**Objetivo:** liberar teste externo de login/navegação (HTTPS) sem publicar 3080/3081 na internet aberta — só 443 via proxy.

Não registrar IP público, tokens, chaves ou dados reais neste arquivo.

---

## 1. Registros DNS (Hostinger Domains)

No painel do domínio `cpaferroeaco.com.br` (ou zona equivalente):

| Tipo | Host | Valor | TTL |
|------|------|-------|-----|
| A | `erp-dev` | `<IP_PUBLICO_VPS>` (consultar no painel Hostinger VPS; **não** colar no Git) | 300 |
| A | `api-erp-dev` | mesmo IP (ou CNAME → `erp-dev` se preferir um só A) | 300 |

Opcional (só com VPN/allowlist): `supabase-dev`, `studio-dev`.

Validação externa (fora da VPS):

```bash
dig +short erp-dev.cpaferroeaco.com.br A
dig +short api-erp-dev.cpaferroeaco.com.br A
# Esperado: IPv4 público; vazio/NX = ainda BLOCKED
```

---

## 2. Proxy TLS (Caddy ou Nginx) na VPS

Bind Docker permanece `127.0.0.1:3080` (API) e `127.0.0.1:3081` (SPA).  
O proxy escuta `443` e encaminha:

- `https://erp-dev…/` → `127.0.0.1:3081` (SPA + same-origin `/api` `/health` `/ready`)
- `https://api-erp-dev…/` → `127.0.0.1:3080` (API direta, se necessária)

Exemplo Caddy (ajustar e-mail ACME; **não** commitar e-mail real se sensível):

```caddy
erp-dev.cpaferroeaco.com.br {
  encode gzip
  reverse_proxy 127.0.0.1:3081
  header {
    # HTML/shell sem cache longo (ver deploy/nginx-erp.conf)
    -Server
  }
}

api-erp-dev.cpaferroeaco.com.br {
  encode gzip
  reverse_proxy 127.0.0.1:3080
}
```

Firewall: liberar **443/tcp** (e 80 só para ACME). Manter 3080/3081/5432/8000 **não** publicados.

---

## 3. CORS da API

No `.env` local da VPS (cofre; não Git), acrescentar às origens:

```text
https://erp-dev.cpaferroeaco.com.br
```

Reiniciar só o container da API após alterar CORS. Sem abrir Service Role no browser.

---

## 4. Cache (corrigir antes do teste externo)

### 4.1 Nginx do `erp-web` (repo)

- `index.html` / navegação SPA: `Cache-Control: no-store`
- Assets hasheados (Vite `*.js`/`*.css`): podem permanecer `immutable` com hash no nome

Arquivo: `deploy/nginx-erp.conf` (rebuild `erp-web` após alteração).

### 4.2 Cache Hostinger / CDN (se houver)

No painel Hostinger (Website → Cache / CDN), **purgar** cache do host `erp-dev` após rebuild do SPA.  
Não usar API token no Git; purge manual ou MCP Hostinger autenticado fora do repo.

### 4.3 Browser

Hard refresh ou janela anônima no primeiro teste pós-DNS.

---

## 5. Smoke HTTPS — duas camadas (não misturar)

O script `scripts/vps/gate-f-smoke-https-external.sh` **não** trata “API ok na VPS” como “ERP aberto no seu PC”.

| Probe (`GATE_F_HTTPS_PROBE`) | Onde roda | O que prova | Veredito |
|------------------------------|-----------|-------------|----------|
| `reachability` | Qualquer host | DNS+TLS+health/meta públicos | `LAYER_A_DNS_TLS=OK` ≠ login |
| `vps_api` | **Somente VPS** | Auth loopback + tenant docker + chamada HTTPS pública | `GATE_F_HTTPS_VPS_API=OK` — **não** é acesso diário |
| `external_nav` | **Fora** da VPS | Login+nav sem docker/loopback Auth | `GATE_F_HTTPS_EXTERNAL_NAV=OK` — prova laptop/cloud |
| `auto` | Detecta | VPS local → `vps_api`; senão → `external_nav` | Ver flags acima |

### 5.1 Verificação de API via VPS (híbrido)

```bash
# Na VPS, após DNS+TLS
ERP_BROWSER_URL='https://erp-dev.cpaferroeaco.com.br/' \
GATE_F_HTTPS_PROBE=vps_api \
SYNTH_EMAIL=... SYNTH_PASS=... \
  bash scripts/vps/gate-f-smoke-https-external.sh
```

Esperado: `GATE_F_HTTPS_VPS_API=OK` e **`GATE_F_HTTPS_EXTERNAL_NAV=NOT_PROVEN`**.

### 5.2 Navegação real fora da VPS (laptop / cloud agent)

```bash
# FORA da VPS — sem docker supabase-db e sem Auth em 127.0.0.1
ERP_BROWSER_URL='https://erp-dev.cpaferroeaco.com.br/' \
GATE_F_HTTPS_PROBE=external_nav \
ANON_KEY='...' \
AUTH_TOKEN_URL='https://…/auth/v1/token?grant_type=password' \
TENANT_GROUP_ID='…' TENANT_EMPRESA_ID='…' \
SYNTH_EMAIL=... SYNTH_PASS=... \
  bash scripts/vps/gate-f-smoke-https-external.sh
```

Alternativa: `ACCESS_TOKEN` + `TENANT_GROUP_ID` do cofre (sem chamar Auth).  
400/403 na listagem autenticada **não** contam. Colar só `PASTE_TO_GIT` sanitizado.

**Implantação de acesso diário:** só com DNS+TLS **e** `GATE_F_HTTPS_EXTERNAL_NAV=OK`. `vps_api` sozinho **não** fecha.

---

## 6. Checklist de aceite

- [ ] A records resolvem de **fora** da VPS  
- [ ] `https://erp-dev…/` → 200 (certificado válido) · HTML `Cache-Control: no-store`  
- [ ] `https://api-erp-dev…/health` → 200  
- [ ] CORS inclui origem HTTPS do SPA  
- [ ] (Opcional) `GATE_F_HTTPS_PROBE=vps_api` = OK na VPS  
- [ ] **`GATE_F_HTTPS_PROBE=external_nav` = OK** a partir de máquina externa  
- [ ] Evidência sanitizada em `docs/vps/evidence/`  

**BLOCKED atual:** DNS NX (evidência `gate-f-https-external-dns-blocked-2026-09-25.txt`).  
**Acesso diário:** **não** concluído até external_nav OK.
