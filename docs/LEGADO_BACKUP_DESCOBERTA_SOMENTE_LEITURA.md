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

Vínculos empresariais (próximo item do programa Codex Legado): CPA Ferro e Aço
e 3Z LTDA = empresas operacionais; Grupo CPA = agrupamento. Não inferir
empresa por pasta/`EMP03`/Grupo 003.

---

## Estado nesta sessão Cloud (CODEX LEGADO)

| Item | Estado |
|---|---|
| HD externo montado no cloud agent | **BLOCKED** — `/mnt` e `/media` sem `BACKUP ERP ANTIGO - CODEX` |
| Inventário real (hashes do HD) | **pendente** — requer máquina com HD ou montagem autorizada |
| Validador de origem (código + fixture) | **preparado** — `validar-origem-relatorios-privados.mjs` + fixture sintética |
| Revalidação privada dos relatórios reais em `04_REPORTS` | **BLOCKED** — raiz privada indisponível neste VM |
| Staging / importação operacional | **bloqueado** (Onda 25 / gate) |
