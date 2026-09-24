/** Service role keys must never reach the browser. */

export type AuthFoundation = {
  mode: 'dev_headers' | 'supabase_user';
  notes: string[];
};

export function getAuthFoundation(mode: AuthFoundation['mode']): AuthFoundation {
  return {
    mode,
    notes: mode === 'supabase_user'
      ? ['Bearer user token is validated by self-hosted Supabase Auth before tenant and RBAC checks.',
        'Group and company headers are requested scope only; server-side guards enforce membership.',
        'SUPABASE_SERVICE_ROLE_KEY is server-only and must never be exposed to Vite.']
      : ['Development-only actor headers are not verified identities.',
        'SUPABASE_SERVICE_ROLE_KEY is server-only and must never be exposed to Vite.'],
  };
}
