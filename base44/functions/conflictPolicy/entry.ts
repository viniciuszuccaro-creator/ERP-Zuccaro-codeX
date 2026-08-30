import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { z } from 'npm:zod@3.24.2';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

// Política de conflitos multiempresa: define prevalência e merge auditável
// Regras padrão: empresa > grupo para campos operacionais; grupo > empresa para catálogos/configs
// Payload: { entity_name, group_id?, empresa_id?, source: 'up'|'down', current, incoming }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const raw = await req.json().catch(() => ({}));
    const Schema = z.object({
      entity_name: z.string(),
      group_id: z.string().optional().nullable(),
      empresa_id: z.string().optional().nullable(),
      source: z.enum(['up','down']),
      current: z.record(z.any()).default({}),
      incoming: z.record(z.any()).default({})
    });
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: 'Payload inválido', issues: parsed.error.issues }, { status: 400 });
    const { entity_name, group_id, empresa_id, source, current, incoming } = parsed.data;

    // RBAC granular: apenas perfis autorizados podem aplicar política de conflitos
    const guardFailure = await requireEntityGuard(base44, {
      module: 'Sistema', section: 'ConflictPolicy', action: 'executar', group_id, empresa_id,
    });
    if (guardFailure) return guardFailure;

    const CATALOG_ENTS = new Set(['Produto','TabelaPreco','PlanoDeContas','CentroCusto','FormaPagamento','ConfiguracaoSistema']);
    const isCatalog = CATALOG_ENTS.has(entity_name);

    const preferIncoming = (source === 'up') ? true : isCatalog ? true : false; // up (empresa) geralmente prevalece; down (grupo) prevalece p/ catálogos

    const merged = { ...current };
    for (const [k, v] of Object.entries(incoming || {})) {
      if (['id','created_date','updated_date','created_by'].includes(k)) continue;
      // Se o campo existe em ambos e diverge, aplica política de prevalência
      if (merged[k] !== undefined && merged[k] !== v) {
        merged[k] = preferIncoming ? v : merged[k];
      } else if (merged[k] === undefined) {
        merged[k] = v;
      }
    }

    // Audit trail (resumo das diferenças)
    try {
      await base44.entities.AuditLog.create({
        usuario: user.full_name || user.email,
        usuario_id: user.id,
        empresa_id: empresa_id || null,
        group_id: group_id || null,
        acao: 'Edição',
        modulo: 'Sistema',
        tipo_auditoria: 'sistema',
        entidade: 'ConflictPolicy',
        descricao: `Merge ${entity_name} (${source})`,
        dados_anteriores: current,
        dados_novos: merged,
        data_hora: new Date().toISOString()
      });
    } catch (_) {}

    return Response.json({ ok: true, merged, policy: { entity_name, source, preferIncoming } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
