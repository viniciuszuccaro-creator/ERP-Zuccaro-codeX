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

## 5. Smoke HTTPS externo (após DNS+TLS)

Na máquina **fora** da VPS (ou cloud agent com DNS resolvendo):

```bash
export ERP_BROWSER_URL='https://erp-dev.cpaferroeaco.com.br/'
export OFFICIAL_API='https://api-erp-dev.cpaferroeaco.com.br'   # ou same-origin via SPA
# Credenciais sintéticas só no cofre local da sessão — NÃO no Git
bash scripts/vps/gate-f-smoke-https-external.sh
```

Critérios de sucesso (400/403 **não** contam):

- `spa_origin_http=200` (HTTPS)
- `official_api_health=200` · `official_api_ready=200`
- `http_token=200` (Auth supabase_user)
- `nav_api_meta=200` · `nav_api_orc_list=200` (com tenant)
- `GATE_F_HTTPS_EXTERNAL=OK`

Colar apenas bloco `PASTE_TO_GIT` sanitizado.

---

## 6. Checklist de aceite

- [ ] A records resolvem de fora da VPS  
- [ ] `https://erp-dev…/` → 200 (certificado válido)  
- [ ] `https://api-erp-dev…/health` → 200  
- [ ] CORS inclui origem HTTPS do SPA  
- [ ] Cache HTML limpo (nginx no-store + purge Hostinger se aplicável)  
- [ ] Smoke `gate-f-smoke-https-external.sh` = OK  
- [ ] Evidência sanitizada em `docs/vps/evidence/`  

**BLOCKED atual:** DNS NX (evidência `gate-f-https-external-dns-blocked-2026-09-25.txt`).
