-- ERP-EXPEDICAO V1. Persistencia canonica Entrega/Romaneio/Separacao.
-- Aditiva; executar somente em CI ate gate de VPS proprio. Sem aplicacao operacional.
-- Side-effects Pedido/estoque reservados (coordenacao Codex Comercial) — sem tip-port.

CREATE TABLE IF NOT EXISTS entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  numero VARCHAR(8) NOT NULL,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO_SEPARACAO',
  pedido_id UUID,
  pedido_numero TEXT,
  cliente_id UUID,
  cliente_nome TEXT,
  cliente_empresa_id UUID,
  cliente_local_id UUID,
  tipo_frete TEXT NOT NULL DEFAULT 'ENTREGA',
  data_entrega_solicitada TIMESTAMPTZ,
  data_previsao TIMESTAMPTZ,
  data_saida TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  romaneio_id UUID,
  motorista_id UUID,
  motorista_nome TEXT,
  veiculo TEXT,
  placa TEXT,
  sequencia_rota INT,
  cidade TEXT,
  endereco_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  comprovante_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  entrega_parcial_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  entrega_frustrada_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  logistica_reversa_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  quantidade_total NUMERIC(18,6) NOT NULL DEFAULT 0,
  volumes NUMERIC(18,6) NOT NULL DEFAULT 0,
  observacoes TEXT,
  idempotency_key TEXT,
  qr_code TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (empresa_id, numero),
  UNIQUE (id, group_id, empresa_id),
  UNIQUE (empresa_id, pedido_id),
  UNIQUE (empresa_id, idempotency_key),
  CHECK (btrim(numero) ~ '^[0-9]{8}$'),
  CHECK (status IN (
    'AGUARDANDO_SEPARACAO','EM_SEPARACAO','PRONTO_EXPEDIR','EM_ROMANEIO',
    'SAIU_ENTREGA','ENTREGUE_PARCIAL','ENTREGUE','FRUSTRADA','DEVOLVIDA','CANCELADA'
  )),
  CHECK (tipo_frete IN ('ENTREGA','RETIRADA')),
  CHECK ((status = 'CANCELADA') = (ativo = false)),
  CHECK (quantidade_total >= 0 AND volumes >= 0),
  CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000),
  CHECK (sequencia_rota IS NULL OR sequencia_rota > 0)
);

CREATE OR REPLACE FUNCTION assert_entrega_same_tenant() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa outside group';
  END IF;
  -- Pedido soft/nullable: quando informado, deve pertencer ao mesmo tenant (sem tip-port de status).
  IF NEW.pedido_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pedidos'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id=NEW.pedido_id AND p.group_id=NEW.group_id AND p.empresa_id=NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'TENANT_FK_MISMATCH: pedido outside entrega scope';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_entregas_tenant BEFORE INSERT OR UPDATE OF group_id,empresa_id,pedido_id
  ON entregas FOR EACH ROW EXECUTE PROCEDURE assert_entrega_same_tenant();
CREATE TRIGGER trg_entregas_updated_at BEFORE UPDATE ON entregas FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_entregas_scope_page ON entregas(group_id,empresa_id,status,numero DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_pedido ON entregas(group_id,empresa_id,pedido_id);
CREATE INDEX IF NOT EXISTS idx_entregas_romaneio ON entregas(group_id,empresa_id,romaneio_id);
CREATE INDEX IF NOT EXISTS idx_entregas_data ON entregas(group_id,empresa_id,data_entrega_solicitada,status);
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE entregas FROM PUBLIC;

CREATE TABLE IF NOT EXISTS entrega_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  entrega_id UUID NOT NULL REFERENCES entregas(id),
  produto_id UUID,
  descricao_snapshot TEXT NOT NULL,
  unidade_snapshot TEXT NOT NULL DEFAULT 'UN',
  quantidade_pedida NUMERIC(18,6) NOT NULL,
  quantidade_separada NUMERIC(18,6) NOT NULL DEFAULT 0,
  quantidade_entregue NUMERIC(18,6) NOT NULL DEFAULT 0,
  quantidade_devolvida NUMERIC(18,6) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (entrega_id,group_id,empresa_id) REFERENCES entregas(id,group_id,empresa_id),
  CHECK (btrim(descricao_snapshot) <> '' AND btrim(unidade_snapshot) <> ''),
  CHECK (quantidade_pedida > 0),
  CHECK (quantidade_separada >= 0 AND quantidade_entregue >= 0 AND quantidade_devolvida >= 0),
  CHECK (quantidade_entregue <= quantidade_pedida + 0.000001),
  CHECK (quantidade_devolvida <= quantidade_entregue + 0.000001)
);

