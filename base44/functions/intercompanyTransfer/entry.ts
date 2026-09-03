import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { audit } from './_lib/guard.js';
import { requireEntityGuard } from './_lib/security/guardCallPolicy.js';

// Transação Interempresas: cria ContaPagar (origem) e ContaReceber (destino) vinculadas
// Payload: { from_empresa_id, to_empresa_id, valor, descricao }
const sanitizeDescription = (value) => String(value || 'Transferência interempresas')
  .replace(/<[^>]*>/g, '')
  .replace(/javascript\s*:/gi, '')
  .trim()
  .slice(0, 240) || 'Transferência interempresas';

const reportIntercompanyFailure = (operation, error, context = {}) => {
  console.error('[intercompanyTransfer] ' + operation, { error: error?.message || String(error), ...context });
};
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fromId = body?.from_empresa_id; const toId = body?.to_empresa_id;
    const valor = Number(body?.valor || 0); const descricao = sanitizeDescription(body?.descricao);
    if (!fromId || !toId || !Number.isFinite(valor) || valor <= 0) return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    if (fromId === toId) return Response.json({ error: 'Empresas de origem e destino devem ser diferentes' }, { status: 400 });

    const [fromRows, toRows] = await Promise.all([
      base44.asServiceRole.entities.Empresa.filter({ id: fromId }, undefined, 1),
      base44.asServiceRole.entities.Empresa.filter({ id: toId }, undefined, 1),
    ]);
    const fromEmpresa = fromRows?.[0] || null;
    const toEmpresa = toRows?.[0] || null;
    if (!fromEmpresa || !toEmpresa) return Response.json({ error: 'Empresa de origem ou destino não encontrada' }, { status: 404 });

    const fromGroupId = fromEmpresa.group_id || fromEmpresa.grupo_id || null;
    const toGroupId = toEmpresa.group_id || toEmpresa.grupo_id || null;
    if (!fromGroupId || !toGroupId || fromGroupId !== toGroupId) {
      return Response.json({ error: 'Transferência permitida somente entre empresas do mesmo grupo' }, { status: 403 });
    }
    const groupId = fromGroupId;

    const fromGuardFailure = await requireEntityGuard(base44, {
      module: 'Financeiro', section: 'Intercompany', action: 'criar', group_id: groupId, empresa_id: fromId,
    });
    if (fromGuardFailure) return fromGuardFailure;
    const toGuardFailure = await requireEntityGuard(base44, {
      module: 'Financeiro', section: 'Intercompany', action: 'criar', group_id: groupId, empresa_id: toId,
    });
    if (toGuardFailure) return toGuardFailure;

    const dataHoje = new Date().toISOString().slice(0,10);

    const pagar = await base44.asServiceRole.entities.ContaPagar.create({
      empresa_id: fromId,
      group_id: groupId,
      origem: 'empresa',
      descricao: `${descricao} → empresa ${toId}`,
      valor,
      data_emissao: dataHoje,
      data_vencimento: dataHoje,
      status: 'Pendente',
      pago_por: 'empresa'
    });

    const receber = await base44.asServiceRole.entities.ContaReceber.create({
      empresa_id: toId,
      group_id: groupId,
      origem: 'empresa',
      descricao: `${descricao} ← empresa ${fromId}`,
      valor,
      data_emissao: dataHoje,
      data_vencimento: dataHoje,
      status: 'Pendente'
    });

    // Auditoria dupla
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Sistema',
        usuario_id: user?.id,
        acao: 'Criação', modulo: 'Financeiro', entidade: 'TransacaoInterempresas',
        descricao: `Geradas contas cruzadas (Pagar:${pagar.id} / Receber:${receber.id})`,
        empresa_id: fromId,
        group_id: groupId,
        dados_novos: { from_empresa_id: fromId, to_empresa_id: toId, valor, conta_pagar_id: pagar.id, conta_receber_id: receber.id },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      reportIntercompanyFailure('auditoria', error, { from_empresa_id: fromId, to_empresa_id: toId, group_id: groupId });
    }

    await audit(base44, user, { acao: 'Criação', modulo: 'Financeiro', entidade: 'Intercompany', registro_id: pagar.id, descricao: 'Transferência interempresas criada', empresa_id: fromId, group_id: groupId, dados_novos: { from_empresa_id: fromId, to_empresa_id: toId, valor, conta_receber_id: receber.id } });
    return Response.json({ ok: true, pagar_id: pagar.id, receber_id: receber.id });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});