# Legado → canônico — rascunho de mapeamento (somente sintético)

**Status:** `RASCUNHO / SEM DADOS REAIS`
**Onda:** 25 (bloqueada)
**Política existente (não duplicar):** `src/components/lib/migracaoErpPolicy.js`
**Inventário:** `scripts/legado/inventario-backup-erp-antigo.sh`

Este documento **não** autoriza importação. Serve para alinhar Cursor ↔ Codex
quando o inventário do HD externo existir.

---

## 1. Princípios

1. Cadastros Gerais / agregados PostgreSQL já canônicos são a fonte de destino.
2. Preservar `codigo_legado` / `legacy_id` / `legacy_code` / `lote_migracao`.
3. Destino inicial = `staging` (`MIGRACAO_DESTINO_STAGING`).
4. Conflito → reservar código interno novo + mapeamento; nunca sobrescrita silenciosa.
5. Strip de segredos via `stripSegredosMigracao` / `SECRET_MIGRACAO_KEYS`.
6. Dados reais fora do GitHub; testes só sintéticos.

---

## 2. Matriz origem → destino (hipótese até inventário)

Preencher a coluna “Formato/origem observada” **somente** após o inventário
somente leitura. Valores abaixo são **candidatos** do ERP canônico atual.

| Domínio legado (rótulo) | Destino canônico | Pré-requisito PG | Notas |
|---|---|---|---|
| Empresa / filial | `empresas` + `groups` | 001 | tenant raiz = group |
| Cliente / pessoa | `clientes` | 009 | documento único no grupo |
| Cliente×empresa | `cliente_empresas` | 009–010 | elegibilidade; sem crédito/preço improvisado |
| Endereço / local | `cliente_locais` + finalidades | 011 | sem finalidade OBRA |
| Obra / obra cliente | `obras` + `obra_empresas` + `obra_locais` | 012 | sem endereço duplicado |
| Produto / item | `produtos` (+ PIM/DAM na PR #33) | 006–008 (+018–024 na PR) | sem preço no master |
| Tabela de preço | `tabelas_preco` / itens / empresas | 013 | `codigo_tabela_legado` já existe no legado UI |
| Condição pagamento | `condicoes_pagamento` | 014–015 | |
| Orçamento | agregado 016 (PR #33) | 016 | só após Gate E |
| Pedido / venda | agregado 017 (PR #33) | 017 | snapshot preço/endereço |
| Conta pagar/receber | entidades financeiras existentes | staging + reconciliação | `PENDING_MANUAL_RECONCILIATION` |
| NF | NotaFiscal + reconciliação fiscal | staging | permissões `Fiscal.Migracao.*` |
| Código empresa legado `0` | **quarentena** (não propaga) | — | `avaliarQuarentenaLegado` |
| Vendedor | **não** criar `Vendedor` paralelo | Colaborador/Pessoa | bloqueado até identidade canônica |
| Contato / telefone | **não** inventar Contato2 | Pessoa canônica futura | PII |

---

## 3. Migrations e destino DEV (evidência atual)

| Faixa | Repo `main` | PR #33 | VPS (evidência Gate C histórica) |
|---|---|---|---|
| 001–015 | sim | sim | aplicadas 1× |
| 016–024 | não (ainda) | sim | **ausentes** |

Gate E (futuro, autorizado): aplicar **somente** faltantes da **main** pós-merge,
nunca da branch feature. CI efêmera ≠ DEV.

---

## 4. Campos de rastreio obrigatórios no destino

Reutilizar `stampMigracaoRecord`:

- `origem_migracao` = `erp_antigo` (ou lote_csv/planilha/nfe_xml)
- `lote_migracao` / `migration_batch`
- `codigo_legado`
- `destino_migracao` = `staging` até homologação
- `status_migracao` = `PENDING_MANUAL_RECONCILIATION` quando exigir conciliação

---

## 5. Chave idempotente (sintético)

Composição (alinhada ao Gate 18 / `migracaoErpPolicy`):

```text
group_id|empresa_id|origem_migracao|entidade|codigo_legado
```

Implementação local (sem HD/import): `buildChaveIdempotenteMigracaoLegado` e
`mapLegadoLoteSintetico` em `scripts/legado/mapear-registro-sintetico.mjs`.
Duplicata no lote → reuso; reconciliação via `buildReconciliacaoMigracao`.

## 6. Próximos passos desta frente

1. Rodar inventário no HD (`BACKUP ERP ANTIGO - CODEX`) — metadados/hashes.
2. Preencher “Formato/origem observada” na matriz §2.
3. Propor ETL idempotente real só após inventário + Onda 25.
4. Staging isolado só com gate Onda 25.
