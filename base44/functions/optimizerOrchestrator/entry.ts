import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserAndPerfil, assertPermission } from './_lib/guard.js';

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    let payload; try { payload = await req.json(); } catch { payload = {}; }
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await getUserAndPerfil(base44);
    const perm = await assertPermission(base44, ctx, 'Comercial', 'Produto', 'editar');
    if (perm) return perm;
    if (payload?.confirmado !== true) {
      return Response.json({ error: 'Acao critica do agente exige confirmacao humana.' }, { status: 403 });
    }

    const limitPerEmpresa = Math.min(Math.max(Number(payload?.limit_per_empresa) || 1000, 1), 5000);
    const filtroBase = payload?.filter || { status: 'Ativo' };

    const groupId = user.grupo_atual_id || user.grupo_padrao_id || user.group_id || payload?.group_id || null;
    const empresas = groupId
      ? await base44.entities.Empresa.filter({ group_id: groupId }, '-id', 200)
      : [];
    let aggregate = { empresas: empresas.length, total: 0, updated: 0, skipped: 0, failed: 0 };

    for (const emp of empresas) {
      try {
        const resp = await base44.functions.invoke('productPriceOptimizer', {
          limit: limitPerEmpresa,
          filter: { ...filtroBase, empresa_id: emp.id },
          confirmado: true,
          agente: 'comercial',
        });
        const res = resp?.data || {};
        aggregate.total += res?.total || 0;
        aggregate.updated += res?.updated || 0;
        aggregate.skipped += res?.skipped || 0;
        aggregate.failed += res?.failed || 0;
      } catch (_) {
        aggregate.failed += 1; // falha ao orquestrar chamada desta empresa
      }
    }

    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Automação',
        usuario_id: user?.id,
        acao: 'Edição',
        modulo: 'Comercial',
        tipo_auditoria: 'sistema',
        entidade: 'Produto',
        descricao: 'Otimização de preços - Orquestração no grupo do usuario',
        dados_novos: { ...aggregate },
        data_hora: new Date().toISOString(),
        duracao_ms: Date.now() - t0,
      });
    } catch {}

    return Response.json({ ok: true, ...aggregate, duracao_ms: Date.now() - t0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});