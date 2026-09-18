# ERP-RUNTIME-06 — Diagnóstico arquitetural

**Status:** `DIAGNÓSTICO SOMENTE`
**Base:** `7c29f234670cb965f02315a5f1adc15590521a0f`
**Escopo analisado:** locais, endereços, obras, entrega e geolocalização.

**Atualização 2026-09-18 (06B):** o RUNTIME-06A foi implementado na main
`067d002f`. O modelo **oficial** de Obra está em
`docs/ERP_RUNTIME_06B_DIAGNOSTICO.md` e **substitui** o rascunho de FK
única abaixo.

- **Modelo original deste diagnóstico 06:** `obras.cliente_local_id`
  obrigatório (um Local por Obra).
- **Refinamento oficial 06B:** `obra_locais` N:N tipado + `obra_empresas`.
- Motivo: uma Obra pode ter local físico, portaria, entrega, administrativo,
  fiscal e outros pontos; várias Obras podem reutilizar o mesmo
  ClienteLocal. A FK única nascia incompleta.
- Obra **não** é finalidade de ClienteLocal. Pedido futuro **não** exige Obra.

## 1. Decisão

O domínio recomendado para o ERP-RUNTIME-06 é:

> **Local/Endereço do Cliente + Obra referenciando Local**

Decisão correspondente ao **modelo C** (Endereço/Local como base + entidade
específica referenciando-o), entregue em dois sublotes:

- **RUNTIME-06A:** Local do Cliente, endereço físico e finalidades;
- **RUNTIME-06B:** Obra mínima (`obras` + `obra_empresas` + `obra_locais`);
  ver diagnóstico especializado 06B (modelo final). O rascunho “FK Local
  única” deste documento foi **refinado**, não apagado.
- Endereço é o value object físico do Local, não outro cadastro;
- Projeto e Centro de Custo referenciam Obra, mas permanecem proprietários de
  seus dados.

Não criar `EnderecoClienteNovo`, `LocalNovo`, `EnderecoPedido` ou
`EnderecoObraNovo`.

### Comparação dos modelos

| Modelo | Aderência ao código/domínio | Decisão |
|---|---|---|
| A — Endereço + Obra separados | separa conceitos, mas Endereço solto tende a owner polimórfico/FKs frágeis | não usar isoladamente |
| B — Local universal tipado | próximo do legado, porém mistura Cliente, Empresa, Estoque e Obra | rejeitado por abstração excessiva |
| **C — ClienteLocal base + Obra referenciando** | preserva `locais_entrega/addressId`, separa lifecycle da Obra e evita copiar endereço | **selecionado** |
| D — manter JSON embutido | máxima compatibilidade imediata, mas IDs/tipos não são estáveis nem consultáveis no PostgreSQL | apenas camada de transição |

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
       └─ finalidades: CADASTRAL/FISCAL/COBRANCA/ENTREGA/
                       CORRESPONDENCIA/OUTRO
