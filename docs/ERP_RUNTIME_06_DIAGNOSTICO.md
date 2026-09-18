# ERP-RUNTIME-06 — Diagnóstico arquitetural

**Status:** `DIAGNÓSTICO SOMENTE`
**Base:** `7c29f234670cb965f02315a5f1adc15590521a0f`
**Escopo analisado:** locais, endereços, obras, entrega e geolocalização.

## 1. Decisão

O agregado recomendado para o ERP-RUNTIME-06 é:

> **Local do Cliente — endereço físico canônico com finalidades**

Decisão correspondente à alternativa **A**, ajustada ao código real:

- Local é o agregado principal;
- Endereço é o value object físico do Local, não outro cadastro;
- Obra, no escopo inicial, é uma finalidade/tipo de Local;
- Projeto e Centro de Custo referenciam o Local/Obra, mas permanecem em seus
  módulos proprietários;
- uma extensão `obras` separada só será justificada quando houver lifecycle
  técnico próprio além do endereço (projeto, início/fim, engenharia etc.).

Não criar `EnderecoClienteNovo`, `LocalNovo`, `EnderecoPedido` ou
`EnderecoObraNovo`.

## 2. Estruturas existentes

### Cliente/Base44

| Estrutura | Shape atual | Papel |
|---|---|---|
| `Cliente.endereco_principal` | objeto embutido | endereço cadastral/faturamento |
| `Cliente.locais_entrega[]` | array embutido | entrega, cobrança, matriz, obra e outro |
| `Cliente.contatos[]` | array embutido | contatos gerais |
| `ContatoB2B` | entidade separada | contatos autorizados B2B/Portal |

O formulário canônico é
`src/components/cadastros/CadastroClienteCompleto.jsx`, que usa
`GerenciarEnderecosClienteForm.jsx` e `GerenciarContatosClienteForm.jsx`.
PostgreSQL RUNTIME-04/05 não possui endereço/local.

### Pedido e snapshots

- `Pedido.obra_destino_id` e `obra_destino_nome`: referência/rótulo do local;
- `Pedido.endereco_entrega_principal`: snapshot do endereço escolhido;
- `Entrega.endereco_entrega_completo`: snapshot logístico derivado do Pedido;
- `Entrega.contato_entrega`: snapshot do recebedor/instruções;
- NF usa outro snapshot, `cliente_endereco`.

O fluxo dominante já é, parcialmente:

```text
Cliente.locais_entrega[id]
  → Pedido.obra_destino_id + endereco_entrega_principal
  → Entrega.endereco_entrega_completo
```

### Cadastros relacionados, mas distintos

- `LocalEstoque`: local operacional de estoque, não endereço de Cliente;
- `CentroOperacao`: CD/obra/depósito com geolocalização, consumo limitado;
- `Empresa.endereco`: origem/fiscal da empresa do Grupo;
- `RotaPadrao`: origem/destino textuais;
- `RegiaoAtendimento`: cidades/faixas de CEP;
- `Projeto` e `CentroCusto`: referenciam obra no Site CPA;
- `PosicaoVeiculo`: telemetria/GPS, não endereço master.

Não existe entidade Base44 canônica `TipoEndereco`, `TipoLocal` ou `Obra`
consumida pelo cadastro. O vocabulário está hardcoded nos forms/policies.

Contagens textuais aproximadas (não são grafo de dependências):

- endereço principal/locais de entrega: 38 arquivos;
- obra/tipo/IDs: 29;
- snapshots Pedido/Entrega/NF: 78;
- geolocalização/mapas: 53;
- LocalEstoque/CentroOperacao/RotaPadrao: 49;
- contatos locais/B2B/Entrega: 54.

## 3. Duplicidades e inconsistências

1. `CadastroClienteCompleto` é o fluxo ativo; `ClienteFormCompleto` é legado
   sem import funcional; gerenciadores em `comercial/` estão órfãos.
2. UI grava `tipo_endereco: "Obra"`; Site CPA lê `tipo`/`type` ou `obra=true`.
   Uma obra UI pode ser classificada como entrega no S2S.
3. Locais sem ID usam `temp-{índice}` ou `obra-{índice}`; referências deixam de
   ser estáveis após reordenação.
4. `mapa_url`, `link_mapa`, `link_google_maps` e `google_maps_url` representam
   o mesmo link com nomes diferentes.
