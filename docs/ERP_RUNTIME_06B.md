# ERP-RUNTIME-06B — Obra canônica

**Status:** `IMPLEMENTADO NA BRANCH / AGUARDANDO REVIEW`
**Branch:** `cursor/erp-runtime-06b-obras-392b`
**Base:** `f7fd49a12699a17db1a3e9f3cc57a4efdf44a88a`
**Software/API DEV oficial:** permanece `ERP-RUNTIME-06A` até promoção futura.
**Frontend HTTP:** `false`. Obra **não** entra em `HTTP_PILOT_ENTITIES`.

Diagnóstico canônico: `docs/ERP_RUNTIME_06B_DIAGNOSTICO.md`.
Este arquivo descreve a implementação na branch. Não promove DEV, não acessa
VPS e não inicia RUNTIME-07.

## Objetivo

Persistir Obra como **contexto comercial/operacional do Cliente**, com
autorização por Empresa e locais tipados, sem duplicar endereço, Cliente ou
Obra por Empresa.

## Migration

Somente `server/migrations/012_obras.sql`. Migrations 001–011 permanecem
imutáveis. Não há 013.

Tabelas:

- `obras` — identidade `group_id + cliente_id`; código `UNIQUE(group_id, codigo)`;
  status `ATIVA|PAUSADA|CONCLUIDA|CANCELADA`; `ativo` de lifecycle;
- `obra_empresas` — autorização de atendimento; `UNIQUE(obra_id, empresa_id)`;
- `obra_locais` — N:N com `ClienteLocal`;
  `UNIQUE(obra_id, cliente_local_id, uso_na_obra)`;
  índice parcial um principal ativo por Obra;
  `CHECK (principal = false OR ativo = true)`.

Sem logradouro, número, complemento, bairro, CEP, cidade, UF, lat/lng, geocode
ou maps em `obras`. Sem finalidade `OBRA` em `cliente_local_finalidades`.

Índices apenas para tenant, código, relacionamentos, status/listagem e principal.

## Modelo

```text
Cliente (Grupo)
  └── ClienteEmpresa (elegibilidade)
        └── Obra (Grupo + cliente_id)
              ├── obra_empresas (autorização; não ownership/NF/estoque)
              └── obra_locais → ClienteLocal (endereço canônico 06A)
```

`cliente_local_id` **não** é `obra_id`. Não há alias. Site/Comercial legado
não foram alterados.

Pedido **não** foi implementado. Futuro `pedido.obra_id` permanece opcional.
Documentos transacionais futuros usam referência + snapshot; o master continua
mutável.

## Código sequencial

`reserve_entity_codigo(group_id, 'Obra', 6)` na transação de create. Persistido
como `000001`. Não vem do payload. Sem `count(*)+1` e sem sequence paralela.
Concorrência no mesmo Grupo gera códigos distintos; gap é aceitável.

## Status e seleção operacional

- `status` operacional; `ativo` lifecycle.
- Default de create: `ATIVA`.
- Seleção operacional: `ativo=true` + `status=ATIVA` + `obra_empresa` ativa +
  ClienteEmpresa elegível.
- PAUSADA/CONCLUIDA/CANCELADA/inativa ficam fora do operacional padrão.
- Histórico autorizado permanece após bloqueio comercial.

## obra_empresas

Autoriza atendimento. Não define faturamento, estoque, crédito, preço ou
identidade fiscal. NF futura pertence à Empresa transacional do Pedido, nunca
ao Grupo.

Create/reativação exige ClienteEmpresa ativo/habilitado/não bloqueado
(`elegivel_operacao`). Restore reutiliza o vínculo. Bloqueio atual não apaga
histórico.

Uma Obra pode ser autorizada a duas Empresas elegíveis do mesmo Grupo sem
duplicar a Obra.

## obra_locais

`uso_na_obra`: `FISICO`, `ENTREGA`, `ADMINISTRATIVO`, `FISCAL`, `OUTRO`.
Diferente da finalidade do ClienteLocal. Nunca `OBRA`.

Principal: no máximo um `principal=true AND ativo=true` por Obra (índice
parcial). Não há principal por uso. Create exige ≥1 local ativo e exatamente
um principal. 06B recebe IDs de `ClienteLocal` existentes; não duplica
`ClienteLocalService`. Orquestração “nova Obra + novo Local” fica para lote
futuro.

Inativar o principal de Obra ativa é rejeitado (`409 OBRA_PRIMARY_LOCAL_REQUIRED`).
Troca de principal é transacional com `SELECT … FOR UPDATE` + barreira SQL.
ClienteLocal ligado ativamente a Obra ativa não pode ser inativado
(`409 CLIENTE_LOCAL_IN_USE`); sem cascade.

## API

Base: `/api/v1/clientes/:clienteId/obras`

| Método | Caminho | Operação |
|---|---|---|
| GET | `/` | list/search/count/paginação/filtros |
| POST | `/` | create atômico |
| GET | `/:obraId` | obter Obra ativa no escopo |
| PATCH | `/:obraId` | nome/status/observacao |
| DELETE | `/:obraId` | soft delete |
| POST | `/:obraId/restore` | restaurar identidade/código |
| GET | `/:obraId/empresas` | listar autorizações ativas |
| POST | `/:obraId/empresas/:empresaId` | vincular/reativar |
| DELETE | `/:obraId/empresas/:empresaId` | inativar vínculo |
| POST | `/:obraId/empresas/:empresaId/restore` | restaurar vínculo |
| GET | `/:obraId/locais` | listar locais ativos |
| POST | `/:obraId/locais` | vincular local existente |
| DELETE | `/:obraId/locais/:localId` | inativar não-principal |
| POST | `/:obraId/locais/:localId/restore` | restaurar vínculo |
| POST | `/:obraId/locais/:localId/principal` | definir principal |

