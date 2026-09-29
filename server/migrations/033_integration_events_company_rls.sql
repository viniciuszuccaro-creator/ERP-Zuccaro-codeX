-- Codex reservation coordinated in PR #50; 025-032 remain owned by Cursor.
-- Gate before applying: canonical producers must supply an explicit company.
-- No backfill, tenant inference, PUBLIC grants or activation of channel ingress.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy
    WHERE polrelid='integration_events'::regclass AND polname <> 'integration_events_scope') THEN
    RAISE EXCEPTION 'Unexpected integration_events policy: review before applying 033';
  END IF;
END $$;
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON integration_events FROM PUBLIC;
DROP POLICY IF EXISTS integration_events_scope ON integration_events;
CREATE POLICY integration_events_scope ON integration_events FOR ALL TO PUBLIC
  USING (group_id = NULLIF(current_setting('erp.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('erp.empresa_id', true), '')::uuid)
  WITH CHECK (group_id = NULLIF(current_setting('erp.group_id', true), '')::uuid
    AND empresa_id = NULLIF(current_setting('erp.empresa_id', true), '')::uuid);
-- Role privileges are provisioned separately; the policy does not grant access.