CREATE OR REPLACE FUNCTION assert_entrega_item_same_tenant() RETURNS TRIGGER AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM entregas e WHERE e.id=NEW.entrega_id AND e.group_id=NEW.group_id AND e.empresa_id=NEW.empresa_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: item outside entrega scope';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_entrega_itens_tenant BEFORE INSERT OR UPDATE OF group_id,empresa_id,entrega_id
  ON entrega_itens FOR EACH ROW EXECUTE PROCEDURE assert_entrega_item_same_tenant();
CREATE TRIGGER trg_entrega_itens_updated_at BEFORE UPDATE ON entrega_itens FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_entrega_itens_scope ON entrega_itens(group_id,empresa_id,entrega_id,created_at,id);
ALTER TABLE entrega_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega_itens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE entrega_itens FROM PUBLIC;

CREATE TABLE IF NOT EXISTS entrega_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem BIGINT GENERATED ALWAYS AS IDENTITY,
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  entrega_id UUID NOT NULL REFERENCES entregas(id),
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  motivo TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (entrega_id,group_id,empresa_id) REFERENCES entregas(id,group_id,empresa_id),
  CHECK (status_anterior IS NULL OR status_anterior IN (
    'AGUARDANDO_SEPARACAO','EM_SEPARACAO','PRONTO_EXPEDIR','EM_ROMANEIO',
    'SAIU_ENTREGA','ENTREGUE_PARCIAL','ENTREGUE','FRUSTRADA','DEVOLVIDA','CANCELADA'
  )),
  CHECK (status_novo IN (
    'AGUARDANDO_SEPARACAO','EM_SEPARACAO','PRONTO_EXPEDIR','EM_ROMANEIO',
    'SAIU_ENTREGA','ENTREGUE_PARCIAL','ENTREGUE','FRUSTRADA','DEVOLVIDA','CANCELADA'
  )),
  CHECK (motivo IS NULL OR char_length(motivo) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entrega_historico_idem
  ON entrega_historico(empresa_id, entrega_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entrega_historico_scope ON entrega_historico(group_id,empresa_id,entrega_id,ordem);
ALTER TABLE entrega_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega_historico FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE entrega_historico FROM PUBLIC;

CREATE TABLE IF NOT EXISTS romaneios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  numero VARCHAR(8) NOT NULL,
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  data_romaneio DATE NOT NULL DEFAULT (timezone('utc', now())::date),
  data_saida TIMESTAMPTZ,
  motorista_id UUID,
  motorista_nome TEXT NOT NULL,
  veiculo TEXT NOT NULL,
  placa TEXT NOT NULL,
  tipo_veiculo TEXT NOT NULL DEFAULT 'Caminhao',
  entregas_key TEXT NOT NULL,
  quantidade_entregas INT NOT NULL DEFAULT 0,
  instrucoes_motorista TEXT,
  checklist_saida_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (empresa_id, numero),
  UNIQUE (id, group_id, empresa_id),
  UNIQUE (empresa_id, entregas_key),
  UNIQUE (empresa_id, idempotency_key),
  CHECK (btrim(numero) ~ '^[0-9]{8}$'),
  CHECK (status IN ('RASCUNHO','APROVADO','EM_ROTA','CONCLUIDO','CANCELADO')),
  CHECK ((status = 'CANCELADO') = (ativo = false)),
  CHECK (quantidade_entregas >= 0),
  CHECK (btrim(motorista_nome) <> '' AND btrim(veiculo) <> '' AND btrim(placa) <> ''),
  CHECK (btrim(entregas_key) <> ''),
  CHECK (instrucoes_motorista IS NULL OR char_length(instrucoes_motorista) <= 2000)
);

CREATE OR REPLACE FUNCTION assert_romaneio_same_tenant() RETURNS TRIGGER AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM empresas e WHERE e.id=NEW.empresa_id AND e.group_id=NEW.group_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: empresa outside group';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_romaneios_tenant BEFORE INSERT OR UPDATE OF group_id,empresa_id
  ON romaneios FOR EACH ROW EXECUTE PROCEDURE assert_romaneio_same_tenant();
CREATE TRIGGER trg_romaneios_updated_at BEFORE UPDATE ON romaneios FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_romaneios_scope_page ON romaneios(group_id,empresa_id,status,numero DESC,id DESC);
ALTER TABLE romaneios ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneios FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE romaneios FROM PUBLIC;

CREATE TABLE IF NOT EXISTS romaneio_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  romaneio_id UUID NOT NULL REFERENCES romaneios(id),
  entrega_id UUID NOT NULL REFERENCES entregas(id),
  sequencia INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (romaneio_id,group_id,empresa_id) REFERENCES romaneios(id,group_id,empresa_id),
  FOREIGN KEY (entrega_id,group_id,empresa_id) REFERENCES entregas(id,group_id,empresa_id),
  UNIQUE (romaneio_id, entrega_id),
  UNIQUE (romaneio_id, sequencia),
  CHECK (sequencia > 0)
);
CREATE INDEX IF NOT EXISTS idx_romaneio_entregas_scope ON romaneio_entregas(group_id,empresa_id,romaneio_id,sequencia);
ALTER TABLE romaneio_entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE romaneio_entregas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE romaneio_entregas FROM PUBLIC;

