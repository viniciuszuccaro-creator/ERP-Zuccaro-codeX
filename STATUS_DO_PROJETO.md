## Checkpoint Comercial 360 — Expedição: conferência resiliente e escopada (2026-09-28)

- **Objetivo:** completar a proteção do fluxo de reserva/conferência sem criar estruturas paralelas.
- **Alterações:** reserva parcial compensa apenas reservas criadas e bloqueia efeitos posteriores; validação agrega demanda por produto; divergência é recalculada por quantidade; separação cancelada pode ser refeita, enquanto a concluída permanece idempotente; conferência IA exige simultaneamente Grupo e Empresa.
- **Segurança e contexto:** operações de estoque e conferência mantêm group_id e empresa_id; ações sensíveis permanecem bloqueadas sem contexto/permissão.
- **Testes:** node --test tests/expedicao-entrega-policy.test.js tests/pedido-faturamento-policy.test.js tests/estoque-movimento-policy.test.js — 40 aprovados; git diff --check origin/main...HEAD aprovado. Lint local indisponível (eslint não instalado).
- **Commits do lote:** a65faea, adf579e, 8be9dca, 65c50ea, 7d0efa0.
- **Próximo passo:** obter revisão do HEAD e avançar somente em item P0 independente, preservando a coordenação da frente legada #48.

