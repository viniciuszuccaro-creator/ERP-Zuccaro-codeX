# Consolidação Site CPA + ERP Zuccaro — Base para ERP-RUNTIME-04

## Finalidade

Este documento consolida decisões recuperadas das conversas `Site cpa - base44` e `ERP CPA - Codex e Cursor` para que a evolução do ERP não perca requisitos funcionais enquanto a nova runtime é consolidada.

Ele complementa `AGENTS.md`, `PLANO_GO_LIVE.md`, `PLANO_MELHORIA_ERP_ZUCCARO.md` e `STATUS_DO_PROJETO.md`. Não cria plano concorrente e não autoriza implementação paralela.

## Ponto técnico confirmado no GitHub em 17/09/2026

A `main` já incorporou o ERP-RUNTIME-03 e correções posteriores relacionadas a Produto MASTER DATA, tenant, seed convergente e visibilidade de soft-delete.

Commits relevantes recentes:

- `cbb12e7` — implementa ERP-RUNTIME-03: Produto MASTER DATA com FK tenant;
- `e4fb0ed` — documenta incorporação FF do ERP-RUNTIME-03 na main;
- `04bcad2` / `3db2728` / `548830c` — correções e incorporação do seed tenant;
- `6626038` / `314d678` / `fe8d99b` / `d7d027d` — seed convergente e reconciliação de estado parcial;
- `42698ce` / `e06a41b` / `9ac20ce` — soft-delete de Produto fora das listagens padrão e incorporação na main.

Portanto, ERP-RUNTIME-04 deve partir da `main` atual e preservar integralmente RUNTIME-01/02/03 e os fixes posteriores.

## Decisões recuperadas do Site CPA

### 1. Site existente

O site da CPA já existe. Não criar outro site. O ERP Zuccaro deve funcionar como backoffice transacional e fonte de verdade para catálogo, cliente, preço, estoque, orçamento, pedido, produção, faturamento, financeiro, entrega e pós-venda.

### 2. Integração omnichannel

Todos os canais devem convergir para os mesmos contratos do ERP:

- ERP/vendedor;
- balcão/televendas;
- Site CPA;
- B2B;
- Portal do Cliente;
- Chatbot/WhatsApp;
- App;
- Mercado Livre;
- Shopee;
- TikTok Shop;
- demais marketplaces/APIs autorizados.

Não criar entidades de pedido independentes por canal. O Pedido é único e recebe metadados de origem/canal, identificador externo, integração e correlação.

### 3. Comercial como ponto forte

O Comercial será a principal interface operacional dos vendedores. O vendedor deve conseguir fazer e visualizar quase tudo relacionado ao cliente sem receber acesso administrativo irrestrito aos módulos especializados.

Cadastros, Financeiro, Fiscal, Estoque, Produção e Logística continuam como motores especializados e fontes oficiais. O Comercial apresenta visões e ações permitidas pelo RBAC.

### 4. Novo Pedido com Visão 360º do Cliente

Ao selecionar o cliente, disponibilizar conforme permissão:

- cadastro e contatos;
- endereços e obras;
- limite de crédito e crédito disponível;
- títulos vencidos/a vencer;
- comportamento de pagamento;
- pedidos e orçamentos anteriores;
- quantidade/peso/faturamento/margem;
- últimos preços e descontos;
- tabela de preço;
- 20 produtos mais comprados com recompra;
- entregas/devoluções/ocorrências;
- produção em andamento;
- conversas de atendimento;
- pedidos de site/portal/marketplace;
- documentos/projetos;
- alertas e sugestões de IA.

A visão 360º não duplica dados: consulta os módulos proprietários com RBAC e contexto multiempresa.

### 5. Armação 2.0

A Armação deve ser um motor compartilhado entre Site, Comercial, Engenharia, Produção, Estoque, Expedição e Faturamento.

Deve suportar tipos existentes como Viga, Coluna, Estaca, Bloco, Sapata e demais elementos já implementados, preservando ícones e fluxos atuais.

