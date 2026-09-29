# Legado → canônico — rascunho de mapeamento (somente sintético)

**Status:** `RASCUNHO / SEM DADOS REAIS`
**Onda:** 25 (bloqueada)
**PR Cursor:** mapeador #48 — branch `cursor/legado-mapper-48-grupo003-392b`
**Política existente (não duplicar):** `src/components/lib/migracaoErpPolicy.js`
**Inventário:** `scripts/legado/inventario-backup-erp-antigo.sh` (Codex / HD)
**Staging-scope:** `scripts/legado/staging-scope-gate.mjs` (Codex #106/#107 — Cursor não edita)

Este documento **não** autoriza importação. Serve para alinhar Cursor ↔ Codex
conforme `docs/EXECUCAO_PARALELA_CODEX_CURSOR.md`.

---

## 0. Exclusividade Cursor (arquivos reservados)

| Arquivo | Dono |
|---|---|
| `scripts/legado/mapear-registro-sintetico.mjs` | **Cursor** |
| `tests/legado-mapear-sintetico.test.js` | **Cursor** |
| `docs/LEGADO_MAPEAMENTO_CANONICO_RASCUNHO.md` | **Cursor** |

Codex consome o mapeador no HEAD final (#108 `verificar-mapeador-staging` etc.) **sem** editar estes arquivos. Sem dados reais / PII no GitHub.

---

## 1. Princípios

1. Cadastros Gerais / agregados PostgreSQL já canônicos são a fonte de destino.
2. Preservar `codigo_legado` / `legacy_id` / `legacy_code` / `lote_migracao`.
3. Destino inicial = `staging` (`MIGRACAO_DESTINO_STAGING`).
4. Conflito → reservar código interno novo + mapeamento; nunca sobrescrita silenciosa.
5. Strip de segredos via `stripSegredosMigracao` / `SECRET_MIGRACAO_KEYS`.
6. Dados reais fora do GitHub; testes só sintéticos.
7. **Grupo legado `003` / `3` não prova empresa emissora** — quarentena `codigo_empresa_legado_grupo_seletor`.
8. Empresas jurídicas candidatas: `001`/`1`, `002`/`2`, `005`/`5` — vínculo comprovado por registro (Codex/staging).
9. Mestres (`cliente`, `fornecedor`, `produto`, `condicao_pagamento`, `tabela_preco`) ficam no **Grupo** (`empresa_id` vazio → chave `…|grupo|…`).
10. Operações (`pedido`, `orcamento`, `obra`, …) pertencem à empresa comprovada e consolidam no Grupo.

---

## 2. Matriz origem → destino (hipótese até inventário)

Preencher a coluna “Formato/origem observada” **somente** após o inventário
somente leitura. Valores abaixo são **candidatos** do ERP canônico atual.

| Domínio legado (rótulo) | Destino canônico | Pré-requisito PG | Notas |
|---|---|---|---|
| Empresa / filial | `empresas` + `groups` | 001 | tenant raiz = group; PJ só 001/002/005 |
| Cliente / pessoa | `clientes` | 009 | documento único no grupo |
| Cliente×empresa | `cliente_empresas` | 009–010 | elegibilidade; sem crédito/preço improvisado |
| Endereço / local | `cliente_locais` + finalidades | 011 | sem finalidade OBRA |
| Obra / obra cliente | `obras` + `obra_empresas` + `obra_locais` | 012 | sem endereço duplicado |
| Produto / item | `produtos` (+ PIM/DAM na PR #33) | 006–008 (+018–024 na PR) | sem preço no master |
| Fornecedor | cadastro mestre Grupo | — | aliases sintéticos |
| Tabela de preço | `tabelas_preco` / itens / empresas | 013 | aliases sintéticos; sem preços reais |
| Condição pagamento | `condicoes_pagamento` | 014–015 | |
| Orçamento | agregado 016 | 016 | aliases sintéticos `orcamento` |
| Pedido / venda | agregado 017 | 017 | aliases sintéticos `pedido` |
| Conta pagar/receber | entidades financeiras existentes | staging + reconciliação | `PENDING_MANUAL_RECONCILIATION` |
| NF | NotaFiscal + reconciliação fiscal | staging | permissões `Fiscal.Migracao.*` |
| Código `0` / `000` | **quarentena** | — | `codigo_empresa_legado_0` |
| Código `3` / `003` | **quarentena (Grupo seletor)** | — | `codigo_empresa_legado_grupo_seletor` |
| Código `4` / `004` | **quarentena (inativa)** | — | `codigo_empresa_legado_inativa` |
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
- `codigo_empresa_legado` / `empresa_legado_tipo` / `empresa_legado_apto` (quando houver seletor)

---

## 5. Chave idempotente (sintético)

Composição (alinhada ao Gate 18 / `migracaoErpPolicy`):

```text
group_id|empresa_id|origem_migracao|entidade|codigo_legado
```

Mestre sem empresa → `empresa_id` token `grupo`.

Implementação: `buildChaveIdempotenteMigracaoLegado` e `mapLegadoLoteSintetico` em
`scripts/legado/mapear-registro-sintetico.mjs`.
Duplicata no lote → reuso; reconciliação via `buildReconciliacaoMigracao`.

## 6. Próximos passos desta frente

1. ~~Rodar inventário no HD~~ → **BLOCKED** até HD + somente leitura (Codex).
2. Preencher “Formato/origem observada” na matriz §2 **somente** após inventário.
3. Codex: staging/reconciliação (#106/#107/#108/#109) consome este mapeador sem editar #48.
4. Staging real / importação: Onda 25 + gate humano + vínculo jurídico por registro.