5. Coordenadas aparecem como `latitude/longitude`, `lat/lng` e `lat/lon`.
6. Contatos estão em `Cliente.contatos[]`, `ContatoB2B`,
   `locais_entrega.contato_*`, `Pedido.contatos_cliente` e
   `Entrega.contato_entrega`.
7. `SeletorEnderecoEntregaPedido` inclui o principal; o seletor da Expedição
   lista apenas `locais_entrega`.
8. `onOrcamentoConfirmed` não copia endereço/obra para o Pedido convertido.
9. `siteCpaPortal.recordWorkId` não considera `obra_destino_id`, embora Site
   CPA Order/Quote grave esse campo.
10. Janelas do local (`horario_inicio/fim`) não são propagadas de forma
    uniforme para `janela_entrega_inicio/fim`.
11. Marketplace cria snapshot e, em alguns fluxos, endereço principal do
    Cliente, sem associação/fingerprint canônico.

Nenhuma dessas estruturas deve ser apagada automaticamente. A transição exige
aliases, backfill, dupla leitura controlada e homologação antes do cutover.

## 4. Modelo recomendado

### Cliente

Cliente MASTER continua identidade única no Grupo. Não adicionar dezenas de
colunas em `clientes`.

### Cliente × Empresa

`cliente_empresas` responde elegibilidade comercial por Empresa. Não deve
duplicar o endereço físico.

Uma preferência futura, como “local padrão de entrega para a CPA”, pode
referenciar um Local canônico no relacionamento, mas não torna o Local
propriedade exclusiva daquela Empresa.

### Local

Ownership proposto:

```text
clientes (Grupo)
  └─ cliente_locais (Grupo, Cliente)
       └─ finalidades: CADASTRAL/FISCAL/COBRANCA/ENTREGA/OBRA/
                       CORRESPONDENCIA/OUTRO
```

Campos mínimos prováveis:

- UUID e código interno estável;
- `group_id`, `cliente_id`;
- nome/apelido;
- CEP, logradouro, número, complemento, bairro, cidade, UF, país e referência;
- latitude/longitude opcionais;
- status geocoding/origem da coordenada, sem acoplamento a provider;
- ativo, origem e legado/importação;
- created/updated by/at.

O mesmo Local pode ter múltiplas finalidades. Finalidade não deve exigir cópia
física do endereço. “Principal” deve ser definido por finalidade, com
unicidade controlada.

Tabela provável:

- `cliente_locais`;
- opcionalmente `cliente_local_finalidades` se o contrato relacional for
  preferível a `TEXT[]`.

Não usar tabela genérica polimórfica para Cliente, Empresa, Fornecedor e
Transportadora agora: vários masters ainda não existem no PostgreSQL e FKs
ficariam frágeis. Reutilizar normalizadores/componentes, não ownership.

### Obra

O código atual comprova “Obra = Local de tipo/finalidade OBRA”:

- Wizard usa o ID do item de `locais_entrega`;
- Site CPA usa `addressId` como `obraId`;
- Projeto/CC referenciam esse ID.

Portanto, RUNTIME-06 não precisa criar `obras` para repetir logradouro.
Campos de endereço, coordenada, janela, restrição e instrução ficam no Local.

Classificação futura:

| Campo | Domínio |
|---|---|
| código/nome/status da obra | Obra/Local |
| endereço/coordenadas | Local |
| responsável/telefone/e-mail | Contato referenciado; snapshot na operação |
| horário, restrição de veículo, instruções | preferência logística do Local |
| centro de custo | Financeiro |
| projeto/BOM/revisão | Projeto/Engenharia |
| início/previsão de término | futura extensão Obra |

Se lifecycle técnico próprio for comprovado, uma tabela `obras` poderá
referenciar `cliente_local_id` um-para-um, sem copiar endereço.

### LocalEstoque e Empresa

- `LocalEstoque` permanece posição/estrutura operacional de estoque;
- pode futuramente referenciar um endereço físico próprio, mas não um Local de
  Cliente;
- `Empresa.endereco` continua separado por finalidade fiscal/origem logística;
- validadores de CEP/endereço/coordenada podem ser compartilhados.

## 5. Referência canônica e snapshot imutável

Pedido/Orçamento/Entrega devem possuir:

1. referência ao `cliente_locais.id`;
2. snapshot imutável capturado no momento transacional.

Snapshot recomendado:

