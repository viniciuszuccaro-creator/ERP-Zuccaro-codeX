# ERP-RUNTIME-08B — Hardening 015

O DEV aceitou um INSERT de condição ativa sem parcelas, embora a definição
esperada da 014 devesse falhar no commit. A reprodução local com a 014 atual
bloqueia esse caso e permite condição+100% na mesma transação; isso evidencia
divergência no estado efetivo de triggers do DEV, não mudança de requisito.

A 015 preserva a 014 imutável e recria, de forma mínima, as duas constraint
triggers deferred usando uma única função final. Ao commit, condição ativa só é
permitida se a soma de parcelas ativas for exatamente `100.000000`. O mesmo
mecanismo cobre insert/update/delete de parcela, insert/ativação/restore da
condição e operações atômicas de replace.

No próximo gate, aplicar somente a 015 após backup autorizado, inspecionar o
possível registro sintético `R08 INVALID GATE`, limpar esse dado de forma
controlada e auditar a justificativa. Depois executar seed 2x e E2E. Não
reaplicar 014 nem promover a API R08.
