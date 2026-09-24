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

## Ferramenta neste repositório

- Script: `scripts/legado/inventario-backup-erp-antigo.sh`
- Teste sintético: `tests/legado-inventario-backup.test.js`

O script:

1. procura a pasta pelo nome em unidades candidatas (`/mnt`, `/media`,
   `/run/media`, e em ambientes Windows/WSL caminhos montados);
2. lista arquivos (extensão, bytes, mtime);
3. calcula SHA-256;
4. classifica formato provável por extensão/assinatura leve (zip, sql, bak,
   mdf/ldf, dump, csv, xlsx) **sem** extrair conteúdo sensível;
5. emite JSON/texto agregado **sem** abrir registros de clientes.

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

## Mapeamento canônico (próximo lote, sem dados reais)

Reutilizar Cadastros Gerais / agregados já canônicos (Cliente, Produto,
TabelaPreco, etc.). Não criar cadastro paralelo. Campos de migração já
previstos em `migracaoErpPolicy.js` (`origem_migracao`, `lote_migracao`,
`status_migracao`, strip de segredos).

---

## Estado nesta sessão Cloud

| Item | Estado |
|---|---|
| HD externo montado no cloud agent | **não detectado** (`/mnt` sem a pasta) |
| Inventário real | **pendente** (máquina com o HD ou montagem autorizada) |
| Staging / importação | **bloqueado** (Onda 25) |
