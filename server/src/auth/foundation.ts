/**
 * Auth foundation only — full Supabase Auth mapping is a later runtime lote.
 * Service role keys must never reach the browser.
 */

export type AuthFoundation = {
  mode: 'dev_headers' | 'supabase_jwt_future';
  notes: string[];
};

export function getAuthFoundation(): AuthFoundation {
  return {
    mode: 'dev_headers',
    notes: [
      'ERP-RUNTIME-01 accepts X-Actor-Id / X-Actor-Email for audit only.',
      'Supabase Auth JWT validation will replace this in a later lote.',
      'SUPABASE_SERVICE_ROLE_KEY is server-only and must never be exposed to Vite.',
    ],
  };
}