- Local/obra ID, código, nome e finalidade;
- CEP, logradouro, número, complemento, bairro, cidade, UF e país;
- coordenadas válidas quando relevantes;
- instrução logística crítica, janela e restrição;
- contato de recebimento estritamente necessário;
- `captured_at` e versão/hash do snapshot.

Regras:

- editar Local amanhã não altera Pedido, NF ou Entrega antigos;
- telas históricas usam snapshot, não reidratam do master;
- criação/conversão resolve referência tenant-scoped e grava snapshot;
- orçamento → pedido copia referência e snapshot;
- Marketplace preserva snapshot original, normaliza e só sugere vínculo ao
  master; não cria/mescla Local automaticamente;
- endereço manual transacional permanece snapshot com origem, sem contaminar o
  master.

Snapshot é dado transacional e fica fora da migration RUNTIME-06 enquanto
Pedido não estiver no PostgreSQL.

## 6. CEP e geolocalização

Implementações atuais:

- `BuscaCEP.jsx`: ViaCEP + Nominatim diretamente no browser;
- `BuscaDadosPublicos.jsx`: ViaCEP + Nominatim com User-Agent;
- Google Maps: links e Directions na roteirização;
- browser GPS: App Motorista/assinatura;
- IA/placeholders em alguns forms/mapas.

Recomendação futura:

- validar CEP localmente (8 dígitos) e permitir confirmação manual;
- ViaCEP/Nominatim são enriquecimento, não fonte de autorização;
- geocoding deve ficar atrás de provider adapter, rate limit, timeout/cache e
  consentimento/PII mínimo;
- armazenar coordenadas normalizadas e sua precisão/origem, não URL específica
  do provider;
- latitude entre -90/90 e longitude entre -180/180;
- mapa é derivado; segredo/provider key nunca vai ao audit/frontend.

## 7. Expedição, roteirização e App Motorista

- Expedição deve receber snapshot do Pedido e não consultar Local mutável para
  histórico;
- Roteirizador usa coordenadas, janela, cidade, restrição e prioridade do
  snapshot da Entrega;
- `RotaPadrao` textual não substitui coordenadas do Local;
- App Motorista recebe nome do local/obra, snapshot, contato necessário,
  instruções, rota e documentos da Entrega;
- telemetria `PosicaoVeiculo` continua separada;
- canhoto, assinatura, fotos e ocorrências continuam na Entrega;
- `obra_destino_id` deverá ser propagado para Entrega/Portal quando esses
  agregados forem migrados.

RUNTIME-06 prepara os IDs/coordinates; não implementa rota, app ou entrega.

## 8. Site, B2B, Portal e Marketplace

- Site CPA já produz `addresses[]` em `buildCustomerAddresses`;
- `addressId` deve migrar para o UUID canônico do Local;
- DELIVERY exige Local autorizado + snapshot; PICKUP usa Local da Empresa;
- B2B/Portal podem solicitar novo Local, mas a criação exige RBAC/approval e
  tenant;
- Marketplace mantém endereço recebido como snapshot e usa matching
  conservador para sugerir Local;
- nenhum canal possui cadastro paralelo.

## 9. Duplicidade e legado

Normalização candidata:

- CEP só dígitos;
- UF uppercase;
- textos trim/casefold/remoção controlada de espaços;
- número e complemento preservados;
- fingerprint por Grupo + Cliente + CEP + logradouro + número + complemento +
  cidade + UF.

O fingerprint gera `POSSIBLE_DUPLICATE`; não faz merge automático. Apartamentos,
salas, portões e obras no mesmo endereço podem ser registros legítimos.

Migração futura:

- staging de `endereco_principal` e `locais_entrega[]`;
- atribuir UUID/código sem mudar arrays legados;
- preservar `legacy_id`, `legacy_code`, `source_system`, `migration_batch`;
- mapear ID legado/índice → UUID;
- relatório de conflito e decisão humana;
- reexecutável/idempotente, sem migração massiva no primeiro apply.

Local deve ter UUID estável. Código humano sequencial é justificável para obras
e migração; se aprovado, reutilizar
`reserve_entity_codigo(group_id, 'ClienteLocal')`, nunca `count + 1`.

## 10. Multiempresa, RBAC, RLS e auditoria

### Multiempresa

