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

-- Extend the existing item guards explicitly; original parent/unit/owned-product
-- conditions remain unchanged. A shared master needs this company's live link.
-- No SECURITY DEFINER, policy broadening, grants or historical row updates.
CREATE OR REPLACE FUNCTION assert_orcamento_item_same_tenant() RETURNS TRIGGER AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM orcamentos o WHERE o.id=NEW.orcamento_id AND o.group_id=NEW.group_id AND o.empresa_id=NEW.empresa_id)
   THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: item outside orcamento scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM produtos p WHERE p.id=NEW.produto_id AND p.group_id=NEW.group_id AND p.empresa_id=NEW.empresa_id AND p.unidade_medida_id=NEW.unidade_id)
   AND NOT EXISTS(SELECT 1 FROM produtos p JOIN produto_empresas pe ON pe.produto_id=p.id AND pe.group_id=p.group_id
     JOIN empresas e ON e.id=pe.empresa_id AND e.group_id=pe.group_id
     WHERE p.id=NEW.produto_id AND p.group_id=NEW.group_id AND p.empresa_id IS NULL AND p.ativo AND p.unidade_medida_id=NEW.unidade_id
       AND pe.empresa_id=NEW.empresa_id AND pe.ativo AND pe.habilitado_operacao AND e.status='Ativa' FOR SHARE OF p,pe,e)
   THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto outside scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM unidades_medida u WHERE u.id=NEW.unidade_id AND u.group_id=NEW.group_id)
   THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: unidade outside group'; END IF;
 RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assert_pedido_item_same_tenant() RETURNS TRIGGER AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pedidos p WHERE p.id=NEW.pedido_id AND p.group_id=NEW.group_id AND p.empresa_id=NEW.empresa_id)
   THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: item outside pedido scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM produtos p WHERE p.id=NEW.produto_id AND p.group_id=NEW.group_id AND p.empresa_id=NEW.empresa_id AND p.unidade_medida_id=NEW.unidade_id AND p.ativo)
   AND NOT EXISTS(SELECT 1 FROM produtos p JOIN produto_empresas pe ON pe.produto_id=p.id AND pe.group_id=p.group_id
     JOIN empresas e ON e.id=pe.empresa_id AND e.group_id=pe.group_id
     WHERE p.id=NEW.produto_id AND p.group_id=NEW.group_id AND p.empresa_id IS NULL AND p.ativo AND p.unidade_medida_id=NEW.unidade_id
       AND pe.empresa_id=NEW.empresa_id AND pe.ativo AND pe.habilitado_operacao AND e.status='Ativa' FOR SHARE OF p,pe,e)
   THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: produto outside scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM unidades_medida u WHERE u.id=NEW.unidade_id AND u.group_id=NEW.group_id AND u.ativo)
   THEN RAISE EXCEPTION 'TENANT_FK_MISMATCH: unidade outside group'; END IF;
 RETURN NEW; END; $$ LANGUAGE plpgsql;