-- FK circular romaneio_id em entregas (aditiva apos romaneios existir)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entregas_romaneio_tenant_fk'
  ) THEN
    ALTER TABLE entregas
      ADD CONSTRAINT entregas_romaneio_tenant_fk
      FOREIGN KEY (romaneio_id, group_id, empresa_id)
      REFERENCES romaneios(id, group_id, empresa_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS separacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  entrega_id UUID NOT NULL REFERENCES entregas(id),
  pedido_id UUID,
  tipo TEXT NOT NULL DEFAULT 'conferencia',
  status TEXT NOT NULL DEFAULT 'em_andamento',
  tem_divergencia BOOLEAN NOT NULL DEFAULT false,
  divergencias_resumo TEXT,
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  itens_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (entrega_id,group_id,empresa_id) REFERENCES entregas(id,group_id,empresa_id),
  UNIQUE (id, group_id, empresa_id),
  UNIQUE (empresa_id, entrega_id, tipo),
  UNIQUE (empresa_id, idempotency_key),
  CHECK (tipo IN ('conferencia','picking')),
  CHECK (status IN ('em_andamento','concluido','com_divergencia','cancelado')),
  CHECK ((status = 'cancelado') = (ativo = false))
);

CREATE OR REPLACE FUNCTION assert_separacao_same_tenant() RETURNS TRIGGER AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM entregas e WHERE e.id=NEW.entrega_id AND e.group_id=NEW.group_id AND e.empresa_id=NEW.empresa_id) THEN
    RAISE EXCEPTION 'TENANT_FK_MISMATCH: separacao outside entrega scope';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_separacoes_tenant BEFORE INSERT OR UPDATE OF group_id,empresa_id,entrega_id
  ON separacoes FOR EACH ROW EXECUTE PROCEDURE assert_separacao_same_tenant();
CREATE TRIGGER trg_separacoes_updated_at BEFORE UPDATE ON separacoes FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE INDEX IF NOT EXISTS idx_separacoes_scope ON separacoes(group_id,empresa_id,entrega_id,created_at DESC);
ALTER TABLE separacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE separacoes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE separacoes FROM PUBLIC;

COMMENT ON TABLE entregas IS 'Expedicao: agregado canonico tenant-scoped de Entrega.';
COMMENT ON TABLE romaneios IS 'Expedicao: agregado canonico tenant-scoped de Romaneio.';
COMMENT ON TABLE separacoes IS 'Expedicao: conferencia/picking vinculado a Entrega.';
COMMENT ON TABLE entrega_historico IS 'Historico append-only de estados da Entrega.';
-- Rollback somente com backup/gate:
-- ALTER TABLE entregas DROP CONSTRAINT IF EXISTS entregas_romaneio_tenant_fk;
-- DROP TABLE separacoes; DROP TABLE romaneio_entregas; DROP TABLE romaneios;
-- DROP TABLE entrega_historico; DROP TABLE entrega_itens; DROP TABLE entregas;
-- DROP FUNCTION assert_separacao_same_tenant(); DROP FUNCTION assert_romaneio_same_tenant();
-- DROP FUNCTION assert_entrega_item_same_tenant(); DROP FUNCTION assert_entrega_same_tenant();
