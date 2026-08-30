import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { normalizeGuardAction, resolveGuardPermission, validateGuardContext } from './_lib/security/entityGuardPolicy.js';

// Rate-limit por IP
const __RL = globalThis.__egRate || (globalThis.__egRate = new Map());
const __WINDOW_MS = 30_000;
const __MAX_REQ = 120;

// Cache de permissões por usuário (evita chamar auth.me() a cada request)
const __PERM_CACHE = globalThis.__egPermCache || (globalThis.__egPermCache = new Map());
const __PERM_TTL = 300_000; // 5 min

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Ping de automação
    if (!body || Object.keys(body).length === 0 || body._automation === true) {
      return Response.json({ ok: true, status: 'healthy' });
    }

    // Rate limit por IP
    try {
      const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
      const now = Date.now();
      const list = __RL.get(ip) || [];
      const kept = list.filter((t) => now - t < __WINDOW_MS);
      kept.push(now);
      __RL.set(ip, kept);
      if (kept.length > __MAX_REQ) {
        return Response.json({ allowed: false, error: 'rate_limited' }, { status: 429 });
      }
    } catch {}

    // Autenticação — usa cache para não consumir créditos a cada chamada
    let user = null;
    try {
      const authToken = req.headers.get('authorization') || '';
      const cacheKey = authToken.slice(-32); // últimos 32 chars do token como chave
      const cached = __PERM_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.ts < __PERM_TTL) {
        user = cached.user;
      } else {
        user = await base44.auth.me();
        if (user && cacheKey) {
          __PERM_CACHE.set(cacheKey, { user, ts: Date.now() });
          // Limpa entradas antigas (max 500)
          if (__PERM_CACHE.size > 500) {
            const oldest = __PERM_CACHE.keys().next().value;
            __PERM_CACHE.delete(oldest);
          }
        }
      }
    } catch {}

    if (!user) return Response.json({ allowed: false, error: 'Unauthorized' }, { status: 401 });

    const normalizeModule = (s) => {
      if (!s) return 'Sistema';
      const norm = String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const aliases = {
        financeiro: 'Financeiro', financeiroecontabil: 'Financeiro',
        compras: 'Compras', comprasesuprimentos: 'Compras',
        comercial: 'Comercial', comercialevendas: 'Comercial',
        estoque: 'Estoque', estoqueealmoxarifado: 'Estoque',
        expedicao: 'Expedição', expedicaologistica: 'Expedição',
        producao: 'Produção', crm: 'CRM', fiscal: 'Fiscal',
        rh: 'RH', recursoshumanos: 'RH',
        dashboard: 'Dashboard', relatorios: 'Relatórios',
        agenda: 'Agenda', cadastros: 'Cadastros', cadastrosgerais: 'Cadastros',
        contratos: 'Contratos', administracao: 'Sistema', sistema: 'Sistema',
      };
      return aliases[norm] || s || 'Sistema';
    };

    const moduleName = normalizeModule(body?.module || 'Sistema');
    const section = body?.section || null;
    const desired = normalizeGuardAction(body?.action);
    const guardContext = validateGuardContext(body);

    if (!guardContext.valid) {
      return Response.json({ allowed: false, error: guardContext.error }, { status: 400 });
    }

    // Proteção de entidades críticas
    const targetEntity = body?.entity_name;
    if (targetEntity === 'AuditLog' && ['criar', 'editar', 'excluir'].includes(desired)) {
      return Response.json({ allowed: false, error: 'audit_log_immutable' }, { status: 403 });
    }

    // Administradores podem gerir perfis, mas não alterar o log imutável.
    if (user?.role === 'admin') {
      return Response.json({ allowed: true, reason: 'admin' });
    }

    if (!user?.perfil_acesso_id) {
      return Response.json({ allowed: false, error: 'access_profile_required' }, { status: 403 });
    }

    let perfil = null;
    try {
      perfil = await base44.asServiceRole.entities.PerfilAcesso.get(user.perfil_acesso_id);
    } catch {
      return Response.json({ allowed: false, error: 'access_profile_unavailable' }, { status: 503 });
    }

    const allowed = resolveGuardPermission({
      permissions: perfil?.permissoes,
      moduleName,
      section,
      action: desired,
    });

    return Response.json(
      { allowed, reason: allowed ? 'profile_permission' : 'permission_denied' },
      { status: allowed ? 200 : 403 },
    );

  } catch (err) {
    return Response.json({ allowed: false, error: 'guard_unavailable' }, { status: 503 });
  }
});
