-- Candidato compensatorio, fora do migrador automatico. Nao aplicar por nome/numero.
-- Exige identidade/schema/journal/SQL, backup, janela e aprovacao especifica.
-- Preserva 044 e sua constraint; nao inventa fingerprints nem altera registros.
-- Se houver pares incompletos preexistentes, VALIDATE falha e tudo e revertido.
BEGIN;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_idempotency_pair_complete_check
  CHECK ((idempotency_key IS NULL AND payload_fingerprint IS NULL)
    OR (idempotency_key IS NOT NULL AND payload_fingerprint IS NOT NULL
      AND payload_fingerprint ~ '^[a-f0-9]{64}$')) NOT VALID;
ALTER TABLE pedidos VALIDATE CONSTRAINT pedidos_idempotency_pair_complete_check;
COMMIT;
