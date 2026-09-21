-- ERP-RUNTIME-08B hardening: reasserts the approved active=>100% invariant.
-- 014 is immutable and may already be applied with an incomplete trigger state.

CREATE OR REPLACE FUNCTION assert_condicao_pagamento_integridade_final() RETURNS TRIGGER AS $$
DECLARE condicao UUID; grupo UUID; total NUMERIC(9,6); ativa BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'condicoes_pagamento' THEN
    condicao := NEW.id; grupo := NEW.group_id;
  ELSE
    condicao := COALESCE(NEW.condicao_pagamento_id, OLD.condicao_pagamento_id);
    grupo := COALESCE(NEW.group_id, OLD.group_id);
  END IF;
  SELECT c.ativo, COALESCE(sum(p.percentual) FILTER (WHERE p.ativo), 0)
    INTO ativa, total
    FROM condicoes_pagamento c
    LEFT JOIN condicao_pagamento_parcelas p
      ON p.condicao_pagamento_id=c.id AND p.group_id=c.group_id
   WHERE c.id=condicao AND c.group_id=grupo
   GROUP BY c.ativo;
  IF ativa AND total <> 100.000000 THEN
    RAISE EXCEPTION 'CONDICAO_PAGAMENTO_INVALID_PARCELAS: active condition requires parcelas totaling 100.000000';
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_condicao_pagamento_parcelas_validas ON condicao_pagamento_parcelas;
DROP TRIGGER IF EXISTS trg_condicoes_pagamento_parcelas_validas ON condicoes_pagamento;
CREATE CONSTRAINT TRIGGER trg_condicao_pagamento_parcelas_validas
  AFTER INSERT OR UPDATE OR DELETE ON condicao_pagamento_parcelas
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE PROCEDURE assert_condicao_pagamento_integridade_final();
CREATE CONSTRAINT TRIGGER trg_condicoes_pagamento_parcelas_validas
  AFTER INSERT OR UPDATE OF ativo ON condicoes_pagamento
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE PROCEDURE assert_condicao_pagamento_integridade_final();
