-- Contraparte HTTP da entidade Interacao existente. Sem importação/cutover automático.
CREATE TABLE IF NOT EXISTS interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL,
  codigo TEXT NOT NULL CHECK (codigo ~ '^[0-9]{6,19}$'),
  cliente_empresa_id UUID,
  oportunidade_id UUID,
  legacy_store_id TEXT,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  payload_fingerprint TEXT NOT NULL CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'),
  ativo BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  UNIQUE(id,group_id,empresa_id), UNIQUE(group_id,codigo),
  UNIQUE(group_id,empresa_id,idempotency_key),
  FOREIGN KEY(empresa_id,group_id) REFERENCES empresas(id,group_id),
  FOREIGN KEY(cliente_empresa_id,group_id,empresa_id) REFERENCES cliente_empresas(id,group_id,empresa_id),
  FOREIGN KEY(oportunidade_id,group_id,empresa_id) REFERENCES oportunidades(id,group_id,empresa_id),
  CHECK (cliente_empresa_id IS NOT NULL OR oportunidade_id IS NOT NULL),
  CHECK (length(btrim(payload->>'titulo')) BETWEEN 1 AND 240)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interacoes_legacy_scope ON interacoes(group_id,empresa_id,legacy_store_id)
  WHERE legacy_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interacoes_timeline ON interacoes(group_id,empresa_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_interacoes_cliente ON interacoes(group_id,empresa_id,cliente_empresa_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_oportunidade ON interacoes(group_id,empresa_id,oportunidade_id);
DROP TRIGGER IF EXISTS trg_interacoes_updated_at ON interacoes;
CREATE TRIGGER trg_interacoes_updated_at BEFORE UPDATE ON interacoes FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE OR REPLACE FUNCTION sync_interacao_codigo() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  INSERT INTO entity_code_sequences(group_id,entity_name,next_value) VALUES(NEW.group_id,'Interacao',NEW.codigo::bigint+1)
    ON CONFLICT(group_id,entity_name) DO UPDATE SET next_value=GREATEST(entity_code_sequences.next_value,EXCLUDED.next_value),
      updated_at=timezone('utc',now());
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sync_interacao_codigo() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_interacoes_codigo ON interacoes;
CREATE TRIGGER trg_interacoes_codigo BEFORE INSERT OR UPDATE OF codigo,group_id ON interacoes
  FOR EACH ROW EXECUTE PROCEDURE sync_interacao_codigo();

CREATE TABLE IF NOT EXISTS interacao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  interacao_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK(version>0),
  action TEXT NOT NULL CHECK(action IN ('create','update','inactivate','restore')),
  snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  FOREIGN KEY(interacao_id,group_id,empresa_id) REFERENCES interacoes(id,group_id,empresa_id),
  UNIQUE(interacao_id,version)
);
CREATE OR REPLACE FUNCTION reject_interacao_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'INTERACAO_HISTORY_APPEND_ONLY'; END $$;
REVOKE ALL ON FUNCTION reject_interacao_history_mutation() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_interacao_history_immutable ON interacao_historico;
CREATE TRIGGER trg_interacao_history_immutable BEFORE UPDATE OR DELETE ON interacao_historico
  FOR EACH ROW EXECUTE PROCEDURE reject_interacao_history_mutation();
ALTER TABLE interacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interacoes FORCE ROW LEVEL SECURITY;
ALTER TABLE interacao_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE interacao_historico FORCE ROW LEVEL SECURITY;
REVOKE ALL ON interacoes,interacao_historico FROM PUBLIC;
DROP POLICY IF EXISTS interacoes_scope ON interacoes;
CREATE POLICY interacoes_scope ON interacoes FOR ALL USING (
  group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid
) WITH CHECK (
  group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid
);
DROP POLICY IF EXISTS interacao_historico_scope ON interacao_historico;
CREATE POLICY interacao_historico_scope ON interacao_historico FOR ALL USING (
  group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid
) WITH CHECK (
  group_id=NULLIF(current_setting('app.group_id',true),'')::uuid AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid
);
COMMENT ON TABLE interacoes IS 'Interacao CRM canônica; legado separado, ativação HTTP opt-in, sem dual-write.';
-- Reversão de código não apaga registros, IDs ou histórico. Migration operacional exige gate próprio.
