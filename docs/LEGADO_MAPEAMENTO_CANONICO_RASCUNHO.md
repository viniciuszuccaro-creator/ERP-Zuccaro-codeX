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
| Orçamento | agregado 016 | 016 | só após Gate E; aliases sintéticos `orcamento` |
| Pedido / venda | agregado 017 | 017 | snapshot preço/endereço; aliases sintéticos `pedido` |
| Conta pagar/receber | entidades financeiras existentes | staging + reconciliação | `PENDING_MANUAL_RECONCILIATION` |
| NF | NotaFiscal + reconciliação fiscal | staging | permissões `Fiscal.Migracao.*` |
| Código empresa legado `0` | **quarentena** (não propaga) | — | `avaliarQuarentenaLegado` |
| Vendedor | **não** criar `Vendedor` paralelo | Colaborador/Pessoa | bloqueado até identidade canônica |
| Contato / telefone | **não** inventar Contato2 | Pessoa canônica futura | PII |

Aliases sintéticos adicionais (sem inventário HD): `tabela_preco`, `orcamento`, `pedido` em
`LEGADO_FIELD_ALIASES` — só códigos/nomes; **sem** preços, custos ou PII no GitHub.

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

Escopo aceito:

```text
group_id|empresa_id_ou_grupo|origem_migracao|entidade|codigo_legado
```

Mestre/cadastro compartilhado usa o segmento `grupo` (não copia a operação por empresa).
Operação aceita usa o `empresa_id` canônico do vínculo comprovado.

Escopo rejeitado (divergência, payload sem contexto, vínculo ausente) **não** grava
`group_id`/`empresa_id` canônicos e usa:

```text
QX|group_id_contexto|group_id_payload|entidade|codigo_legado
```

`opts.groupId` / `opts.empresaId` são contexto autorizado do lote. Se divergirem da linha
ou do vínculo, a linha vai para quarentena; o contexto não substitui o payload.
Payload sozinho (`escopo_somente_payload`) também não autentica.

Implementação: `scripts/legado/resolver-escopo-legado.mjs` (extraído do mapper) e
`mapLegadoLoteSintetico`. Duplicata na mesma chave, inclusive retry em `indiceStaging`,
→ reuso. Reconciliação via `buildReconciliacaoMigracao`.

## 5.1 Seletor legado (sem prova jurídica)

| Código | Papel no seletor | Efeito no mapper |
|---|---|---|
| `001` | Empresa CPA | Não prova CNPJ. Operação só segue com `vinculosComprovados` |
| `002` | Empresa 3Z | Idem |
| `005` | Empresa ZUCCARO | Idem |
| `003` | Grupo CPA | Nunca é empresa emissora. Operação com só `003` → quarentena |
| `004` | Ausente no seletor | `codigo_empresa_legado_nao_comprovado`. Ausência não prova inatividade |
| `0` / `000` | Inválido | `codigo_empresa_legado_0` |

Zeros à esquerda são preservados (`1` normaliza para `001`). `codigo_tipo_nota_legado`
é coluna própria e nunca vira código de empresa.

Mestres (cliente, fornecedor, produto **somente revenda**) ficam no Grupo, com código
legado, sem `empresa_id` proprietário. A mesma chave em 001 e 002 não duplica o mestre.
Pedido, orçamento, estoque, contas a receber/pagar e nota exigem emissor comprovado,
permanecem na empresa e levam `visivel_consolidado_grupo` sem segunda cópia física.
Usuário, senha e permissão legados são excluídos e não entram em `gravados`.

## 6. Próximos passos desta frente

1. Inventário somente leitura no HD: frente Codex (#106/#107), sem editar este mapper.
2. Preencher “Formato/origem observada” na matriz §2 **somente** após esse inventário.
3. Provar o vínculo jurídico 001/002/005 por registro antes de qualquer carga.
4. ETL/staging real continua **BLOCKED** (Onda 25). Este contrato não importa.

**Sem dados reais no GitHub.** Aliases sintéticos: cliente, fornecedor, produto,
empresa, obra, condição, tabela, orçamento, pedido, estoque, contas e nota.
