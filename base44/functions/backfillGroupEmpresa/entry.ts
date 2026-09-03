import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { completeGuardCallScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

const reportBackfillFailure = (operation, error, context = {}) => {
  console.error('[backfillGroupEmpresa] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

const DEFAULT_ENTITIES = [
  'Cliente','Fornecedor','Produto','Pedido','Entrega','ContaPagar','ContaReceber','OrdemCompra','MovimentacaoEstoque','SolicitacaoCompra','Transportadora','Colaborador','CentroCusto','Oportunidade','Interacao','NotaFiscal' // NF será apenas validada (sem alterar)
];
const ALLOWED_ENTITIES = new Set(DEFAULT_ENTITIES);
const READ_ONLY_ENTITIES = new Set(['NotaFiscal']);

function companyFieldFor(entityName) {
  if (entityName === 'Fornecedor' || entityName === 'Transportadora') return 'empresa_dona_id';
  if (entityName === 'Colaborador') return 'empresa_alocada_id';
  if (entityName === 'NotaFiscal') return 'empresa_faturamento_id';
  return 'empresa_id';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    let user = null;
    try {
      user = await base44.auth.me();
    } catch (error) {
      reportBackfillFailure('autenticacao', error);
    }
    const internalToken = body?.internal_token || req.headers.get('x-internal-token') || null;
    const expectedToken = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
    const trustedInternal = Boolean(internalToken && expectedToken && internalToken === expectedToken);
    if (!user && !trustedInternal) {
      return Response.json({ error: 'Forbidden: internal automation token required' }, { status: 403 });
    }
    const requestedEntities = Array.isArray(body?.entities) && body.entities.length ? body.entities : DEFAULT_ENTITIES;
    const invalidEntities = requestedEntities.filter((entityName) => !ALLOWED_ENTITIES.has(entityName));
    if (invalidEntities.length) {
      return Response.json({ error: 'Entidade nao permitida no backfill', entities: invalidEntities }, { status: 400 });
    }
    const entities = [...new Set(requestedEntities)];
    const dryRun = body?.dryRun !== false; // default true
    const forceDryRun = body?.forceDryRun === true;
    const apply = !forceDryRun && body?.apply === true && dryRun === false;
    const requestedLimit = Number(body?.limitPerEntity);
    const limitPerEntity = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(5000, Math.floor(requestedLimit))
      : 1000;

    const scope = await completeGuardCallScope(base44, body || {});
    if (!scope.groupId) {
      return Response.json({ error: 'Contexto multiempresa incompleto' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const empresas = await sr.entities.Empresa.filter({ group_id: scope.groupId }, undefined, 500);
    const empresasById = new Map((empresas || []).map((empresa) => [empresa.id, empresa]));
    if (scope.empresaId && !empresasById.has(scope.empresaId)) {
      return Response.json({ error: 'Empresa fora do grupo informado' }, { status: 403 });
    }
    const targetEmpresas = scope.empresaId ? [empresasById.get(scope.empresaId)] : [...empresasById.values()];

    if (user) {
      const guardFailure = await requireEntityGuard(base44, {
        module: 'Sistema',
        section: 'Ferramentas',
        action: apply ? 'editar' : 'executar',
        group_id: scope.groupId,
        empresa_id: scope.empresaId,
      });
      if (guardFailure) return guardFailure;
    }

    const summary = [];

    for (const entityName of entities) {
      const result = {
        entity: entityName,
        scanned: 0,
        toUpdate: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        readOnly: READ_ONLY_ENTITIES.has(entityName),
      };
      const entityApi = sr.entities?.[entityName];
      const companyField = companyFieldFor(entityName);

      for (const empresa of targetEmpresas) {
        let skip = 0;
        const page = 500;
        while (result.toUpdate < limitPerEntity) {
          let batch;
          try {
            batch = await entityApi.filter({ [companyField]: empresa.id }, '-updated_date', page, skip);
          } catch (error) {
            result.errors += 1;
            reportBackfillFailure('listar-registros', error, {
              entity_name: entityName,
              group_id: scope.groupId,
              empresa_id: empresa.id,
            });
            break;
          }
          if (!batch?.length) break;
          skip += page;
          result.scanned += batch.length;

          for (const record of batch) {
            if (result.toUpdate >= limitPerEntity) break;
            if (record?.[companyField] !== empresa.id) {
              result.errors += 1;
              reportBackfillFailure('registro-fora-da-empresa', new Error('Contexto divergente'), {
                entity_name: entityName,
                group_id: scope.groupId,
                empresa_id: empresa.id,
                record_id: record?.id || null,
              });
              continue;
            }
            if (record?.group_id && record.group_id !== scope.groupId) {
              result.errors += 1;
              reportBackfillFailure('registro-fora-do-grupo', new Error('Contexto divergente'), {
                entity_name: entityName,
                group_id: scope.groupId,
                empresa_id: empresa.id,
                record_id: record?.id || null,
              });
              continue;
            }
            if (record?.group_id === scope.groupId) {
              result.skipped += 1;
              continue;
            }

            result.toUpdate += 1;
            if (result.readOnly || !apply) {
              result.skipped += 1;
              continue;
            }
            try {
              await entityApi.update(record.id, { group_id: scope.groupId });
              result.updated += 1;
            } catch (error) {
              result.errors += 1;
              reportBackfillFailure('atualizar-registro', error, {
                entity_name: entityName,
                group_id: scope.groupId,
                empresa_id: empresa.id,
                record_id: record?.id || null,
              });
            }
          }
        }
      }

      summary.push(result);
      try {
        await sr.entities.AuditLog.create({
          usuario: user ? (user.full_name || user.email || 'Admin') : 'Sistema Agendado',
          usuario_id: user?.id || null,
          acao: apply ? 'Edicao' : 'Visualizacao',
          modulo: 'Sistema',
          tipo_auditoria: 'sistema',
          entidade: 'BackfillMultiempresa',
          descricao: 'Backfill multiempresa processado com escopo estrito',
          dados_novos: {
            group_id: scope.groupId,
            empresa_id: scope.empresaId || null,
            dry_run: !apply,
            resultado: result,
          },
          group_id: scope.groupId,
          empresa_id: scope.empresaId || null,
          data_hora: new Date().toISOString(),
        });
      } catch (error) {
        reportBackfillFailure('auditoria', error, {
          entity_name: entityName,
          group_id: scope.groupId,
          empresa_id: scope.empresaId || null,
        });
      }
    }

    return Response.json({
      ok: true,
      dryRun: forceDryRun ? true : dryRun,
      apply,
      group_id: scope.groupId,
      empresa_id: scope.empresaId || null,
      summary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});