-- Candidate only: requires the canonical accounting masters in the target schema.
DO $$
DECLARE
  target_schema text := current_schema();
  relation text;
BEGIN
  IF target_schema IS NULL OR target_schema IN ('public', 'pg_catalog', 'information_schema')
      OR current_schemas(false) <> ARRAY[target_schema::name, 'pg_catalog'::name] THEN
    RAISE EXCEPTION 'CONTA_RECEBER_SCHEMA_ISOLADO_OBRIGATORIO';
  END IF;
  FOREACH relation IN ARRAY ARRAY['pedidos', 'centros_custo', 'plano_contas'] LOOP
    IF to_regclass(format('%I.%I', target_schema, relation)) IS NULL THEN
      RAISE EXCEPTION 'CONTA_RECEBER_DEPENDENCIA_LOCAL_AUSENTE: %', relation;
    END IF;
  END LOOP;
END $$;

CREATE TABLE contas_receber (
  pedido_id uuid,
  group_id uuid,
  empresa_id uuid,
  parcela integer CHECK (parcela > 0),
  data_vencimento date NOT NULL,
  valor numeric(16,2) NOT NULL CHECK (valor > 0),
  centro_custo_id uuid NOT NULL,
  plano_contas_id uuid NOT NULL,
  valor_recebido numeric(16,2) NOT NULL DEFAULT 0 CHECK (valor_recebido BETWEEN 0 AND valor),
  PRIMARY KEY (pedido_id,group_id,empresa_id,parcela),
  FOREIGN KEY (pedido_id,group_id,empresa_id) REFERENCES pedidos(id,group_id,empresa_id),
  FOREIGN KEY (centro_custo_id,group_id,empresa_id) REFERENCES centros_custo(id,group_id,empresa_id),
  FOREIGN KEY (plano_contas_id,group_id,empresa_id) REFERENCES plano_contas(id,group_id,empresa_id)
);

CREATE TABLE contas_receber_recebimentos (
  pedido_id uuid,
  group_id uuid,
  empresa_id uuid,
  parcela integer,
  evento text CHECK (length(evento) BETWEEN 1 AND 120),
  valor numeric(16,2) NOT NULL CHECK (valor > 0),
  PRIMARY KEY (pedido_id,group_id,empresa_id,parcela,evento),
  FOREIGN KEY (pedido_id,group_id,empresa_id,parcela) REFERENCES contas_receber
);

ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber FORCE ROW LEVEL SECURITY;
CREATE POLICY contas_receber_empresa ON contas_receber
  USING (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
    AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
  WITH CHECK (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
    AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);

ALTER TABLE contas_receber_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber_recebimentos FORCE ROW LEVEL SECURITY;
CREATE POLICY contas_receber_recebimentos_empresa ON contas_receber_recebimentos
  USING (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
    AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
  WITH CHECK (group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
    AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);
