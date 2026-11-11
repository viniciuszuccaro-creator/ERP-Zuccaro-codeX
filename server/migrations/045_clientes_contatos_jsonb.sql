-- 045: Cliente MASTER — contatos[] jsonb (decisão a / pack Contatos)
-- Reutiliza o array UI (nome/cargo/tipo/valor/principal/observacao + campos extras).
-- Sem ContatoClienteV2; ContatoB2B FK não destrava este fluxo.
-- Escalares email/telefone/celular permanecem; WhatsApp ≠ celular.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS contatos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clientes.contatos IS
  'Canais ricos do cadastro (contatos[]): omit no wire ≠ limpar; [] = limpeza explícita.';
