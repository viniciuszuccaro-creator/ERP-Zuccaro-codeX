import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { AuditRepository, RequestContext } from '../audit/types.js';
import type { TenantGuard } from '../db/tenantGuard.js';
import type { RbacGuard } from '../db/rbacGuard.js';

const purposes = ['atendimento_analise', 'atendimento_intencao', 'comercial_produtos', 'fiscal_validacao', 'entrega_previsao', 'financeiro_conciliacao'] as const;
const requestSchema = z.object({
  purpose: z.enum(purposes), prompt: z.string().trim().min(1).max(32000),
  group_id: z.string().uuid(), empresa_id: z.string().uuid().nullable(),
  response_json_schema: z.record(z.unknown()).optional(),
  tipo_ia: z.literal('previsao_entrega').optional(),
}).strict();
export type IaContextualInput = z.infer<typeof requestSchema>;
export interface IaProvider {
  invoke(input: Readonly<IaContextualInput>, context: Readonly<RequestContext>, signal: AbortSignal): Promise<unknown>;
}

const domain: Record<IaContextualInput['purpose'], readonly [string, string]> = {
  atendimento_analise: ['CRM', 'interacoes'], atendimento_intencao: ['CRM', 'interacoes'],
  comercial_produtos: ['Comercial', 'pedidos'], fiscal_validacao: ['Fiscal', 'nfe'],
  entrega_previsao: ['Expedição', 'entregas'],
  financeiro_conciliacao: ['Financeiro', 'conciliacao'],
};

function boundedJson(value: unknown, limit: number): boolean {
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === 'string' && Buffer.byteLength(encoded, 'utf8') <= limit;
  } catch { return false; }
}

/** A provider is server-owned; absent configuration never falls back to demo/local data. */
export class IaContextualService {
  constructor(private readonly audit: AuditRepository, private readonly tenant: TenantGuard,
    private readonly rbac: RbacGuard, private readonly provider?: IaProvider) {}

  async invoke(ctx: RequestContext, raw: unknown, disconnected?: AbortSignal): Promise<string | object> {
    if (!z.string().uuid().safeParse(ctx.actorId).success || !z.string().uuid().safeParse(ctx.groupId).success) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Verified user scope required');
    }
    const parsed = requestSchema.safeParse(raw);
    const purpose = parsed.success ? parsed.data.purpose : 'invalid';
    const record = (status: string) => this.audit.append({ groupId: ctx.groupId,
      empresaId: ctx.empresaId, actorId: ctx.actorId, requestId: ctx.requestId,
      entity: 'IaInvocation', action: status === 'denied' ? 'block' : 'read',
      afterData: { purpose, status, mode: 'suggestion_only' } });
    if (!parsed.success || !boundedJson(raw, 150000)) {
      await record('denied');
      throw new AppError(422, 'IA_INPUT_INVALID', 'Invalid IA request');
    }
    const input = parsed.data;
    const assertFinancialRead=async()=>{
      if(input.purpose!=='financeiro_conciliacao')return;
      if(!ctx.empresaId)throw new AppError(403,'IA_SCOPE_DENIED','Company scope required for bank analysis');
      for(const section of ['conciliacao','Caixa','ContaBancariaEmpresa']){
        await this.rbac.assertAllowed(ctx,'Financeiro',section,'visualizar',{allowGlobalWildcard:false});
        await this.rbac.assertAllowed(ctx,'Financeiro',section,'dados-sensiveis.visualizar',{allowGlobalWildcard:false});
      }
    };
    try {
      if (input.group_id !== ctx.groupId || input.empresa_id !== (ctx.empresaId ?? null)
        || (input.tipo_ia && input.purpose !== 'entrega_previsao')) {
        throw new AppError(403, 'IA_SCOPE_DENIED', 'IA context does not match verified scope');
      }
      await this.tenant.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
      const [module, section] = domain[input.purpose];
      await this.rbac.assertAllowed(ctx, module, section, 'visualizar', { allowGlobalWildcard: false });
      await this.rbac.assertAllowed(ctx, 'IA', input.purpose, 'visualizar', { allowGlobalWildcard: false });
      await assertFinancialRead();
    } catch (error) {
      await record('denied');
      throw error;
    }
    if (!this.provider) {
      await record('provider_not_configured');
      throw new AppError(503, 'IA_PROVIDER_NOT_CONFIGURED', 'IA provider is not configured');
    }
    if (disconnected?.aborted) throw new AppError(409, 'IA_REQUEST_CANCELLED', 'IA request cancelled');
    await record('started');
    const controller = new AbortController();
    const signal = disconnected ? AbortSignal.any([controller.signal, disconnected]) : controller.signal;
    let cancel: (() => void) | undefined;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const cancelled = new Promise<never>((_, reject) => {
        cancel = () => reject(new AppError(503, 'IA_PROVIDER_UNAVAILABLE', 'IA request interrupted'));
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
      });
      const invocation = Promise.resolve().then(() => this.provider?.invoke(structuredClone(input), Object.freeze({ ...ctx }), signal))
        .catch(() => { throw new AppError(503, 'IA_PROVIDER_UNAVAILABLE', 'IA provider unavailable'); });
      const result: unknown = await Promise.race([invocation, cancelled]);
      if ((typeof result !== 'string' && (!result || typeof result !== 'object' || Array.isArray(result)))
        || !boundedJson(result, 250000)) throw new AppError(502, 'IA_RESPONSE_INVALID', 'Invalid IA provider response');
      // Re-check permissions before releasing a late provider response.
      const [module, section] = domain[input.purpose];
      await this.tenant.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);
      await this.rbac.assertAllowed(ctx, module, section, 'visualizar', { allowGlobalWildcard: false });
      await this.rbac.assertAllowed(ctx, 'IA', input.purpose, 'visualizar', { allowGlobalWildcard: false });
      await assertFinancialRead();
      if (signal.aborted) throw new AppError(409, 'IA_REQUEST_CANCELLED', 'IA request cancelled');
      await record('completed');
      return result;
    } catch (error) {
      await record('failed');
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'IA_PROVIDER_UNAVAILABLE', 'IA provider unavailable');
    } finally {
      clearTimeout(timeout);
      if (cancel) signal.removeEventListener('abort', cancel);
    }
  }
}
