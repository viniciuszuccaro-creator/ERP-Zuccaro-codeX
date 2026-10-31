-- CANDIDATE ONLY: outside server/migrations; no sequence number allocated.
-- Apply only to a proven isolated test cluster. Operational journal/dependencies
-- and schema review remain prerequisites for any future migration publication.
CREATE TABLE fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id),
  empresa_id uuid CHECK (empresa_id IS NULL),
  empresa_dona_id uuid CHECK (empresa_dona_id IS NULL),
  codigo text NOT NULL, tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('Pessoa Fisica','Pessoa Juridica')),
  cpf_cnpj text NOT NULL, nome text NOT NULL DEFAULT '', razao_social text NOT NULL DEFAULT '',
  nome_fantasia text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', telefone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '', contato_responsavel text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '', bairro text NOT NULL DEFAULT '', cidade text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT '', cep text NOT NULL DEFAULT '', endereco_cobranca jsonb,
  tipo_fornecedor text NOT NULL DEFAULT '', categoria text NOT NULL DEFAULT '',
  status_fornecedor text NOT NULL CHECK (status_fornecedor IN ('Em Análise','Ativo','Bloqueado','Inativo')),
  status text NOT NULL CHECK (status IN ('Ativo','Inativo')), ativo boolean NOT NULL,
  origem text NOT NULL CHECK (origem='MIGRACAO'),
  source_system text NOT NULL, codigo_legado text NOT NULL, legacy_id text NOT NULL,
  migration_batch uuid NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  created_by uuid NOT NULL REFERENCES profiles(id), updated_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id,codigo), UNIQUE(group_id,cpf_cnpj), UNIQUE(group_id,source_system,codigo_legado)
);
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores FORCE ROW LEVEL SECURITY;
-- No permissive policies, role creation, grants, backfill or operational activation.
