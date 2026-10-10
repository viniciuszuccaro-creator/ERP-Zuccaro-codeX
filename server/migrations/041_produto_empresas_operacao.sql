-- Reservation/ownership Cursor6102648260. No backfill or implicit authorization.
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_id_group_scope ON produtos(id,group_id);
CREATE TABLE IF NOT EXISTS produto_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  produto_id UUID NOT NULL REFERENCES produtos(id),
  ativo BOOLEAN NOT NULL DEFAULT false,
  habilitado_operacao BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc',now()),
  UNIQUE(group_id,empresa_id,produto_id),
  FOREIGN KEY(produto_id,group_id) REFERENCES produtos(id,group_id),
  FOREIGN KEY(empresa_id,group_id) REFERENCES empresas(id,group_id),
  CHECK(ativo OR NOT habilitado_operacao)
);
ALTER TABLE produto_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_empresas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE produto_empresas FROM PUBLIC;
DROP POLICY IF EXISTS produto_empresas_tenant_scope ON produto_empresas;
CREATE POLICY produto_empresas_tenant_scope ON produto_empresas FOR ALL
  USING(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
    AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid)
  WITH CHECK(group_id=NULLIF(current_setting('app.group_id',true),'')::uuid
    AND empresa_id=NULLIF(current_setting('app.empresa_id',true),'')::uuid);
COMMENT ON TABLE produto_empresas IS 'Explicit company operational eligibility for shared product masters; no stock, price or historical document rewrite.';
