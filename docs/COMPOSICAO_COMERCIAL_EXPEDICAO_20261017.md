# Candidata Comercial + Expedição, 2026-10-17

## Referência e dependências

- Base de execução #331: b3a683bba1bdd8dc3870ce4ba4eeb87430b3e561.
- Fonte Expedição #332: bf6c0068288d152d88451ff52d6234d39940143e.
- Fonte #333: 1ba4c4d25ef35d554f2a446f1c07294b574296ec (inclui #332 e contratos de reserva/compensação #330).
- main observado: baba91a6b0d5d626edd607b8cd3522927e1904ab.
- Branch da candidata: codex/comercial-composicao-20261017. PR empilhada na #331; SHA final e CI na PR.

O ensaio de merge integral revelou 38 conflitos e importava versões comerciais antigas junto de assuntos Legado independentes. Foi abortado, com patch privado de comparação. A composição funcional seletiva mantém os serviços/UI comerciais, Central360, idempotência UUID/fingerprint e tickets de contexto da #331; incorpora somente Expedição, suas dependências de interface, portas persistentes, migrations 036/037, testes e job de compatibilidade da #333. Não declara ancestralidade de merge com #333 nem integração dos módulos históricos 025–035. Originais intactas; nenhum consumidor CentralCliente360Panel foi alterado.

## Contratos reconciliados

- Pedido fornece leitura para Expedição através do get existente com executor e lock; mantém contratos da #331.
- API e fachada HTTP anunciam Expedição sob flag existente, sem substituir módulos comerciais ou fonte local indiscriminadamente.
- WindowManager conserva uniqueKey, refreshPropsOnReuse e abertura segura; incorpora limites de viewport e marcadores da janela. Launchpad mantém azul aprovado.
- Hidratação parcial preserva contexto operacional da empresa. Catálogo owner explícito e JSON de provisionamento seguem equivalentes; sem wildcard ou aplicação operacional.
- Rechecagem de tenant/RBAC em toda mutação de Expedição usa executor compartilhado. Romaneio não consulta permissão por outra conexão no meio da transação.
- Data de entrega do Pedido é serializada ISO. Entrega total atualiza itens; parcial com um único item registra quantidade exata. Parcial com múltiplos itens continua agregado: não inventa rateio; devolução por item exige quantidade entregue comprovada.
- Fixture do teste PostgreSQL de estoque deixa de depender de tipo_comercial histórico ausente na #331. Asserções de concorrência, rollback e saldo foram preservadas.

## Verificação e critérios

Novo teste `server/tests/comercial-expedicao-composicao.test.ts` executa o mesmo percurso em PGlite e no PostgreSQL isolado da CI. Usa somente seeds sintéticas e saldo explicitamente sintético, sem importação operacional.

Cobre Cliente e vínculo, preço recalculado, edição de Orçamento, três conversões concorrentes (uma criação), edição/status do Pedido, tenant/ator negado, revogação antes da gravação, auditoria com falha e rollback, Entrega única/retry, separação por identidade, despacho único, saldo 20→17, parcial 1.000001, devolução válida/limite comprovado e saldo 18, Pedido direto idempotente e cancelamento, histórico e Central360. Eventos de Expedição auditam Pedido sem inventar novos status.

Resultados locais: foco backend 25/25; reautorização/jornada 16/16; frontend Expedição 59/59; composição histórica de migrations 1/1 sem skip; backend geral 410 pass, 23 skips exclusivamente dependentes de PostgreSQL externo. Suites da CI PostgreSQL rejeitam skips, incluindo nova composição e estoque R11. Build, lint, audit e CI final devem ser registrados no comentário do SHA final.

Pendências transparentes: typecheck JS global já falha na #331 (1660 diagnósticos) e o primeiro port retornou 1741; reconciliar delta antes de declarar esse gate. Testes root Windows sem Bash retornaram 961 pass/53 fail, inclusive infraestrutura Bash. Após Git Bash no PATH, o precheck VPS ficou bloqueado e a execução foi interrompida; CI Linux é obrigatória. Nenhum teste/regra foi desabilitado para aprovar a composição.

## Liberação

Implementado na candidata; não integrado, implantado nem homologado. CI do SHA final e revisão independente Cursor exigidas. Portas de estoque/Pedido permanecem reservadas por padrão no runtime; fixture opta por portas persistentes somente no banco descartável. 026 permanece fail-closed. Backup recuperável, destino/configuração, grants/RLS/unidades/saldos reais e reversão continuam gates operacionais, sem inferir aprovação de testes sintéticos.
