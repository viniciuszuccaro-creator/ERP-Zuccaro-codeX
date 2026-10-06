# Legado — descoberta somente leitura do backup do ERP antigo

**Status:** `FERRAMENTA PREPARADA / INVENTÁRIO REAL PENDENTE`
**Onda:** 25 (bloqueada até autorização + staging isolado)
**Programa:** seção Onda 25 de
`docs/PROGRAMA_COMERCIAL_360_OMNICANAL_EXECUCAO_AUTONOMA.md` (PR #33)
**Política existente:** `src/components/lib/migracaoErpPolicy.js` (não duplicar)

---

## Regras absolutas

1. O backup real fica em HD externo, pasta **`BACKUP ERP ANTIGO - CODEX`**.
2. A letra da unidade **muda** (D:, E:, …). Descobrir; **não fixar** `D:`.
3. Somente leitura na origem. Nunca alterar, renomear, compactar no lugar ou
   apagar o original.
4. **Nunca** commitár o backup, cópia, dump, PII, senhas ou `.env` no GitHub.
5. No GitHub: apenas scripts, esquema, mapeamento, testes **sintéticos** e
   relatórios **agregados sanitizados**.
6. Importação real → staging isolado + reconciliação + gate próprio da Onda 25.

---

## Ferramentas neste repositório

- Inventário somente leitura: `scripts/legado/inventario-backup-erp-antigo.sh`
  - Teste: `tests/legado-inventario-backup.test.js`
- Validação de origem dos relatórios privados:
  `scripts/legado/validar-origem-relatorios-privados.mjs`
  - Fixture: `fixtures/legado/origem-relatorios-sinteticos/`
  - Teste: `tests/legado-origem-relatorios-privados.test.js`
- Vínculos por identidade jurídica comprovada:
  `scripts/legado/resolver-vinculo-juridico-legado.mjs`
  - Fixture: `fixtures/legado/vinculos-juridicos-sinteticos/`
  - Teste: `tests/legado-resolver-vinculo-juridico.test.js`
  - CPA Ferro e Aço / 3Z LTDA = empresas operacionais (emissoras)
  - Grupo CPA (`003`) = agrupamento, **não** emissor
  - `EMP03`/pasta/`TID_EMP03` **nunca** provam empresa
- Staging isolado (ETL sintético, item 3):
  `scripts/legado/carregar-staging-isolado-legado.mjs`
  - Fixture: `fixtures/legado/staging-isolado-sintetico/`
  - Teste: `tests/legado-carregar-staging-isolado.test.js`
  - Deduplicação, dependências, reconciliação por empresa (centavos),
    quarentena sem prova; `importAuthorized=false`
- Export somente leitura das empresas no banco da API:
  `scripts/legado/exportar-empresas-api-somente-leitura.sh`
  - Um único paste na Web Console; JSON privado com **nome novo**
    `legado-empresas-api-<UTC>.json` em `/root/erp-private/`
- Classificador do export (CPA/3Z operacionais; terceira linha = Grupo CPA):
  `scripts/legado/classificar-empresas-api-legado.mjs`
  - Fixture: `fixtures/legado/empresas-api-sinteticas/export-sanitizado.json`
  - Teste: `tests/legado-empresas-api-classificar.test.js`
  - Nunca apaga a terceira linha; CADESP/Gate 18 reusado
- Mapper sintético (#48, Cursor): `scripts/legado/mapear-registro-sintetico.mjs`
  — **não editar neste lote Codex**

O inventário:

1. procura a pasta pelo nome em unidades candidatas (`/mnt`, `/media`,
   `/run/media`, e em ambientes Windows/WSL caminhos montados);
2. lista arquivos (extensão, bytes, mtime);
3. calcula SHA-256;
4. classifica formato provável por extensão/assinatura leve (zip, sql, bak,
   mdf/ldf, dump, csv, xlsx) **sem** extrair conteúdo sensível;
5. emite JSON/texto agregado **sem** abrir registros de clientes.

O validador de origem dos relatórios comprova, por manifesto:

1. **fonte** (`relativePath` sob o root privado);
2. **SHA-256** com **duas passagens** idênticas (reprodução);
3. **extractorId + extractorVersion** registrados;
4. **kind** do extrator (`sql_readonly`, `tps_schema`, `app_literal_scan`,
   `aggregate`, `inventory`);
5. saída agregada sanitizada (somente leaf names + hashes + status) —
   sem conteúdo de relatório, sem PII, sem autorização de carga.

---

## Inventário inicial (quando o HD estiver montado)

```bash
# Exemplo — ajustar somente o ponto de montagem se necessário
./scripts/legado/inventario-backup-erp-antigo.sh \
  --report /tmp/legado-inventario-sanitizado.json
```

Revisar o relatório. Se aprovado para versionar um **resumo**, copiar apenas
contagens/extensões/hashes para `docs/` em lote futuro — nunca os arquivos.

---

## Validação privada da origem dos relatórios

No host com o HD montado (somente leitura), após gerar/atualizar o manifesto
privado em `04_REPORTS` (fora do Git):

```bash
node scripts/legado/validar-origem-relatorios-privados.mjs \
  --root "/mnt/<volume>/BACKUP ERP ANTIGO - CODEX" \
  --manifest "/mnt/<volume>/BACKUP ERP ANTIGO - CODEX/04_REPORTS/manifest-origem-relatorios.json"
```

Ensaio reproduzível neste clone (fixture sintética, sem HD):

```bash
node scripts/legado/validar-origem-relatorios-privados.mjs \
  --root fixtures/legado/origem-relatorios-sinteticos \
  --manifest fixtures/legado/origem-relatorios-sinteticos/manifest-origem.json
```

Contrato: `all_origins_verified=true` e `operationalImportAuthorized=false`.
Reprodução ≠ autorização de importação.

---

## Mapeamento canônico (próximo lote, sem dados reais)

Reutilizar Cadastros Gerais / agregados já canônicos (Cliente, Produto,
TabelaPreco, etc.). Não criar cadastro paralelo. Campos de migração já
previstos em `migracaoErpPolicy.js` (`origem_migracao`, `lote_migracao`,
`status_migracao`, strip de segredos).

Vínculos empresariais (item 2 — código + fixture):

```bash
node scripts/legado/resolver-vinculo-juridico-legado.mjs \
  --contrato fixtures/legado/vinculos-juridicos-sinteticos/contrato-aliases-aprovados.json \
  --candidatos fixtures/legado/vinculos-juridicos-sinteticos/candidatos-sinteticos.json
```

CPA Ferro e Aço / 3Z LTDA = empresas operacionais; Grupo CPA (`003`) =
agrupamento (não emissor). `EMP03`/pasta não prova empresa. O mapa privado
`legacy-approved-business-alias-map.json` do HD permanece fora do Git;
`importAuthorized=false`.

---

## Estado nesta sessão Cloud (CODEX LEGADO)

| Item | Estado |
|---|---|
| HD externo montado no cloud agent | **BLOCKED** — `/mnt` e `/media` sem `BACKUP ERP ANTIGO - CODEX` |
| Inventário real (hashes do HD) | **pendente** — requer máquina com HD ou montagem autorizada |
| Validador de origem (código + fixture) | **preparado** — `validar-origem-relatorios-privados.mjs` + fixture sintética |
| Revalidação privada dos relatórios reais em `04_REPORTS` | **BLOCKED** — raiz privada indisponível neste VM |
| Resolvedor jurídico CPA/3Z/Grupo (código + fixture) | **preparado** — sem inferência por pasta/`EMP03`/`003` como emissor |
| Mapa privado real de aliases (hashes CNPJ/UUID do HD) | **BLOCKED** — arquivo só em `04_REPORTS` do HD |
| Staging isolado sintético (código + fixture) | **preparado** — carga em memória; sem operacional |
| Extração real do HD → staging | **BLOCKED** — HD ausente neste VM |
| Plano importação/reversão (gate) | **preparado** — `docs/LEGADO_PLANO_IMPORTACAO_REVERSAO_GATE.md` |
| Importação / carga operacional | **bloqueado** — aguardar gate humano; flags permanecem false |
| Coordenação Comercial/Cursor (VPS vs versão anterior) | **canônico** — ausência de tela/cadastro **não** = falha de ETL; exige diff commit/imagem/flags/rotas/layouts/RBAC (#216/#217) |
| CADESP / Gate 18 | **reusado** — não solicitar novamente os mesmos comprovantes; mapa privado no HD |
| Export empresas (banco da API) | **executado na VPS** 2026-10-06T15:34:40Z; SFTP Cloud→HD **FAILED** (`LEGACY_SFTP_NO_KEY_AND_HD_UNMOUNTED`); file permanece `/root/erp-private/legado-empresas-api-20261006T153440Z.json` |
| Classificador API CPA/3Z/Grupo | **preparado** (fixture selo `c5c78e00…`); real aguarda JSON no HD |
| Procedência GitHub #211 | **git OK** (PR OPEN) / **fontes privadas BLOCKED** (HD ausente neste VM) |

---

## CADESP / Gate 18 — não pedir de novo

Comprovantes CADESP e a aprovação humana da Gate 18 já foram confrontados no HD
(`legacy-approved-business-alias-map.json` em `04_REPORTS`): CPA Ferro e Aço e
3Z LTDA = empresas operacionais; Grupo CPA = agrupamento. **Não solicitar
novamente os mesmos documentos.** Identidade jurídica neste lote reusa esse
mapa (hashes no HD; fixture sintética no Git).

---

## Export empresas do banco da API (Web Console — 1 comando)

**Execução neste Cloud Agent: NOT_PERFORMED** (SSH sem chave; MCP Hostinger sem
shell; preparar o script ≠ executar o export). Probe externo 2026-10-06:
health/ready HTTP 200 em `erp-dev`/`api-erp-dev`; runtime `ERP-RUNTIME-08B`;
`auth.mode=supabase_user`; sinal `database=configured/ok`. Isso **não** verifica
pgcrypto `digest` nem o SELECT de `groups`/`empresas`.

O script **pré-checa** health/ready, `current_database()`, extensão `pgcrypto`,
função `digest`, tabelas `groups`/`empresas` e colunas mínimas **antes** de
consultar empresas. Falha → exit 4–6, `executed=false`, sem JSON.

### Intervenção humana (exata)

1. Abrir Hostinger hPanel → VPS DEV → **Web Console** (root).
2. Colar **um único** paste: `scripts/legado/exportar-empresas-api-somente-leitura.sh`.
3. Conferir `PASTE_TO_GIT_PRECHECK_*` (`pgcrypto=yes`, `digest_probe_len=64`).
   Se BLOCKED: parar — empresas não foram lidas.
4. Se `executed=true`: SFTP o arquivo **novo**
   `/root/erp-private/legado-empresas-api-<UTC>.json` para
   `BACKUP ERP ANTIGO - CODEX/04_REPORTS/` — **nunca** GitHub, **nunca** sobrescrever.
5. Colar no chat só PRECHECK + PASTE (nomes/IDs no arquivo privado;
   Git: hash/last4). Classificar no PC:
   `node scripts/legado/classificar-empresas-api-legado.mjs --export <json-privado>`.
6. **Não** UPDATE/DELETE, **não** apagar a terceira linha, **não** restart,
   **não** tip-port, **não** carga operacional, `importAuthorized=false`.

Classificação esperada: duas empresas operacionais (CPA Ferro e Aço, 3Z LTDA);
terceira linha investigada como **Grupo CPA (agrupamento)**; `neverDelete=true`.

Ensaio neste clone (sem VPS):

```bash
node scripts/legado/classificar-empresas-api-legado.mjs \
  --export fixtures/legado/empresas-api-sinteticas/export-sanitizado.json
```

---

## Procedência da #211 (fontes privadas vs Git)

| Camada | Resultado neste VM |
|---|---|
| PR | https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX/pull/211 **OPEN** |
| Branch Cursor (PR) | `cursor/legado-origem-relatorios-392b` |
| Branch Codex (esta sessão) | `codex/legado-origem-relatorios-392b` |
| Git | Codex está **ancestral** do head da #211 (merges Cursor à frente) |
| SHA-256 dos relatórios reais em `04_REPORTS` | **BLOCKED** — HD ausente; validar procedência privada **no computador do proprietário** com `validar-origem-relatorios-privados.mjs --root <HD>` |
| Mapper Cursor #48 | intocado neste lote |

Ausência de tela/cadastro → investigar versão/flags/RBAC nas #216/#217; **não**
culpar importação/ETL.
