/**
 * upsertConfig — Atualiza ou cria um ConfiguracaoSistema de forma confiável.
 * CORREÇÃO DEFINITIVA dos toggles:
 *  - Busca SEMPRE pelo escopo exato (empresa_id + group_id)
 *  - Merge de dados nunca sobrescreve campos existentes com undefined
 *  - Retorna o registro salvo para confirmação no frontend
 *
 * Modos:
 *  - { id, data, chave?, scope? }   → update direto pelo ID
 *  - { chave, data, scope }         → upsert por chave+scope
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
// upsertConfig v2 — escopo exato, sem fallback cross-scope, auditoria resumida

const SYSTEM_FIELDS = new Set(['id','created_date','updated_date','created_by','created_by_id','is_sample']);
const SENSITIVE_CONFIG_KEY = /(token|senha|password|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|certificado|private|webhook[_-]?secret)/i;

const summarizeConfigValue = (value) => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return { tipo: 'array', quantidade: value.length };
  if (typeof value === 'object') return { tipo: 'object', chaves: Object.keys(value).length };
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  return { tipo: 'string', tamanho: String(value).length };
};

const buildConfigAuditSnapshot = (config = {}, action = null) => {
  const keys = Object.keys(config || {}).filter((key) => !SYSTEM_FIELDS.has(key));
  const changedKeys = keys.filter((key) => !['chave','categoria','empresa_id','group_id','grupo_id'].includes(key));
  const sensitiveKeys = changedKeys.filter((key) => SENSITIVE_CONFIG_KEY.test(key));
  const safeValues = {};
  for (const key of changedKeys) {
    safeValues[key] = SENSITIVE_CONFIG_KEY.test(key) ? { protegido: true } : summarizeConfigValue(config[key]);
  }
  return {
    action,
    id: config?.id || null,
    chave: config?.chave || null,
    categoria: config?.categoria || null,
    empresa_id: config?.empresa_id || null,
    group_id: config?.group_id || config?.grupo_id || null,
    campos: changedKeys,
    campos_sensiveis: sensitiveKeys,
    valores: safeValues,
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const { id, chave, data, scope } = body;

    if (!data || typeof data !== 'object') {
      return Response.json({ error: 'data é obrigatório' }, { status: 400 });
    }
    if (!id && !chave) {
      return Response.json({ error: 'Forneça id ou chave' }, { status: 400 });
    }

    const api = base44.asServiceRole.entities.ConfiguracaoSistema;

    // ─── MODO 1: Update direto por ID ─────────────────────────────────────────
    if (id) {
      let existing = null;
      try {
        const rows = await api.filter({ id }, '-updated_date', 1);
        existing = Array.isArray(rows) ? (rows[0] || null) : null;
      } catch (_) {}

      if (!existing) {
        return Response.json({ error: `Registro ${id} não encontrado` }, { status: 404 });
      }

      // Merge cuidadoso: apenas os campos enviados em data são atualizados
      const updatePayload = {};
      // Copia campos existentes que NÃO foram enviados em data
      for (const [k, v] of Object.entries(existing)) {
        if (!SYSTEM_FIELDS.has(k)) updatePayload[k] = v;
      }
      // Aplica os campos do data (sobrescreve apenas os enviados)
      for (const [k, v] of Object.entries(data)) {
        if (!SYSTEM_FIELDS.has(k)) updatePayload[k] = v;
      }
      // Garante chave e scope
      if (chave) updatePayload.chave = chave;
      if (scope?.group_id) updatePayload.group_id = scope.group_id;
      if (scope?.empresa_id) updatePayload.empresa_id = scope.empresa_id;

      const updated = await api.update(id, updatePayload);

      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Sistema',
          usuario_id: user?.id || null,
          empresa_id: updatePayload.empresa_id || existing.empresa_id || null,
          group_id: updatePayload.group_id || existing.group_id || existing.grupo_id || null,
          acao: 'Edicao',
          modulo: 'Sistema',
          tipo_auditoria: 'entidade',
          entidade: 'ConfiguracaoSistema',
          registro_id: updated?.id || id,
          descricao: `Configuracao ${updatePayload.chave || existing.chave || id} atualizada por ID`,
          dados_anteriores: buildConfigAuditSnapshot(existing, 'before_update_by_id'),
          dados_novos: buildConfigAuditSnapshot(updatePayload, 'update_by_id'),
          data_hora: new Date().toISOString(),
        });
      } catch (_) {}

      return Response.json({ record: updated, id: updated.id || id, mode: 'update', _ts: Date.now() });
    }

    // ─── MODO 2: Upsert por chave + scope ────────────────────────────────────
    const gId = scope?.group_id || null;
    const eId = scope?.empresa_id || null;

    // Busca progressiva do mais específico para o menos específico
    const tryFind = async (filtro) => {
      try {
        const rows = await api.filter(filtro, '-updated_date', 5);
        return Array.isArray(rows) ? (rows[0] || null) : null;
      } catch (_) { return null; }
    };

    let match = null;

    // 1) Exato: chave + empresa + grupo (mais específico)
    if (!match && eId && gId) {
      match = await tryFind({ chave, empresa_id: eId, group_id: gId });
    }
    // 2) Chave + só empresa — apenas quando o escopo NÃO tem grupo
    if (!match && eId && !gId) {
      match = await tryFind({ chave, empresa_id: eId });
    }
    // 3) Chave + só grupo — apenas quando o escopo NÃO tem empresa
    if (!match && gId && !eId) {
      match = await tryFind({ chave, group_id: gId });
    }
    // 4) Fallback: qualquer registro com essa chave (apenas quando sem scope)
    if (!match && !eId && !gId) {
      match = await tryFind({ chave });
    }

    if (match?.id) {
      // ATUALIZA — merge dos campos existentes com os novos, nunca perde dados
      // AUDITORIA: Log em AuditLog
      const updatePayload = {};
      for (const [k, v] of Object.entries(match)) {
        if (!SYSTEM_FIELDS.has(k)) updatePayload[k] = v;
      }
      for (const [k, v] of Object.entries(data)) {
        if (!SYSTEM_FIELDS.has(k)) updatePayload[k] = v;
      }
      // Força chave e categoria
      updatePayload.chave = chave;
      if (data.categoria) updatePayload.categoria = data.categoria;
      else if (match.categoria) updatePayload.categoria = match.categoria;
      // Mantém scope (nunca sobrescreve)
      if (!updatePayload.empresa_id && eId) updatePayload.empresa_id = eId;
      if (!updatePayload.group_id && gId) updatePayload.group_id = gId;

      const updated = await api.update(match.id, updatePayload);
      
      // Log de auditoria da alteração
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Sistema',
          usuario_id: user?.id || null,
          empresa_id: eId || null,
          group_id: gId || null,
          acao: 'Edicao',
          modulo: 'Sistema',
          tipo_auditoria: 'entidade',
          entidade: 'ConfiguracaoSistema',
          registro_id: match.id,
          descricao: `Configuração ${chave} atualizada`,
          dados_anteriores: buildConfigAuditSnapshot(match, 'before_update'),
          dados_novos: buildConfigAuditSnapshot(updatePayload, 'update'),
          data_hora: new Date().toISOString(),
        });
      } catch (_) {}

      return Response.json({ record: updated, id: updated.id || match.id, mode: 'update', _ts: Date.now() });
    } else {
      // CRIA novo registro
      const createPayload = { chave, ...data };
      if (eId) createPayload.empresa_id = eId;
      if (gId) createPayload.group_id = gId;

      const created = await api.create(createPayload);
      
      // Log de auditoria da criação
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Sistema',
          usuario_id: user?.id || null,
          empresa_id: eId || null,
          group_id: gId || null,
          acao: 'Criacao',
          modulo: 'Sistema',
          tipo_auditoria: 'entidade',
          entidade: 'ConfiguracaoSistema',
          registro_id: created.id,
          descricao: `Configuração ${chave} criada`,
          dados_novos: buildConfigAuditSnapshot(createPayload, 'create'),
          data_hora: new Date().toISOString(),
        });
      } catch (_) {}

      return Response.json({ record: created, id: created.id, mode: 'create', _ts: Date.now() });
    }

  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
});