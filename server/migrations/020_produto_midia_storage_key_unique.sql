-- A physical Storage object must have one immutable metadata owner, even after soft-delete.
-- Existing duplicates require manual reconciliation; never discard metadata automatically.
CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_midias_group_storage_key
  ON produto_midias(group_id, storage_key);
