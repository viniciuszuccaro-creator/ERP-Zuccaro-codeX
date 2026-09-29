-- Omnichannel reuses integration_events (001/018); no parallel document/event table.
-- Never apply to DEV/VPS without the migration gate and producer/worker role precheck.
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON integration_events FROM PUBLIC;
CREATE POLICY integration_events_scope ON integration_events
  USING (
    group_id = NULLIF(current_setting('erp.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('erp.empresa_id', true), '')::uuid
  )
  WITH CHECK (
    group_id = NULLIF(current_setting('erp.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('erp.empresa_id', true), '')::uuid
  );
-- Service role privileges are granted separately by the operator (never PUBLIC).
-- Rollback gate: disable channel ingress; restore previous app image; keep receipts.
