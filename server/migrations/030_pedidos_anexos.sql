-- Comercial 360 Onda 5 — anexos do Pedido reutilizando DAM/StoragePort (aditiva).
-- Metadados no agregado Pedido; binário só no storage. Sem módulo DAM paralelo.

CREATE TABLE IF NOT EXISTS pedido_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  pedido_id UUID NOT NULL,
  storage_key TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'QUARENTENA',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  FOREIGN KEY (pedido_id, group_id, empresa_id) REFERENCES pedidos(id, group_id, empresa_id),
  UNIQUE (group_id, empresa_id, storage_key),
  CHECK (btrim(storage_key) <> '' AND char_length(storage_key) <= 500),
  CHECK (btrim(nome_arquivo) <> '' AND char_length(nome_arquivo) <= 255),
  CHECK (btrim(mime_type) <> '' AND char_length(mime_type) <= 120),
  CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 52428800),
  CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  CHECK (versao >= 1),
  CHECK (status IN ('QUARENTENA','ATIVO','REJEITADO','INATIVO')),
  CHECK (ativo = (status IN ('QUARENTENA','ATIVO')))
);

CREATE INDEX IF NOT EXISTS idx_pedido_anexos_scope
  ON pedido_anexos (group_id, empresa_id, pedido_id, created_at DESC, id DESC);

ALTER TABLE pedido_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_anexos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pedido_anexos FROM PUBLIC;
