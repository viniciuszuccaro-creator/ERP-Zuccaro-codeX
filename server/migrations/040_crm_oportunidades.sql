-- CRM canônico HTTP. Numeração reservada com Cursor: comentário 6100290423.
-- Não copia o store Oportunidade nem ativa importação/dual-write/corte da UI.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_empresas_id_scope
  ON cliente_empresas(id, group_id, empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_empresas_id_group_scope ON empresas(id, group_id);

CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL CHECK (codigo ~ '^[0-9]{6,19}$'),
  codigo_oportunidade TEXT NOT NULL CHECK (length(btrim(codigo_oportunidade)) BETWEEN 1 AND 64),
  legacy_store_id TEXT CHECK (length(btrim(legacy_store_id)) BETWEEN 1 AND 180),
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 600),
  payload_fingerprint TEXT NOT NULL CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  cliente_empresa_id UUID,
  cliente_id TEXT,
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  titulo TEXT NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 240),
  descricao TEXT CHECK (length(descricao) <= 2000),
  responsavel TEXT CHECK (length(responsavel) <= 240),
  etapa TEXT NOT NULL CHECK (length(btrim(etapa)) BETWEEN 1 AND 60),
  status TEXT NOT NULL CHECK (length(btrim(status)) BETWEEN 1 AND 60),
  valor_estimado NUMERIC(18,6) NOT NULL CHECK (valor_estimado >= 0 AND valor_estimado <> 'NaN'::numeric),
  orcamento_cliente NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (orcamento_cliente >= 0 AND orcamento_cliente <> 'NaN'::numeric),
  probabilidade NUMERIC(5,2) NOT NULL CHECK (probabilidade BETWEEN 0 AND 100),
  temperatura TEXT NOT NULL CHECK (length(btrim(temperatura)) BETWEEN 1 AND 40),
  origem TEXT NOT NULL CHECK (length(btrim(origem)) BETWEEN 1 AND 80),
  observacoes TEXT CHECK (length(observacoes) <= 2000),
  necessidades TEXT CHECK (length(necessidades) <= 2000),
  data_abertura DATE NOT NULL,
  data_previsao DATE,
  proxima_acao TEXT CHECK (length(proxima_acao) <= 240),
  data_proxima_acao DATE,
  produtos_interesse JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(produtos_interesse)='array'),
  data_fechamento DATE,
  historico_mudancas_etapa JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(historico_mudancas_etapa) = 'array'),
  -- Referências legadas são textuais: não fabricar UUID nem alterar o store.
  orcamento_id TEXT,
  pedido_id TEXT,
  convertido_em TEXT CHECK (convertido_em IN ('orcamento','pedido')),
  convertido_em_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (id, group_id, empresa_id),
  UNIQUE (group_id, codigo),
  UNIQUE (group_id, empresa_id, codigo_oportunidade),
  UNIQUE (group_id, empresa_id, idempotency_key),
  FOREIGN KEY (empresa_id, group_id) REFERENCES empresas(id, group_id),
  FOREIGN KEY (cliente_empresa_id, group_id, empresa_id)
    REFERENCES cliente_empresas(id, group_id, empresa_id),
  CHECK (cliente_empresa_id IS NOT NULL OR COALESCE(length(btrim(cliente_nome)),0) > 0
    OR COALESCE(length(btrim(cliente_email)),0) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_oportunidades_legacy_scope
  ON oportunidades(group_id, empresa_id, legacy_store_id) WHERE legacy_store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oportunidades_page
  ON oportunidades(group_id, empresa_id, ativo, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente
  ON oportunidades(group_id, empresa_id, cliente_empresa_id);
DROP TRIGGER IF EXISTS trg_oportunidades_updated_at ON oportunidades;
CREATE TRIGGER trg_oportunidades_updated_at BEFORE UPDATE ON oportunidades
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE oportunidades FROM PUBLIC;
DROP POLICY IF EXISTS oportunidades_tenant_scope ON oportunidades;
CREATE POLICY oportunidades_tenant_scope ON oportunidades FOR ALL
  USING (group_id = NULLIF(current_setting('app.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::uuid)
  WITH CHECK (group_id = NULLIF(current_setting('app.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::uuid);
COMMENT ON TABLE oportunidades IS 'Entidade Oportunidade: HTTP canônico, sem corte/importação automática do store legado.';
COMMENT ON COLUMN oportunidades.legacy_store_id IS 'ID original textual preservado; exclusivo por Grupo/Empresa. UUID técnico separado.';
-- Rollback exige backup e reconciliação; não apagar oportunidades/IDs para desfazer código.