Cada peça deve poder guardar obra, etapa, pavimento/ponto, posição, revisão, bitolas, dimensões, quantidade, peso principal, estribos, arame, perda prevista, custo, cronograma e rastreabilidade.

Fluxo esperado:

`Projeto/entrada → orçamento → aprovação → Pedido → OP → reserva/consumo → produção → inspeção → etiqueta/QR → romaneio → faturamento parcial/total → entrega`.

### 6. Leitura inteligente de projetos

O cliente pode enviar projeto pelo Site, Portal, Chatbot ou Comercial. Reutilizar o mecanismo de leitura de projeto/IA já existente quando aplicável.

A IA pode extrair e sugerir:

- elementos;
- medidas;
- bitolas;
- posições;
- quantidades;
- peso;
- BOM/lista de materiais;
- perdas;
- orçamento preliminar;
- comparação de revisões.

Nenhuma interpretação técnica crítica deve ir diretamente à produção sem revisão/confirmação humana autorizada.

O projeto precisa de revisão (`Rev. 00`, `Rev. 01`, etc.). Pedido e Produção devem guardar a revisão congelada aprovada.

### 7. Corte e Dobra de vergalhão

Preservar lançamento manual e importação assistida. Evoluir plano de corte, aproveitamento, sobras reutilizáveis, sucata, etiquetas, posições, revisão, OP, estoque, inspeção, romaneio e faturamento por etapa.

### 8. Corte e Dobra de chapa

Adicionar a capacidade ao Pedido/Engenharia reutilizando componentes de projeto, produção e custos existentes sempre que possível.

O projeto de chapa deve aceitar anexos técnicos suportados e controlar material, espessura, largura, comprimento, quantidade, peso, área, dobras, ângulos, raios, furos, recortes, acabamento, solda, pintura/tratamento, tolerância e revisão.

Fluxo: `projeto → análise → orçamento → aprovação → plano de corte → corte → dobra → solda/acabamento → inspeção → produto final → expedição/faturamento`.

### 9. Projetos especiais do cliente

Permitir anexar projeto de peça/estrutura especial e transformar o projeto aprovado em BOM + roteiro de fabricação + custo + preço + Pedido + Produção, sem redigitação e sem criar produto duplicado quando já houver mestre equivalente.

### 10. Produtos fabricados para Site/Marketplace

A CPA pretende fabricar produtos de tubo industrial/metalon, chapa, barra e outros materiais para Site e marketplaces.

Produto fabricado precisa de ficha industrial além da ficha comercial:

- SKU/código mestre;
- descrição comercial/técnica;
- imagens;
- dimensões e peso;
- embalagem;
- materiais;
- BOM;
- roteiro de fabricação;
- desenho CAD/desenho técnico;
- revisão;
- custo;
- preço por canal;
- estoque;
- política fabricar para estoque/sob pedido/misto;
- tempo médio e lote mínimo;
- manual e certificados quando aplicável.

### 11. CAD, BOM e roteiro

O mesmo produto técnico pode ter desenhos CAD, vistas, posições numeradas, tolerâncias, soldas e sequência de montagem.

BOM deve explodir matérias-primas e componentes. Roteiro deve definir operações como corte, furação, dobra, solda, acabamento, pintura, inspeção e embalagem, com máquina/tempo/custo quando disponível.

### 12. Produto montado e kit desmontado

Um mesmo projeto técnico pode gerar versões comerciais distintas, por exemplo produto montado e kit desmontado, cada uma com SKU/embalagem/preço próprios, mas vinculadas ao mesmo projeto/BOM/revisão base.

Kit fechado deve possuir composição exata, manual de montagem, peças numeradas, ferragens, QR Code e, quando aplicável, vídeo/guia.

### 13. B2B

Preparar Site/ERP para:

- login por CNPJ/contato;
- múltiplos compradores por cliente;
- obras e múltiplos endereços;
- tabela/preço contratado;
- preço por quantidade;
- limite/crédito;
- condição de pagamento;
- orçamento e aprovação;
- compra faturada;
- PIX/boleto/cartão/link;
- recompra;
- favoritos;
- pedido rápido;
- anexar projeto;
- acompanhar produção/entrega;
- segunda via e documentos.

