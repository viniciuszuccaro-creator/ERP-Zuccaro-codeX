-- CANDIDATE ONLY: apply exclusively after target/schema review and specific approval.
-- Nullable, no defaults/backfill. Does not change contacts, activity, IDs or tenant.
ALTER TABLE clientes
  ADD COLUMN rg text NULL,
  ADD COLUMN numero_caixa_postal text NULL,
  ADD COLUMN cep_caixa_postal text NULL,
  ADD COLUMN caixa_postal_cobranca text NULL,
  ADD COLUMN inscricao_produtor_rural text NULL,
  ADD CONSTRAINT clientes_master_extras_valid CHECK (
    (rg IS NULL OR (length(rg) BETWEEN 1 AND 30 AND rg=btrim(rg) AND rg !~ '[[:cntrl:]<>]')) AND
    (numero_caixa_postal IS NULL OR (length(numero_caixa_postal) BETWEEN 1 AND 40 AND numero_caixa_postal=btrim(numero_caixa_postal) AND numero_caixa_postal !~ '[[:cntrl:]<>]')) AND
    (cep_caixa_postal IS NULL OR (cep_caixa_postal ~ '^[0-9]{8}$' AND cep_caixa_postal<>'00000000')) AND
    (caixa_postal_cobranca IS NULL OR (length(caixa_postal_cobranca) BETWEEN 1 AND 40 AND caixa_postal_cobranca=btrim(caixa_postal_cobranca) AND caixa_postal_cobranca !~ '[[:cntrl:]<>]')) AND
    (inscricao_produtor_rural IS NULL OR (length(inscricao_produtor_rural) BETWEEN 1 AND 40 AND inscricao_produtor_rural=btrim(inscricao_produtor_rural) AND inscricao_produtor_rural !~ '[[:cntrl:]<>]'))
  );
