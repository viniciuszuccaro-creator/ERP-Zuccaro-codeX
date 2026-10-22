# Legado — descoberta somente leitura do backup do ERP antigo

## Preparacao privada vigente - 22/10/2026

Decisao do proprietario recebida neste chat: copia/transferencia privada do legado
para destino protegido existente na VPS e lotes minimos no Codespace/Cursor FORA
do checkout sao autorizados sob os gates abaixo. Isso supera a restricao historica
somente-local; NAO autoriza importacao operacional nem publica dados. Origem
`BACKUP ERP ANTIGO - CODEX` permanece RO/intocada, unidade descoberta na estacao.

Esta retomada executa no sandbox /workspace, nao na estacao com HD nem na VPS/
Codespace. Nao ha canal comprovado aqui para HD ou alias SSH existente. Nenhuma
busca em backup, conexao de banco, transferencia, instalacao ou recurso foi criado.
O precheck de disco/diretorios recebido e pontual/historico e nao reserva espaco
nem comprova protecao atual. O candidato privado ainda depende de configuracao
administrativa autorizada e de evidencia pelo executor com acesso existente.

| Gate antes do primeiro byte real | Evidencia privada necessaria | Estado nesta retomada |
| --- | --- | --- |
| Origem e capacidade | inventario ja existente, bytes totais, origem RO e folga atual do destino | acesso de origem nao disponivel aqui |
| Destino isolado | caminho exato fora publico/build/operacao, identidade do host, inexistencia de links para area publica | nao comprovado aqui |
| Menor privilegio | UID/GID/modos/ACL dos pais e destino, identidades autorizadas, sem acesso publico | nao comprovado |
| Criptografia e recuperacao | protecao em repouso e transporte autenticado, responsavel/canal privado de recuperacao, prova de leitura controlada | nao comprovado; disponibilidade de gpg nao prova criptografia |
| Integridade e retomada | manifesto privado origem/destino por SHA256/bytes, lote minimo, retomada autenticada sem sobrescrever divergencias | contrato existente; nenhum lote real transferido |
| Retencao | prazo/responsavel, limite de copias, descarte autorizado so de copias e recuperacao preservada | politica especifica pendente |

Reutilizar `scripts/legado/inventario-backup-erp-antigo.sh` somente na estacao com
origem autorizada; revisar o relatorio privadamente antes de qualquer resumo.
Reutilizar `consumir-lote-staging.mjs`, `persistencia-endereco-legado.mjs` e o mapa
canonico para lotes ja reconciliados, sem novo importador nem correspondencia por
palpite. Nao executar seus modos persistentes por causa desta preparacao.
Manifestos com caminhos reais/IDs/PII e mapas ficam privados; Git recebe apenas
contratos e agregado sanitizado. Historico financeiro/comercial preserva origem;
extrato nao cria titulo/baixa e regras fiscais continuam separadas.

Acao minima externa: executor autorizado com HD/SSH existente comprova os seis
gates e registra recibo sanitizado no HANDOFF antes de transferir lote minimo.
Nao e pedido de novo ambiente/chave/token nem de relatar historico novamente.
Piloto PREPARED_NOT_AUTHORIZED, agendamento PAUSED,045-049 nao executadas.

## Historico da ferramenta e descoberta (nao e estado atual)

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

## Estado historico da sessao Cloud

| Item | Estado |
|---|---|
| HD externo montado no cloud agent | **não detectado** (`/mnt` sem a pasta) |
| Inventário real | **pendente** (máquina com o HD ou montagem autorizada) |
| Staging / importação | **bloqueado** (Onda 25) |
