-- RLS fail-closed: habilita RLS sem policies permissivas para roles de cliente.
-- O BFF deve conectar com role privilegiada (ex.: postgres / erp_api BYPASSRLS)
-- e aplicar group_id/empresa_id no application layer.

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

-- Sem CREATE POLICY aberta: PostgREST/anon/authenticated ficam bloqueados por padrao.
-- Policies granulares por JWT claims entram em lotes futuros de Auth.
