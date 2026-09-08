import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const event = payload?.event || {};
    const data = payload?.data || null;
    const old = payload?.old_data || null;
    const entity = event?.entity_name;
    const type = event?.type; // create | update | delete

    if (!entity || !type) {
      return Response.json({ error: 'Invalid automation payload' }, { status: 400 });
    }

    // Apenas reage a create/update
    if (type === 'delete') {
      return Response.json({ ok: true, skipped: 'delete' });
    }

    const groupId = data?.group_id || old?.group_id || null;
    const empresaId = data?.empresa_id || old?.empresa_id || null;

    // Helper para disparar WhatsApp (template-agnóstico; usa ConfiguracaoSistema)
    async function notifyWhatsApp(params) {
      try {
        const res = await base44.asServiceRole.functions.invoke('whatsappSend', params);
        return res?.data || { ok: true };
      } catch (e) {
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            acao: 'Erro', modulo: 'Integrações', tipo_auditoria: 'integracao', entidade: 'WhatsApp',
            descricao: e?.message || String(e), empresa_id: empresaId || null, group_id: groupId || null,
            data_hora: new Date().toISOString()
          });
        } catch (auditError) {
          console.error('[onEntityWhatsappNotify] Falha ao auditar erro WhatsApp', auditError?.message || auditError);
        }
        return { error: e?.message || String(e) };
      }
    }

    // Regras
    if (entity === 'Pedido') {
      const prev = old?.status_aprovacao || old?.status || null;
      const curr = data?.status_aprovacao || data?.status || null;
      // Dispara quando passa para "Aprovado" (status_aprovacao)
      const movedToApproved = (old && old.status_aprovacao !== 'Aprovado' && (data?.status_aprovacao === 'Aprovado' || data?.status === 'Aprovado'))
        || (!old && (data?.status_aprovacao === 'Aprovado' || data?.status === 'Aprovado'));
      if (movedToApproved) {
        await notifyWhatsApp({
          empresaId,
          groupId,
          pedidoId: event.entity_id,
          templateKey: 'pedido_aprovado',
          vars: {
            numero_pedido: data?.numero_pedido || '',
            cliente: data?.cliente_nome || '',
            valor_total: (data?.valor_total != null ? String(data.valor_total) : '')
          }
        });
      }
    }

    if (entity === 'ContaReceber') {
      const prev = old?.status || null;
      const curr = data?.status || null;
      const isOverdue = (s) => String(s || '').toLowerCase() === 'atrasado';
      const movedToOverdue = (old && !isOverdue(prev) && isOverdue(curr)) || (!old && isOverdue(curr));
      if (movedToOverdue) {
        await notifyWhatsApp({
          empresaId,
          groupId,
          clienteId: data?.cliente_id || null,
          templateKey: 'cobranca_atrasada',
          vars: {
            descricao: data?.descricao || '',
            valor: (data?.valor != null ? String(data.valor) : ''),
            vencimento: data?.data_vencimento || ''
          }
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});