Create payload: `nome`, `observacao` opcional, `locais[{cliente_local_id,
uso_na_obra, principal}]`, `confirm_possible_duplicate` opcional. Tenant,
empresa, código e actor não são livres. Cliente vem da rota. Sem local ou
sem exatamente um principal → `400 VALIDATION_ERROR`.

PATCH allowlist: `nome`, `status`, `observacao`. Bloqueia `group_id`,
`cliente_id`, `codigo`, `empresa_id`, actors, legado, endereço e internos.

HTTP: 201 create; 200 leitura/mutação; 403 permissão/elegibilidade; 404
escopo/IDOR/cross-group; 409 duplicidade/principal/local em uso; 400
validação (padrão do BFF atual, equivalente ao 422 pedido).

Listagem pública mínima: id, código, nome, status, ativo, resumo do principal
(cidade/UF/nome/uso). Sem endereço completo indiscriminado.

Paginação server-side: `limit`/`offset`/`total`/`hasMore`; busca código/nome;
filtros status/ativo/operacional/cidade/UF; `order_by` allowlist
`nome|codigo|created_at`. Count no banco, não em memória.

## Create atômico

Na mesma transação: tenant → Cliente → ClienteEmpresa elegível → código →
Obra → `obra_empresa` do contexto → `obra_locais` → principal → audit.
Qualquer falha rollbacka tudo, inclusive código se a reserva estiver na
transação.

## RBAC fail-closed

`PostgresRbacGuard` / `Cadastros.obra`:

- visualizar, criar, editar, inativar, restaurar
- vincular-empresa, vincular-local, principal

Actor ausente/inválido/sem permissão → 403. Sem contexto de grupo/empresa
válido a operação é bloqueada no backend.

## RLS

`ENABLE` + `FORCE RLS` em `obras`, `obra_empresas` e `obra_locais`.
`REVOKE ALL … FROM PUBLIC`. Sem policy permissiva genérica. Role sem
`BYPASSRLS` e sem contexto vê 0 linhas. O BFF usa papel privilegiado
server-only; a chave não é exposta ao Vite.

## Tenant / IDOR

- Obra Grupo A + Cliente Grupo B bloqueada por trigger.
- Local de outro Cliente/Grupo bloqueado por trigger e API (`404`).
- Empresa de outro Grupo bloqueada por trigger e API.
- Empresa irmã sem `obra_empresa` não lista/GET/usa operacionalmente.
- `clienteId` da rota deve ser `obra.cliente_id` (404 no Cliente errado).
- Visão Grupo consolida somente com o guard já existente; sem header de bypass.

## Duplicidade

Mesmo Grupo + Cliente + nome normalizado + Local principal →
`409 POSSIBLE_DUPLICATE`. Não é UNIQUE de identidade. Casos legítimos no
mesmo endereço exigem `confirm_possible_duplicate` permissionado e auditado
(`possible_duplicate_override`). UUID é identidade; código é humano. Sem
fingerprint-identidade e sem MD5.

## Auditoria

Eventos: create, update, change_status, inactivate, restore, link,
change_primary_local, possible_duplicate_override.

Mutação + audit na mesma transação; falha de audit rollbacka. Snapshot:
ids, código, nome, status, flags e vínculos. Sem endereço, CEP, coordenadas,
telefone, e-mail, CPF/CNPJ ou documento.

Não há módulo `securityAlerts` no server atual; cross-tenant/mass assignment
são bloqueados por schema/404/403 sem log PII. Integração futura deve
reutilizar o módulo existente, sem inventar paralelo.

Não são emitidos `integration_events` nesta etapa.

## Soft delete / restore

DELETE → `ativo=false`. Sem hard delete/cascade. Restore reabre a mesma Obra
e o mesmo código. Vínculos de empresa/local **não** são restaurados em
cascata; restore de vínculo é explícito e não duplica linha lógica.

## Seed

`server/scripts/seed-dev-synthetic.sql` é sintético e idempotente: Obras A/B,
vínculos empresa/local, sequência `Obra` next_value=2. Segunda execução não
duplica. Não executar no VPS/DEV nesta etapa.

## Fora de escopo

Pedido, Orçamento, Comercial UI/360º, frontend, Wizard, Site, Marketplace,
Produção, Armação, Corte/Dobra, Chapa, CAD, BOM, Kit, NF-e, Financeiro,
Expedição/Roteirizador, responsáveis nomeados, `obra_anexos`, GoTo/WhatsApp,
RUNTIME-07, promoção DEV, migration remota.

Criação rápida futura (documentada, sem UI): nome + Local existente + Empresa
de contexto; código gerado no servidor.

## Sugestão para AGENTS.md (revisão humana)

Não alterado automaticamente. Se aprovado: “Obra é contexto de negócio do
Cliente; endereço permanece em ClienteLocal; `obra_empresas` autoriza
atendimento e não emite NF.”

## Runbook DEV

Comandos futuros em `docs/ERP_RUNTIME_06B_DEV_RUNBOOK.md`. **Não executar
neste lote.**
