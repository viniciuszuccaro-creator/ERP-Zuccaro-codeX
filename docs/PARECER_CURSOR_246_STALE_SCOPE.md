# Parecer Cursor — PR #246 tip (Financeiro scope + stale cancel)

**Papel:** revisão independente do pacote UX Financeiro (≠ implementador do tip final stale-cancel).  
**Base:** main `dd6c211d` (#245 integrado+implantado).

## Veredito

**APROVAR merge → main** após CI tip verde, quanto a:
- scope canônico `grupo:empresa`;
- reset de seleção/diálogos na troca;
- cancel/remove de queries do scope anterior (anti resposta atrasada);
- título login "Entrar no ERP" no modo senha.

## Não cobre
- Homologação browser CPA/3Z (bloqueada por secrets Environment);
- Deploy VPS deste tip (só após merge);
- Outbox / Legado.

## Riscos residuais
- Outros submódulos Financeiro ainda com `contextKey = empresa||grupo` fraco (fora deste lote);
- Validação operacional real de baixa/conciliação exige login.
