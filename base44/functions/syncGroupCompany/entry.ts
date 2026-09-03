import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { z } from 'npm:zod@3.24.2';
import { completeGuardCallScope, recordMatchesGuardScope, requireEntityGuard } from './_lib/security/guardCallPolicy.js';

function pickAllowed(entityName, data) {
  // Remove read-only fields and IDs
  const clone = { ...data };
  delete clone.id; delete clone.created_date; delete clone.updated_date; delete clone.created_by;
  // NotaFiscal nunca é espelhada entre escopos
  if (entityName === 'NotaFiscal') return null;
  return clone;
}

const reportSyncFailure = (operation, error, context = {}) => {
  console.error('[syncGroupCompany] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

async function listEmpresasByGroup(base44, groupId) {
  try {
    const empresas = await base44.asServiceRole.entities.Empresa.filter({ group_id: groupId }, undefined, 500);
    return Array.isArray(empresas) ? empresas : [];
  } catch (error) {
    reportSyncFailure('listar-empresas-do-grupo', error, { group_id: groupId });
    throw error;
  }
}

async function auditSync(base44, user, scope, summary) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: user ? (user.full_name || user.email || 'Usuario') : 'Sistema Agendado',
      usuario_id: user?.id || null,
      acao: summary.event_type === 'delete' ? 'Exclusao' : 'Sincronizacao',
      modulo: 'Sistema',
      tipo_auditoria: 'sistema',
      entidade: summary.entity_name,
      descricao: 'Sincronizacao segura entre Grupo e Empresas',
      dados_novos: summary,
      group_id: scope.groupId,
      empresa_id: scope.empresaId || null,
      data_hora: new Date().toISOString(),
    });
  } catch (error) {
    reportSyncFailure('auditoria', error, {
      group_id: scope.groupId,
      empresa_id: scope.empresaId || null,
      entity_name: summary.entity_name,
    });
  }
}

function nowIso() { return new Date().toISOString(); }