### 14. Estoque e reserva omnichannel

Não expor apenas estoque físico. Definir disponibilidade de venda considerando físico, reservado, bloqueado, comprometido e política por canal/empresa/local.

Checkout e pedidos externos precisam de reserva transacional/idempotente para impedir overselling entre vendedor, site e marketplaces.

### 15. Preço por canal

Tabela de Preço continua centralizada. Deve suportar regras por empresa, cliente, canal, quantidade, unidade, condição, contrato, promoção e custos/taxas de marketplace.

### 16. Financeiro e pagamentos

Pedido externo deve usar o Financeiro oficial. PIX, boleto, cartão/link, crédito B2B e marketplace devem gerar títulos, eventos de recebimento, compensação e conciliação sem duplicidade.

Webhook repetido não pode duplicar pagamento/baixa.

### 17. Fiscal

A origem pode ser Grupo/canal externo, mas a empresa jurídica responsável deve ser determinada antes do faturamento. NF usa certificado, série, estoque e regra fiscal da empresa responsável.

### 18. Logística e pós-venda

Pedidos externos devem seguir Expedição/Roteirizador/App Motorista existentes. Retirada, entrega própria, transportadora, janela, prova de entrega, ocorrência, devolução/reversa e reentrega devem voltar ao Pedido, Portal, Chatbot, Estoque e Financeiro.

## Direção do ERP-RUNTIME-04

ERP-RUNTIME-04 não deve tentar implementar todo o Comercial/Site/Marketplace de uma vez. Ele deve construir o próximo contrato runtime mínimo que permita evoluir com segurança e baixo retrabalho.

Antes de editar, o agente deve ler `AGENTS.md`, verificar a `main` atual e identificar no plano/status qual agregado é o próximo P0 depois de Produto MASTER DATA.

A escolha de RUNTIME-04 deve obedecer:

1. preservar migrations 001–008 e fixes posteriores já incorporados;
2. não misturar preço, estoque e fiscal dentro do Produto MASTER DATA;
3. manter tenant/multiempresa fail-closed;
4. manter soft-delete e auditoria;
5. criar somente o contrato mínimo necessário para o próximo agregado;
6. preparar a futura integração do Pedido 360º, Site/B2B e marketplace sem antecipar módulos inteiros;
7. testes E2E DEV antes de merge;
8. migrations idempotentes/convergentes quando aplicável;
9. branch pequena e reversível;
10. atualizar `STATUS_DO_PROJETO.md` ao final.

## Diagnóstico concluído (2026-09-17) — aguardando autorização de implementação

**Base Git:** `main` @ `90a99a4f`
**Branch de registro:** `cursor/erp-runtime-04-diagnostico-392b`
**Implementação RUNTIME-04:** ainda **não** iniciada.

### Estado da main confirmado no clone

Presentes: ERP-RUNTIME-01, 02, 03; Produto MASTER DATA; FK/isolamento tenant; seed tenant; seed convergente/reconciliação; soft-delete de Produto fora das listagens padrão. Produto permanece fora de `HTTP_PILOT_ENTITIES`.

### Migrations 001–008 no DEV

| Item | Resultado |
|---|---|
| Arquivos no Git | `001`…`008` presentes em `server/migrations/` |
| Controle | tabela `schema_migrations` (`server/src/db/migrate.ts`) |
| Confirmação real no Postgres DEV | **NÃO POSSÍVEL neste ambiente** (`DATABASE_URL` ausente; sem Hostinger) |

**Status (diagnóstico inicial):** `BLOCKED — MIGRATION PENDENTE` **de confirmação real no DEV** (não se afirma falta de migration; afirma-se falta de prova no banco pelo Cloud Agent).

### Precheck DEV resolvido (2026-09-17) — READY

