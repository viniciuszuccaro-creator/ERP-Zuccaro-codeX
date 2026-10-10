# Legado → canônico — rascunho de mapeamento (somente sintético)

**Status:** `CONTRATO DE STAGING SINTÉTICO / SEM IMPORTAÇÃO REAL`
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
7. Cliente, Fornecedor e Produto são mestres compartilhados no Grupo: `empresa_id`
   não é exigido nem preenchido por inferência da empresa legada. O código de
   empresa da origem permanece como procedência, não como autorização de uso.
   Operações e vínculos fiscais continuam exigindo empresa comprovada.
8. Produto exige mapa explícito `classe|unidade` para tipo e unidade canônicos;
   sem mapa fica em quarentena. Código legado igual com conteúdo divergente é
   conflito, não reuso nem sobrescrita.

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

## 6. Estado do piloto e próximos passos

Em 10/10/2026, a `main` do GitHub estava em `baba91a6` e o merge `861513cd`
da #264 era descendente dela em branch Cursor, ainda não ancestral da `main`.
Este lote parte de `861513cd` em branch Codex isolada, preservando #254/#261.
O HD foi detectado neste computador, mas a leitura de `04_REPORTS` foi negada
pelo sistema de arquivos. Nenhum relatório real foi extraído, carregado ou
publicado. A PR #211 mantém o verificador e staging isolado existentes; este
lote ajusta apenas o mapeador/consumidor canônicos já presentes no repositório.

Checkpoint posterior no mesmo dia: `03_STAGING` e legivel. Headers SQL
CODIGOCLIENTE/RAZAOSOCIAL/NOMEGUERRA, CODIGOFORNEC/CGCFORNEC e
CODIGOMATERIAL/CODIGOCLASSE/UNIDADE foram incorporados ao mapper existente,
com testes inteiramente sinteticos; codigo original e fantasia entram no
fingerprint. Os arquivos de origem privados permanecem completos e intocados;
o stub de transformacao nao representa carga completa de todos os campos.
Dry-run privado examinou 20 registros de cada entidade: Cliente 20 mapeados,
Fornecedor 20 mapeados, Produto 20 em quarentena por mapa classe/unidade ausente.
Nao houve persistencia isolada nem operacional: recuperados/importados = 0.
Referencia de destino existe no manifesto privado, mas nao foi revalidada nesta
rodada. Manifestos indicam extracao nova/hash verificados e origem SQL read-only;
linhagem historica, crosswalk de Grupo/Empresa e equivalencia de unidades seguem
nao comprovados. Nao tratar presenca de classe/unidade como autorizacao de uso.

1. Liberar leitura somente de `04_REPORTS` no host do HD e executar o verificador
   da #211 sem tocar na origem; manter `importAuthorized=false`.
2. Validar manifesto/procedência e mapa jurídico privado; conferir destino e
   backup restauro-testado antes de qualquer carga isolada de entidades reais.
3. Ensaio isolado: extração → transformação → deduplicação → carga → consulta →
   edição/reabertura → reconciliação → retry → reversão, com evidência sanitizada.
4. Separar históricos sem empresa identificada dos saldos operacionais e exigir
   validação fiscal/financeira para notas, títulos, parcelas, cartões e recebimentos.
4. Staging isolado só com gate Onda 25.