// Retry helper (idempotent best-effort)
async function doWithRetry(fn, tries = 3, delayMs = 300) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < tries - 1) { await new Promise(r => setTimeout(r, delayMs * (i + 1))); } }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Automations call with payload: { event, data, old_data, payload_too_large }
    const raw = await req.json().catch(() => ({}));
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (error) {
      reportSyncFailure('autenticacao', error);
    }
    const internalToken = raw?.internal_token || req.headers.get('x-internal-token') || null;
    const expectedToken = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
    const trustedInternal = Boolean(internalToken && expectedToken && internalToken === expectedToken);
    if (!user && !trustedInternal) {
      return Response.json({ error: 'Forbidden: internal automation token required' }, { status: 403 });
    }

    const EventSchema = z.object({
      event: z.object({
        entity_name: z.string(),
        type: z.enum(['create','update','delete']),
        entity_id: z.string()
      }),
      data: z.record(z.any()).optional(),
      old_data: z.record(z.any()).optional(),
      payload_too_large: z.boolean().optional()
    }).passthrough();
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: 'Evento inválido', issues: parsed.error.issues }, { status: 400 });
    }
    const body = parsed.data;
    const event = body?.event || {};
    const entityName = event?.entity_name;
    const eventType = event?.type; // create | update | delete
    const entityId = event?.entity_id;

    if (!entityName || !eventType || !entityId || !/^[A-Za-z][A-Za-z0-9]*$/.test(entityName)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const entityApi = base44.asServiceRole.entities?.[entityName];
    if (!entityApi || typeof entityApi.get !== 'function') {
      return Response.json({ error: 'Entidade nao suportada' }, { status: 400 });
    }

    // Carrega o registro atual (delete pode não ter data)
    let record = body?.data;
    if (!record && eventType !== 'delete') {
      record = await entityApi.get(entityId);
    }

    // Regras NF-e: nunca sincronizar (apenas política separada em nfeActions)
    if (entityName === 'NotaFiscal') {
      return Response.json({ ok: true, skipped: 'NotaFiscal' });
    }

    const sourceRecord = record || body?.old_data || {};
    const scope = await completeGuardCallScope(base44, sourceRecord);
    if (!scope.groupId) {
      return Response.json({ error: 'Contexto multiempresa incompleto' }, { status: 400 });
    }
    const empresas = await listEmpresasByGroup(base44, scope.groupId);
    const empresasById = new Map(empresas.map((empresa) => [empresa.id, empresa]));
    if (scope.empresaId && !empresasById.has(scope.empresaId)) {
      return Response.json({ error: 'Empresa fora do grupo informado' }, { status: 403 });
    }

    const scopedSource = {
      ...sourceRecord,
      group_id: scope.groupId,
      ...(scope.empresaId ? { empresa_id: scope.empresaId } : {}),
    };
    if (!recordMatchesGuardScope(scopedSource, {
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
    })) {
      return Response.json({ error: 'Registro fora do contexto informado' }, { status: 403 });
    }
    if (eventType !== 'delete') record = scopedSource;

    if (user) {
      const guardFailure = await requireEntityGuard(base44, {
        module: 'Sistema',
        section: 'SyncGroupCompany',
        action: eventType,
        group_id: scope.groupId,
        empresa_id: scope.empresaId,
      });
      if (guardFailure) return guardFailure;
    }

    const groupId = scope.groupId;
    const empresaId = scope.empresaId;

    // Proteção anti-loop: mapas ficam restritos ao grupo resolvido.
    const existingMaps = await base44.asServiceRole.entities.SyncMap.filter({
      entity_name: entityName,
      group_id: groupId,
    });
    const scopedMaps = (existingMaps || []).filter((map) =>
      map.group_id === groupId && (!map.empresa_id || empresasById.has(map.empresa_id))
    );
    const mapsById = scopedMaps.filter(m => m.source_id === entityId || m.target_id === entityId);
    const recent = mapsById.find(m => {
      const t = new Date(m.last_sync_at || 0).getTime();
      return Date.now() - t < 2500; // 2.5s janela anti-loop
    });
    if (recent) {
      return Response.json({ ok: true, ignored: 'recent-sync' });
    }

    // DELETE: apagar somente espelhos comprovadamente pertencentes ao mesmo contexto.
    if (eventType === 'delete') {
      let deleted = 0;
      let failed = 0;
      for (const map of mapsById) {
        const counterpartId = map.source_id === entityId ? map.target_id : map.source_id;
        const counterpartIsCompany =
          (map.direction === 'up' && map.source_id === counterpartId) ||
          (map.direction === 'down' && map.target_id === counterpartId);
        const counterpartScope = {
          group_id: groupId,
          empresa_id: counterpartIsCompany ? map.empresa_id : null,
        };
        try {
          if (counterpartIsCompany && !empresasById.has(map.empresa_id)) {
            throw new Error('Empresa do mapa fora do grupo');
          }
          const counterpart = await entityApi.get(counterpartId);
          if (!recordMatchesGuardScope(counterpart, counterpartScope)) {
            throw new Error('Espelho fora do contexto do mapa');
          }
          await entityApi.delete(counterpartId);
          await base44.asServiceRole.entities.SyncMap.delete(map.id);
          deleted += 1;
        } catch (error) {
          failed += 1;
          reportSyncFailure('excluir-espelho', error, {
            group_id: groupId,
            empresa_id: map.empresa_id || null,
            entity_name: entityName,
            map_id: map.id,
          });
        }
      }
      await auditSync(base44, user, scope, {
        entity_name: entityName,
        event_type: eventType,
        direction: 'delete',
        source_id: entityId,
        deleted,
        failed,
      });
      return Response.json({ ok: true, deleted, failed });
    }

    // CREATE/UPDATE: bidirecional
    if (empresaId) {
      // empresa -> grupo (UP)
      const upMap = mapsById.find((map) => map.direction === 'up' && map.empresa_id === empresaId);
      const payload = pickAllowed(entityName, record);
      if (!payload) return Response.json({ ok: true, skipped: 'not-allowed' });
      delete payload.empresa_id;
      payload.group_id = groupId;

      let targetId = upMap?.target_id || null;
      let action = 'created';
      if (targetId) {
        const current = await entityApi.get(targetId);
        if (!recordMatchesGuardScope(current, { group_id: groupId })) {
          return Response.json({ error: 'Espelho consolidado fora do grupo' }, { status: 403 });
        }
        const mergeRes = await base44.asServiceRole.functions.invoke('conflictPolicy', {
          entity_name: entityName,
          group_id: groupId,
          empresa_id: empresaId,
          source: 'up',
          current,
          incoming: payload,
        });
        const merged = (mergeRes?.data && (mergeRes.data.merged || mergeRes.data)) || payload;
        await doWithRetry(() => entityApi.update(targetId, { ...merged, group_id: groupId, empresa_id: undefined }));
        await doWithRetry(() => base44.asServiceRole.entities.SyncMap.update(upMap.id, { last_sync_at: nowIso() }));
        action = 'updated';
      } else {
        const mergeRes = await base44.asServiceRole.functions.invoke('conflictPolicy', {
          entity_name: entityName,
          group_id: groupId,
          empresa_id: empresaId,
          source: 'up',
          current: {},
          incoming: payload,
        });
        const merged = (mergeRes?.data && (mergeRes.data.merged || mergeRes.data)) || payload;
        const created = await doWithRetry(() => entityApi.create({ ...merged, group_id: groupId, empresa_id: undefined }));
        targetId = created.id;
        await doWithRetry(() => base44.asServiceRole.entities.SyncMap.create({
          entity_name: entityName,
          group_id: groupId,
          empresa_id: empresaId,
          source_id: entityId,
          target_id: targetId,
          direction: 'up',
          last_sync_at: nowIso(),
        }));
      }

      await auditSync(base44, user, scope, {
        entity_name: entityName,
        event_type: eventType,
        direction: 'up',
        source_id: entityId,
        target_id: targetId,
        action,
      });
      return Response.json({ ok: true, direction: 'up', action });
    }

    // grupo -> empresas (DOWN)
    const payload = pickAllowed(entityName, record);
    if (!payload) return Response.json({ ok: true, skipped: 'not-allowed' });
    const results = [];
    for (const empresa of empresas) {
      const empId = empresa.id;
      const map = scopedMaps.find((candidate) =>
        candidate.source_id === entityId &&
        candidate.empresa_id === empId &&
        candidate.direction === 'down'
      );
      let targetId = map?.target_id || null;
      const dataDown = { ...payload, group_id: groupId, empresa_id: empId };
      if (targetId) {
        const current = await entityApi.get(targetId);
        if (!recordMatchesGuardScope(current, { group_id: groupId, empresa_id: empId })) {
          return Response.json({ error: 'Espelho fora da empresa do grupo' }, { status: 403 });
        }
        const mergeRes = await base44.asServiceRole.functions.invoke('conflictPolicy', {
          entity_name: entityName,
          group_id: groupId,
          empresa_id: empId,
          source: 'down',
          current,
          incoming: dataDown,
        });
        const merged = (mergeRes?.data && (mergeRes.data.merged || mergeRes.data)) || dataDown;
        await doWithRetry(() => entityApi.update(targetId, {
          ...merged,
          group_id: groupId,
          empresa_id: empId,
        }));
        await doWithRetry(() => base44.asServiceRole.entities.SyncMap.update(map.id, { last_sync_at: nowIso() }));
        results.push({ empresa_id: empId, action: 'updated' });
      } else {
        const mergeRes = await base44.asServiceRole.functions.invoke('conflictPolicy', {
          entity_name: entityName,
          group_id: groupId,
          empresa_id: empId,
          source: 'down',
          current: {},
          incoming: dataDown,
        });
        const merged = (mergeRes?.data && (mergeRes.data.merged || mergeRes.data)) || dataDown;
        const created = await doWithRetry(() => entityApi.create({
          ...merged,
          group_id: groupId,
          empresa_id: empId,
        }));
        targetId = created.id;
        await doWithRetry(() => base44.asServiceRole.entities.SyncMap.create({
          entity_name: entityName,
          group_id: groupId,
          empresa_id: empId,
          source_id: entityId,
          target_id: targetId,
          direction: 'down',
          last_sync_at: nowIso(),
        }));
        results.push({ empresa_id: empId, action: 'created' });
      }
    }

    const created = results.filter((result) => result.action === 'created').length;
    const updated = results.filter((result) => result.action === 'updated').length;
    await auditSync(base44, user, scope, {
      entity_name: entityName,
      event_type: eventType,
      direction: 'down',
      source_id: entityId,
      companies_total: results.length,
      created,
      updated,
    });
    return Response.json({ ok: true, direction: 'down', results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});