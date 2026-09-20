# ERP-RUNTIME-08B — Diagnóstico definitivo do harness da 015

A migration 015 já está aplicada uma vez no PostgreSQL DEV e é imutável. Ela
mantém duas constraint triggers `DEFERRABLE INITIALLY DEFERRED` sobre condição e
parcelas. No `COMMIT`, uma condição ativa exige parcelas ativas cuja soma seja
exatamente `100.000000`; a mesma regra cobre inserção, alteração, remoção,
reativação e restore.

Os testes locais reproduzem a barreira: condição sem parcelas, total de 99%,
remoção da única parcela e reativação sem parcelas falham no commit e a operação
é revertida. Condição e parcela de 100% na mesma transação continuam válidas.

## Causa do resultado `INVALID_INSERT_EXIT=0`

O trecho usado no gate chamava `docker exec "$DB" psql ... <<SQL`, sem `-i`.
O Docker não mantém stdin anexado sem essa opção; portanto o heredoc pode não
chegar ao `psql`. Nesse caso o cliente recebe EOF, executa nenhuma instrução e
encerra com status 0. Isto explica simultaneamente o exit code 0 e a ausência de
uma prova de persistência. Não é evidência de que a constraint trigger aceitou
uma condição inválida.

Com `psql -X -v ON_ERROR_STOP=1` em modo não interativo, qualquer erro SQL deve
interromper o script e devolver status não zero. O gate deve capturar esse status
sem mascará-lo e consultar uma conexão nova após a tentativa.

## Roteiro obrigatório para o próximo Gate VPS autorizado

Não executar este roteiro sem autorização VPS. Ele não aplica migrations, não
altera a API 3080 e não faz merge.

```bash
set +e
docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -d "$DATABASE" \
  -v condition_id="$CONDITION_ID" -v group_id="$GROUP_ID" \
  -v empresa_id="$EMPRESA_ID" -v codigo="$CODIGO" \
  >"$LOG" 2>&1 <<'SQL'
BEGIN;
-- usar IDs sintéticos exclusivos e o contexto de grupo/empresa do gate
INSERT INTO condicoes_pagamento (id, group_id, empresa_id, codigo, nome, ativo)
VALUES (:'condition_id', :'group_id', :'empresa_id', :'codigo', 'R08 INVALID GATE', true);
COMMIT;
SQL
invalid_exit=$?
set -e

test "$invalid_exit" -ne 0
grep -q 'CONDICAO_PAGAMENTO_INVALID_PARCELAS' "$LOG"

# Sessão nova: -c não precisa de stdin, por isso não usa heredoc.
persisted=$(docker exec "$DB" psql -X -At -v ON_ERROR_STOP=1 -d "$DATABASE" \
  -v condition_id="$CONDITION_ID" \
  -c "SELECT count(*) FROM condicoes_pagamento WHERE id = :'condition_id';")
test "$persisted" = 0
```

Antes da execução, o operador deve inspecionar os valores e fornecer `DB`,
`DATABASE`, `LOG`, `CONDITION_ID`, `GROUP_ID`, `EMPRESA_ID` e `CODIGO` sem
expor segredos. Depois do resultado esperado, executar seed duas vezes e o E2E
R08. Não reaplicar 014/015, não criar 016 e não promover a API R08 neste gate.