Verificação **manual read-only** no VPS DEV confirmou `schema_migrations` com `001`–`008` OK; 11 tabelas RUNTIME-01/02/03 OK; `produtos.ativo` OK; seeds sintéticos (groups=2, marcas=3, produtos=2). Nenhuma migration/apply/alteração de dados. Detalhe em `STATUS_DO_PROJETO.md` → **ERP-RUNTIME-04 — DEV PRECHECK APROVADO**. Implementação Cliente ainda **não** autorizada neste registro.

Antes de implementar RUNTIME-04, humano no VPS deve confirmar:

```bash
node dist/db/migrate.js --status
# ou: SELECT id FROM schema_migrations ORDER BY id;
```

e garantir as oito entradas. Se faltar alguma, aplicar via runbook antes de autorizar o lote.

### Baseline no clone (pré-implementação)

| Check | Resultado |
|---|---|
| `npm run audit:baseline` | OK |
| `npm test` (frontend) | 570/570 |
| `npm run lint` | OK |
| `npm run typecheck` | EXIT 2 — baseline histórico (ex.: Financeiro/Relatorios) |
| `npm run build` | OK |
| `git diff --check` | OK |
| `server npm test` | 31 pass + 1 skip |
| `server npm run build` | OK |

### Inventário resumido dos candidatos

| Candidato | Situação | Decisão |
|---|---|---|
| Produto | RUNTIME-03 fechado (mestre; sem preço/estoque/fiscal operacional) | Não expandir agora |
| Marca / Unidade / GrupoProduto / SetorAtividade | RUNTIME-01/02 | Já migrados |
| Categoria / Fabricante / Subgrupo | Não existem no ERP | Não inventar |
| TabelaPreco | Existe; regras/histórico; adiada no R02 | Lote futuro (maior) |
| Setor de armazenamento | Não bloqueia Pedido/Site imediato | Fora deste lote |
| Pedido | Operacional | Não é o próximo mestre |
| **Cliente** | Entidade `Cliente` em Cadastros/Pessoas; PF/PJ via `tipo`; UI/`localCadastroMasterPolicy` existentes; shared entity no localBase44 | **Agregado recomendado** |

### Agregado recomendado

**Cliente** (MASTER DATA mínimo — não Cliente 360º completo).

Justificativa: próximo P0 após Produto para Pedido 360º, Site/B2B, Portal e Marketplace; reutiliza entidade/UI existentes; lote pequeno e testável; compatível com RUNTIME-01/02/03; não exige antecipar preço/estoque dentro do Produto.

### Escopo previsto (somente após autorização)

- Migration **009+** (001–008 imutáveis)
- Backend Cliente: tenant, código sequencial concorrente, CPF/CNPJ, soft-delete, list/search/count, auditoria, RBAC
- Seed sintético A/B Cliente
- Docs/STATUS + testes E2E DEV
- Frontend HTTP piloto: **não** ativar neste lote salvo autorização explícita

### Fora de escopo

Cliente 360º completo · Comercial novo · Site/Marketplace · CAD/BOM/Armação · Financeiro/IA · hard delete · alterar 001–008 · desfazer fixes RUNTIME-03.

### Branch prevista de implementação (ainda não criada para código)

`cursor/erp-runtime-04-cliente-master-data-392b` — somente após confirmação das migrations no DEV + autorização explícita.

## Reestruturação definitiva

A Regra-Mãe permanece, mas não deve impedir correção arquitetural. É permitido reorganizar/substituir profundamente uma estrutura existente quando houver diagnóstico de que ela impede segurança, performance, integração, escalabilidade ou evolução. Nesses casos exigir diagnóstico, dependências, migração, compatibilidade, testes e rollback.

O núcleo futuro deve conectar:

`Cadastros Gerais → Comercial 360º → Engenharia/Projetos → Estoque/Compras → Produção → Fiscal/Financeiro → Expedição/Logística → Portal/Chatbot/Site/B2B/Marketplace → BI/IA/Agentes`.

O Comercial é o centro de experiência do vendedor; os módulos especializados continuam proprietários de suas regras e dados.
