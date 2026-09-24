-- Evidence is metadata only. A clean scan does not approve or publish media.
ALTER TABLE produto_midias
  ADD COLUMN scan_verdict TEXT,
  ADD COLUMN scan_scanner TEXT,
  ADD COLUMN scan_sha256 TEXT,
  ADD COLUMN scanned_at TIMESTAMPTZ;

ALTER TABLE produto_midias ADD CONSTRAINT produto_midias_scan_evidence_check CHECK (
  (scan_verdict IS NULL AND scan_scanner IS NULL AND scan_sha256 IS NULL AND scanned_at IS NULL)
  OR (scan_verdict IS NOT NULL AND scan_verdict IN ('CLEAN','INFECTED')
      AND scan_scanner IS NOT NULL AND length(btrim(scan_scanner)) BETWEEN 1 AND 80
      AND scan_sha256 IS NOT NULL AND scan_sha256 = sha256 AND scanned_at IS NOT NULL)
);

COMMENT ON COLUMN produto_midias.scan_verdict IS
  'Clamd evidence for the stored SHA-256; CLEAN does not authorize download or publication.';
COMMENT ON COLUMN produto_midias.scan_scanner IS
  'Scanner identifier only; no response payload, object URL, token or signature.';