- Local do Cliente pertence ao Grupo e ao `cliente_id`;
- Empresa só usa Local quando possui `cliente_empresas` elegível/autorizado;
- Local não precisa ser duplicado para CPA/3Z;
- preferência/restrição específica da Empresa pertence a relacionamento, não
  ao endereço físico;
- Grupo autorizado consolida; Grupo B recebe 404/zero acesso.

### RBAC provável

- `cadastros.local-cliente.visualizar`;
- `cadastros.local-cliente.criar`;
- `cadastros.local-cliente.editar`;
- `cadastros.local-cliente.inativar`;
- `cadastros.local-cliente.restaurar`;
- permissão própria para alterar coordenada/endereço confirmado;
- usar Local no Pedido não concede edição cadastral.

Não criar sistema paralelo: reutilizar `PostgresRbacGuard`.

### Segurança/auditoria

- schemas estritos, allowlist, limites, UUID/CEP/UF/coordenadas;
- RLS ENABLE/FORCE sem contexto;
- integridade Cliente/Grupo no banco;
- sanitização de textos/URLs e proteção contra mass assignment;
- auditoria create/update/inactivate/restore e mudança de endereço/coordenada,
  vínculo/finalidade/responsável;
- mutação + auditoria atômicas pelo padrão RUNTIME-05;
- audit snapshot redigido: não replicar contato/endereço completo sem
  necessidade; registrar campos alterados, local ID e metadados seguros;
- geocoding com rate limit/cache e sem segredos.

## 11. Migration/API prováveis — não criadas

Migration sugerida:

`011_cliente_locais.sql`

Escopo provável:

- `cliente_locais`;
- finalidades em coluna controlada ou `cliente_local_finalidades`;
- indexes/fingerprint de possível duplicidade;
- integridade Cliente/Grupo;
- RLS, lifecycle, origem/legado e actors.

API provável:

- `GET/POST /api/v1/clientes/:clienteId/locais`;
- `GET/PATCH/DELETE /api/v1/clientes/:clienteId/locais/:localId`;
- `POST .../:localId/restore`;
- list/search/count/paginação/filtros por finalidade/cidade/UF/ativo.

Não ativar frontend HTTP no diagnóstico.

## 12. E2E proposto

1. Cliente A cria Local A e Local Obra A;
2. mesmo Local recebe múltiplas finalidades sem duplicar endereço;
3. IDs/códigos permanecem estáveis;
4. Grupo A consolida;
5. Empresa com ClienteEmpresa elegível usa o Local;
6. Empresa A2 não autorizada é bloqueada;
7. Grupo B não lê/get/patch/inativa/restaura Local A;
8. Cliente/Local cross-group é bloqueado no banco;
9. fingerprint formatado/não formatado sinaliza possível duplicidade sem merge;
10. apartamentos/complementos distintos permanecem separados;
11. soft delete remove da listagem operacional; restore retorna;
12. paginação/count/busca fora da primeira página e filtros cidade/UF/tipo;
13. RLS fail-closed;
14. auditoria atômica before/after e rollback em falha;
15. seed duplo converge;
16. snapshot de Pedido somente quando Pedido existir no PostgreSQL.

Seed futuro: Grupo A/Cliente A com Local matriz e duas obras; Grupo B/Cliente B
com Local B; variações de finalidade, complemento e status, todos sintéticos.

## 13. Dependências e fora de escopo

Dependências:

- Cliente MASTER e ClienteEmpresa (concluídos);
- `entity_code_sequences` se código sequencial for aprovado;
- normalizadores CEP/endereço/coordenadas extraídos do fluxo existente;
- decisão posterior sobre Contato canônico.

Fora do RUNTIME-06:

- Pedido/Orçamento e seus snapshots PostgreSQL;
- Entrega, Expedição, Rota, frete e App Motorista;
- LocalEstoque/CentroOperacao/Empresa/Fornecedor/Transportadora;
- ContatoB2B/contato mestre;
- Projeto, Centro de Custo, Armação 2.0 e Produção;
- provider/geocoding novo;
- Site/Portal/B2B/Marketplace;
- Cliente/Comercial 360º;
- migração massiva e ativação `HTTP_PILOT_ENTITIES`.

## 14. Baseline

- `npm run audit:baseline`: PASS;
- `npm run lint`: PASS;
- `npm run typecheck`: baseline histórico (exit 2), sem alteração funcional ou
  erro novo causado pelo diagnóstico;
- `npm run build`: PASS;
- `git diff --check`: PASS.
