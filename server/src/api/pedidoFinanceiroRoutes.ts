import type { Express, Request } from 'express';
import { z } from 'zod';
import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type { RbacGuard } from '../db/rbacGuard.js';
import { PostgresAuditRepository } from '../audit/auditRepository.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import { projetarParcelasFaturamento, quantizarTotalPedidoParaFaturamento } from '../services/faturamentoParcelasPolicy.js';
import { AppError } from './errors.js';

const params = z.object({ id: z.string().uuid() });
const invoice = z.object({ centro_custo_id: z.string().uuid(), plano_contas_id: z.string().uuid() }).strict();
const receipt = z.object({ parcela: z.number().int().min(1).max(120),
  evento: z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/),
  valor: z.string().regex(/^(?:0|[1-9]\d{0,13})\.\d{2}$/).refine(value => value !== '0.00'),
}).strict();
function reject(status: number, code: string): never {
  throw new AppError(status, code, 'Operacao financeira recusada');
}

export function mountPedidoFinanceiroRoutes(app: Express, db: DbClient, rbac: RbacGuard) {
  const audit = new PostgresAuditRepository(db);
  const base = '/api/v1/pedidos/:id';
  function run(req: Request, action: 'faturar' | 'baixar' | 'visualizar',
    work: (q: DbQueryExecutor, ctx: { groupId: string; empresaId: string; actorId: string; requestId: string }, scope: string[]) => Promise<unknown>) {
    if (!req.authVerified || !req.actorId) reject(401, 'AUTH_REQUIRED');
    if (!req.groupId || !req.empresaId || req.scopeType !== 'empresa') reject(403, 'EMPRESA_REQUIRED');
    const parsed = params.safeParse(req.params);
    if (!parsed.success) reject(422, 'PEDIDO_INVALIDO');
    const ctx = { groupId: req.groupId, empresaId: req.empresaId, actorId: req.actorId, requestId: req.requestId };
    return db.withTransaction(async q => {
      const { rows: [binding] } = await q.query("SELECT current_schema() AS ns, current_schemas(true)::text[] AS path, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user");
      if (!binding?.ns || ['public', 'pg_catalog', 'information_schema'].includes(binding.ns)
          || binding.path.length !== 2 || binding.path[0] !== binding.ns || binding.path[1] !== 'pg_catalog'
          || binding.rolsuper || binding.rolbypassrls) reject(503, 'FINANCEIRO_SCHEMA_INVALIDO');
      await q.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)", [ctx.groupId, ctx.empresaId]);
      await rbac.assertAllowed(ctx, action === 'faturar' ? 'Comercial' : 'Financeiro',
        action === 'faturar' ? 'pedidos' : 'contas_receber', action, { executor: q, allowGlobalWildcard: false });
      return work(q, ctx, [parsed.data.id, ctx.groupId, ctx.empresaId]);
    });
  }
  const scopeWhere = 'pedido_id=$1 AND group_id=$2 AND empresa_id=$3';
  const titles = async (q: DbQueryExecutor, scope: string[]) => (await q.query(
    'SELECT parcela, data_vencimento::text, valor::text, valor_recebido::text, (valor-valor_recebido)::text AS saldo FROM contas_receber WHERE ' + scopeWhere + ' ORDER BY parcela', scope,
  )).rows;

  app.post(base + '/faturar', requireTenantScope, async (req, res, next) => {
    try {
      const data = await run(req, 'faturar', async (q, ctx, scope) => {
        const parsed = invoice.safeParse(req.body);
        if (!parsed.success) reject(422, 'FATURAMENTO_VINCULOS_OBRIGATORIOS');
        const { centro_custo_id, plano_contas_id } = parsed.data;
        const { rows: [order] } = await q.query(
          'SELECT status, ativo, total::text, condicao_pagamento_id FROM pedidos WHERE id=$1 AND group_id=$2 AND empresa_id=$3 FOR UPDATE', scope);
        if (!order) reject(404, 'PEDIDO_NAO_ENCONTRADO');
        if (!order.ativo || !['PRONTO_ENTREGA', 'PRONTO_RETIRADA', 'FINALIZADO'].includes(order.status))
          reject(409, 'PEDIDO_NAO_FATURAVEL');
        const { rows: [prior] } = await q.query(
          'SELECT centro_custo_id, plano_contas_id FROM contas_receber WHERE ' + scopeWhere + ' LIMIT 1', scope);
        if (prior) {
          if (prior.centro_custo_id !== centro_custo_id || prior.plano_contas_id !== plano_contas_id)
            reject(409, 'FATURAMENTO_VINCULOS_DIVERGENTES');
          return { replay: true, titulos: await titles(q, scope) };
        }
        const { rows: terms } = await q.query(
          `SELECT p.ordem,p.dias,p.percentual::text FROM condicao_pagamento_parcelas p
          JOIN condicoes_pagamento c ON (c.id,c.group_id)=(p.condicao_pagamento_id,p.group_id)
          JOIN condicao_pagamento_empresas e ON (e.condicao_pagamento_id,e.group_id)=(c.id,c.group_id)
          WHERE p.group_id=$1 AND e.empresa_id=$2 AND c.id=$3 AND p.ativo AND c.ativo AND e.ativo ORDER BY p.ordem`,
          [ctx.groupId, ctx.empresaId, order.condicao_pagamento_id]);
        const parts = projetarParcelasFaturamento(quantizarTotalPedidoParaFaturamento(order.total), new Date().toISOString().slice(0,10), terms);
        try {
          for (const part of parts) await q.query(`INSERT INTO contas_receber
            (pedido_id,group_id,empresa_id,parcela,data_vencimento,valor,centro_custo_id,plano_contas_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [...scope, part.ordem, part.vencimento, part.valor, centro_custo_id, plano_contas_id]);
        } catch (error) {
          if ((error as { code?: string }).code === '23503') reject(422, 'FATURAMENTO_VINCULO_FORA_DA_EMPRESA');
          throw error;
        }
        await audit.append({ ...ctx, entity: 'FaturamentoPedido', entityId: scope[0], action: 'create',
          afterData: { centro_custo_id, plano_contas_id, parcelas: parts.length } }, q);
        return { replay: false, titulos: await titles(q, scope) };
      });
      res.set('Cache-Control', 'no-store').json({ data });
    } catch (error) { next(error); }
  });

  app.get(base + '/titulos', requireTenantScope, async (req, res, next) => {
    try {
      const data = await run(req, 'visualizar', async (q, _ctx, scope) => {
        const rows = await titles(q, scope);
        if (!rows.length) reject(404, 'TITULO_NAO_ENCONTRADO');
        return rows;
      });
      res.set('Cache-Control', 'no-store').json({ data });
    } catch (error) { next(error); }
  });

  app.post(base + '/titulos/baixa', requireTenantScope, async (req, res, next) => {
    try {
      const data = await run(req, 'baixar', async (q, ctx, scope) => {
        const parsed = receipt.safeParse(req.body);
        if (!parsed.success) reject(422, 'RECEBIMENTO_INVALIDO');
        const { parcela, evento, valor } = parsed.data;
        const key = [...scope, parcela];
        if (!(await q.query('SELECT parcela FROM contas_receber WHERE ' + scopeWhere + ' AND parcela=$4 FOR UPDATE', key)).rowCount)
          reject(404, 'TITULO_NAO_ENCONTRADO');
        const { rows: [prior] } = await q.query(
          'SELECT valor::text FROM contas_receber_recebimentos WHERE ' + scopeWhere + ' AND parcela=$4 AND evento=$5', [...key, evento]);
        if (prior) {
          if (prior.valor !== valor) reject(409, 'RECEBIMENTO_EVENTO_DIVERGENTE');
          return { replay: true, titulos: await titles(q, scope) };
        }
        const updated = await q.query('UPDATE contas_receber SET valor_recebido=valor_recebido+$5::numeric WHERE ' +
          scopeWhere + ' AND parcela=$4 AND valor_recebido+$5::numeric<=valor', [...key, valor]);
        if (!updated.rowCount) reject(409, 'RECEBIMENTO_EXCEDE_SALDO');
        await q.query('INSERT INTO contas_receber_recebimentos VALUES ($1,$2,$3,$4,$5,$6)', [...key, evento, valor]);
        await audit.append({ ...ctx, entity: 'RecebimentoPedido', entityId: scope[0], action: 'create',
          afterData: { parcela, evento, valor } }, q);
        return { replay: false, titulos: await titles(q, scope) };
      });
      res.set('Cache-Control', 'no-store').json({ data });
    } catch (error) { next(error); }
  });
}