```

Campos mínimos prováveis do Local:

- UUID estável (substitui IDs temporários por índice);
- `group_id`, `cliente_id`;
- nome/apelido;
- CEP, logradouro, número, complemento, bairro, cidade, UF, país e referência;
- latitude/longitude opcionais;
- status geocoding/origem da coordenada, sem acoplamento a provider;
- ativo, origem e legado/importação;
- created/updated by/at.

O mesmo Local pode ter múltiplas finalidades. Finalidade não deve exigir cópia
física do endereço. “Principal” deve ser definido por finalidade, com
unicidade controlada por `(cliente_id, finalidade)`; um Local pode ser principal
para várias finalidades.

Tabela provável:

- `cliente_locais`;
- `cliente_local_finalidades`, para múltiplos usos e principal por finalidade
  sem duplicar o endereço.

Não usar tabela genérica polimórfica para Cliente, Empresa, Fornecedor e
Transportadora agora: vários masters ainda não existem no PostgreSQL e FKs
ficariam frágeis. Reutilizar normalizadores/componentes, não ownership.

### Obra

O legado comprova que Obra hoje é tratada como Local de tipo/finalidade OBRA:

- Wizard usa o ID do item de `locais_entrega`;
- Site CPA usa `addressId` como `obraId`;
- Projeto/CC referenciam esse ID.

Isso deve ser preservado durante a transição, mas não é o modelo final: Obra é
contexto comercial/operacional com nome, código, status e vários Projetos;
Endereço é apenas localização física. Um endereço de cobrança não é Obra.

No modelo final, **OBRA não é finalidade de ClienteLocal**. Finalidades
descrevem somente o uso do endereço físico: CADASTRAL, FISCAL, COBRANCA,
ENTREGA, CORRESPONDENCIA e OUTRO.

**Modelo original (rascunho 06):** tabela `obras` com `cliente_local_id`
obrigatório, sem repetir logradouro.

**Modelo oficial (diagnóstico 06B):** `obras` **não** guarda endereço nem um
único `cliente_local_id`. A relação canônica é
`obras → obra_locais → cliente_locais`, com `uso_na_obra` e **um** Local
principal geral por Obra. Autorização por Empresa: `obra_empresas`.

O alias legado `obra_destino_id = addressId` deve ser mapeado no cutover
para **dois** UUIDs distintos (`cliente_local_id` e `obra_id`);
`addressId ≠ obraId` no modelo final.

Classificação futura:

| Campo | Domínio |
|---|---|
| código/nome/status da obra | Obra |
| endereço/coordenadas | Local |
| responsável/telefone/e-mail | Contato referenciado; snapshot na operação |
| horário, restrição de veículo, instruções | preferência logística do Local |
| centro de custo | Financeiro |
| projeto/BOM/revisão | Projeto/Engenharia |
| início/previsão de término | Obra |

Cardinalidade oficial (06B): uma Obra pertence a um Cliente comercial
(`cliente_id` = comprador/operador no ERP, não necessariamente o
proprietário do imóvel) e referencia **N** Locais via `obra_locais`.
Consórcios/múltiplos clientes/responsáveis são extensão futura por
relacionamento, sem superdimensionar o 06B.

Várias Obras podem referenciar o mesmo Local; não criar UNIQUE do Local.
Inativar Obra não inativa Local. Inativar Local com `obra_locais` ativo de
Obra ativa deve ser bloqueado ou exigir desvínculo/substituição explícita,
sem cascade. Se for o principal, outro principal entra na mesma transação.

Obra operacional nova exige pelo menos um `obra_local` ativo e exatamente
um principal. Legado sem Local resolvido permanece em **staging de
migração** (fora deste lote); não entra como Obra operacional incompleta
e não se inventa status `INCOMPLETA`.

Obra é do Grupo + Cliente. CPA e 3Z operam a **mesma** Obra só com
`obra_empresas` ativo **e** ClienteEmpresa correspondente. Não duplicar
Obra por Empresa. Código: `reserve_entity_codigo(group_id, 'Obra', 6)`,
preservando `legacy_code`.

### LocalEstoque e Empresa

- `LocalEstoque` permanece posição/estrutura operacional de estoque;
- pode futuramente referenciar um endereço físico próprio, mas não um Local de
  Cliente;
- `Empresa.endereco` continua separado por finalidade fiscal/origem logística;
- validadores de CEP/endereço/coordenada podem ser compartilhados.

### Matriz de propriedade

| Informação | Proprietário | Regra |
|---|---|---|
| identidade CPF/CNPJ | Cliente MASTER | Grupo |
| elegibilidade/preferência empresarial | ClienteEmpresa | Empresa |
| logradouro/CEP/coordenada | ClienteLocal | master mutável |
| finalidades e principal | ClienteLocal | uma principal por Cliente/finalidade |
| nome/código/status da obra | Obra | Grupo + Cliente; Locais via `obra_locais` |
| responsável permanente | Contato/Obra | FK futura; não duplicar Pessoa |
| instrução permanente de descarga | Local/Obra | preferência do destino |
| observação/janela daquela entrega | Pedido/Entrega | transacional |
| destino vendido | Pedido | referência + snapshot |
| destino expedido/canhoto | Entrega | snapshot + evidência |
| endereço emitido | Fiscal/NF | snapshot fiscal imutável |
| rota/distância | Roteirizador | calculado a partir do snapshot |
| posição do veículo | PosicaoVeiculo | telemetria |

Não há município/código IBGE canônico localizado no cadastro atual. ViaCEP
retorna dados municipais, mas o fluxo não persiste código IBGE. RUNTIME-06A
deve aceitar o identificador fiscal validado quando houver fonte canônica, sem
criar cadastro paralelo de Município/UF/País.

## 5. Referência canônica e snapshot imutável

Pedido/Orçamento/Entrega futuros devem possuir:

1. `obra_id` **opcional**;
2. `cliente_local_id` do destino **efetivo** (não assumir o principal da Obra);
3. snapshot imutável capturado no momento transacional.

Snapshot recomendado (enxuto):

- `obra_id`, `codigo_obra`, `nome_obra` quando houver Obra;
- Local ID e uso; CEP, logradouro, número, complemento, bairro, cidade, UF, país;
- coordenadas válidas quando relevantes;
- instrução logística crítica, janela e restrição;
- contato de recebimento estritamente necessário;
- `captured_at`.

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
- identificar aliases legados `tipo_endereco=Obra`, `tipo/type=OBRA` e
  `obra=true`;
- materializar primeiro ClienteLocal e depois Obra + `obra_locais` (principal);
- atribuir UUID/código sem mudar arrays legados;
- preservar `legacy_id`, `legacy_code`, `source_system`, `migration_batch` em
  Local e Obra;
- mapear ID legado/índice/addressId → Local UUID → Obra UUID;
- aliases `addressId=obraId` e `obra_destino_id` só na transição; no modelo
  final `addressId`/`cliente_local_id` ≠ `obra_id`; não manter o alias
  ambíguo indefinidamente;
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
- `cadastros.obra.*` conforme `docs/ERP_RUNTIME_06B_DIAGNOSTICO.md`
  (visualizar/criar/editar/inativar/restaurar/vincular-empresa/
  vincular-local/principal); confirmar nomenclatura na implementação;
- `logistica.local.instrucoes` para alterar restrições permanentes;
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

Migrations sugeridas, sem criação:

- RUNTIME-06A: `011_cliente_locais.sql`;
- RUNTIME-06B: `012_obras.sql`, somente após review/E2E de 06A.

Escopo provável:

- `cliente_locais`;
- `cliente_local_finalidades`;
- finalidades limitadas a CADASTRAL/FISCAL/COBRANCA/ENTREGA/
  CORRESPONDENCIA/OUTRO; nunca OBRA;
- indexes/fingerprint de possível duplicidade;
- integridade Cliente/Grupo;
- RLS, lifecycle, origem/legado e actors.

API provável:

- `GET/POST /api/v1/clientes/:clienteId/locais`;
- `GET/PATCH/DELETE /api/v1/clientes/:clienteId/locais/:localId`;
- `POST .../:localId/restore`;
- list/search/count/paginação/filtros por finalidade/cidade/UF/ativo.

RUNTIME-06B (oficial — ver `ERP_RUNTIME_06B_DIAGNOSTICO.md`):

- `GET/POST /api/v1/clientes/:clienteId/obras`;
- `GET/PATCH/DELETE /api/v1/clientes/:clienteId/obras/:obraId`;
- `POST .../:obraId/restore`;
- subrotas de `empresas` e `locais`;
- tabelas `obras`, `obra_empresas`, `obra_locais` (não `obras.cliente_local_id`);
- um Local principal geral por Obra; criação atômica com Empresa + Local + audit;
- triggers tenant-aware; RLS ENABLE/FORCE; **nenhuma migration criada aqui**.

Não ativar frontend HTTP no diagnóstico.

## 12. E2E proposto

Casos suportados pelo modelo:

- cadastral e entrega distintos, sem trocar endereço principal;
- várias Obras com Locais próprios ou compartilhando o mesmo Local;
- Cliente/Obra compartilhados por CPA e 3Z autorizadas, sem cópia física;
- destino eventual e endereço Marketplace ficam apenas no snapshot;
- retirada referencia Local da Empresa, não ClienteLocal;
- alteração posterior do Local não muda Pedido/NF;
- Obra encerrada sai da operação, mas permanece no histórico;
- coordenadas são opcionais: ausência de geocode não bloqueia venda quando a
  política logística permitir.

1. criar Local A com finalidades CADASTRAL + COBRANCA;
2. definir um principal por finalidade, permitindo o mesmo Local em ambas;
3. criar Local B com finalidade ENTREGA;
4. criar Obra 000001 com `obra_locais` no Local B (principal geral);
5. criar Obra 000002 reutilizando o mesmo Local B;
6. confirmar que Obras não copiam endereço;
7. inativar Obra sem inativar Local;
8. bloquear inativação de Local usado por Obra ativa ou exigir reassociação;
9. Grupo A consolida; Empresa elegível usa Local/Obra;
10. Empresa A2 não autorizada e Grupo B são bloqueados;
11. Cliente/Local/Obra cross-group é bloqueado no banco;
12. fingerprint sinaliza possível duplicidade sem merge;
13. complementos distintos permanecem separados;
14. soft delete/restore e listagem operacional funcionam;
15. paginação/count/busca/filtros;
16. RBAC, RLS e auditoria atômica com rollback;
17. código Obra via `entity_code_sequences`;
18. seed duplo converge;
19. snapshot de Pedido somente quando Pedido existir no PostgreSQL.

Seed futuro: Grupo A/Cliente A com Local matriz e duas obras; Grupo B/Cliente B
com Local B; variações de finalidade, complemento e status, todos sintéticos.

## 13. Dependências e fora de escopo

Dependências:

- Cliente MASTER e ClienteEmpresa (concluídos);
- `entity_code_sequences` para código sequencial de Obra;
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

## 14. Divisão e sequência

RUNTIME-06 deve ser dividido:

- **06A — Local/Endereço do Cliente:** fonte física, finalidades, principal,
  geolocalização opcional, lifecycle, legado, API/RBAC/RLS/auditoria;
- **06B — Obra mínima:** `obras` + `obra_empresas` + `obra_locais`; código,
  status, lifecycle, RBAC/RLS/audit; sem Projeto, Produção ou Centro de Custo.
  Detalhe canônico: `docs/ERP_RUNTIME_06B_DIAGNOSTICO.md`.

A divisão mantém cada lote pequeno e impede que Obra avançada atrase Preço.
Ambos são concluídos antes da numeração seguinte:

- RUNTIME-07 — Tabela de Preço / preço comercial;
- RUNTIME-08 — Estoque, disponibilidade e reserva;
- RUNTIME-09 — Orçamento e negociação;
- RUNTIME-10 — Pedido canônico.

## 15. Baseline

- `npm run audit:baseline`: PASS;
- `npm run lint`: PASS;
- `npm run typecheck`: baseline histórico (exit 2), sem alteração funcional ou
  erro novo causado pelo diagnóstico;
- `npm run build`: PASS;
- `git diff --check`: PASS.
