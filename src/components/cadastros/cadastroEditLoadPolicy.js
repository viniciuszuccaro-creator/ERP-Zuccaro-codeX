/**
 * Carga/edição fail-closed de cadastros no Visualizador universal.
 * Extraído para testes e reuso (lote Empresas / Cadastros Gerais).
 */
import { isTenantMasterEntity } from '../lib/contextoMultiempresaPolicy.js';

/**
 * Fail-closed: edição só com registro completo (id bate + campos mínimos).
 * Empresa exige razão/nome + CNPJ para não salvar projeção incompleta da grade.
 */
export function isCadastroEditLoadComplete(entityName, record, expectedId) {
  if (!record || !expectedId || String(record.id) !== String(expectedId)) return false;
  if (String(entityName || '') === 'Empresa') {
    const nome = String(record.razao_social || record.nome || record.nome_fantasia || '').trim();
    const doc = String(record.cnpj || '').replace(/\D/g, '');
    return Boolean(nome) && doc.length >= 11;
  }
  return true;
}

/**
 * Aliases administrativos legítimos (owner/admin) alinhados aos forms Empresa/Grupo.
 * Não libera role=admin sozinha — exige árvore de permissão explícita.
 */
export function hasCadastroEntityPermission(entityName, action, checkers = {}) {
  const entity = String(entityName || '');
  const act = String(action || 'visualizar');
  const hasPermission = typeof checkers.hasPermission === 'function' ? checkers.hasPermission : null;
  const canCreate = typeof checkers.canCreate === 'function' ? checkers.canCreate : null;
  const canEdit = typeof checkers.canEdit === 'function' ? checkers.canEdit : null;
  const canDelete = typeof checkers.canDelete === 'function' ? checkers.canDelete : null;
  const isTenantMaster = entity === 'Empresa' || entity === 'GrupoEmpresarial';

  // Cadastros em módulo amplo (null) — admin explícito do módulo.
  if (act === 'visualizar' && hasPermission && hasPermission('Cadastros', null, 'visualizar')) return true;
  if (act === 'criar' && canCreate && canCreate('Cadastros', null)) return true;
  if (act === 'editar' && canEdit && canEdit('Cadastros', null)) return true;
  if (act === 'excluir' && canDelete && canDelete('Cadastros', null)) return true;

  if (isTenantMaster) {
    // Mutação: gate canônico Organizacional (#227/#228). Cadastros.Empresa sozinho NÃO grava.
    if (act === 'visualizar') {
      if (hasPermission && (
        hasPermission('Cadastros', 'Organizacional', 'visualizar')
        || hasPermission('Cadastros', entity, 'visualizar')
      )) return true;
    } else if (act === 'criar') {
      if (canCreate && canCreate('Cadastros', 'Organizacional')) return true;
    } else if (act === 'editar') {
      if (canEdit && canEdit('Cadastros', 'Organizacional')) return true;
    } else if (act === 'excluir') {
      if (canDelete && canDelete('Cadastros', 'Organizacional')) return true;
    }
  } else {
    if (act === 'visualizar') {
      if (hasPermission && hasPermission('Cadastros', entity, 'visualizar')) return true;
    } else if (act === 'criar') {
      if (canCreate && canCreate('Cadastros', entity)) return true;
    } else if (act === 'editar') {
      if (canEdit && canEdit('Cadastros', entity)) return true;
    } else if (act === 'excluir') {
      if (canDelete && canDelete('Cadastros', entity)) return true;
    }
  }

  // Alias admin Sistema (owner legítimo) — alinhado ao localBase44.
  if (entity === 'Empresa') {
    if (act === 'visualizar') return Boolean(hasPermission && hasPermission('Sistema', 'Empresas', 'visualizar'));
    if (act === 'criar') return Boolean(canCreate && canCreate('Sistema', 'Empresas'));
    if (act === 'editar') return Boolean(canEdit && canEdit('Sistema', 'Empresas'));
    if (act === 'excluir') return Boolean(canDelete && canDelete('Sistema', 'Empresas'));
  }
  if (entity === 'GrupoEmpresarial') {
    if (act === 'visualizar') return Boolean(hasPermission && hasPermission('Sistema', 'Grupos', 'visualizar'));
    if (act === 'criar') return Boolean(canCreate && canCreate('Sistema', 'Grupos'));
    if (act === 'editar') return Boolean(canEdit && canEdit('Sistema', 'Grupos'));
    if (act === 'excluir') return Boolean(canDelete && canDelete('Sistema', 'Grupos'));
  }
  return false;
}

/**
 * Monta payload de save preservando id/vínculos do registro carregado.
 * Fail-closed se edição com carga incompleta.
 * Tenant masters: não carimba empresa_id do contexto.
 */
export function buildCadastroEditSavePayload(entityName, editItem, formData, ctx = {}) {
  const groupId = ctx.groupId || null;
  const empresaId = ctx.empresaId || null;
  const tenantMaster = isTenantMasterEntity(entityName);

  if (editItem && editItem.id) {
    if (!isCadastroEditLoadComplete(entityName, editItem, editItem.id)) {
      throw new Error('Salvamento bloqueado: carga do registro incompleta. Reabra a edicao.');
    }
  }

  const base = (editItem && editItem.id) ? editItem : {};
  const clean = Object.assign({}, base, formData || {});
  delete clean._action;

  if (!tenantMaster && !clean.empresa_id && empresaId) clean.empresa_id = empresaId;
  if (!clean.group_id && groupId) clean.group_id = groupId;
  if (tenantMaster && editItem && !editItem.empresa_id) delete clean.empresa_id;

  if (tenantMaster) {
    if (!clean.group_id) {
      throw new Error('Contexto de grupo obrigatorio para salvar Empresa/Grupo.');
    }
  } else if (!clean.group_id && !clean.empresa_id) {
    throw new Error('Contexto de grupo/empresa obrigatorio para salvar cadastro.');
  }

  if (editItem && editItem.id) {
    clean.id = editItem.id;
    if (editItem.group_id) clean.group_id = editItem.group_id;
    if (editItem.grupo_id && !clean.grupo_id) clean.grupo_id = editItem.grupo_id;
    if (!tenantMaster && editItem.empresa_id && !clean.empresa_id) clean.empresa_id = editItem.empresa_id;
  }
  return clean;
}

/**
 * Fail-closed de isolamento multiempresa na carga de cadastro.
 * Empresa/GrupoEmpresarial: só valida group_id (cadastro no grupo).
 */
export function assertCadastroRecordInTenant(entityName, record, ctx = {}, campo = 'empresa_id') {
  if (!record || !record.id) return null;
  const groupId = ctx.groupId || null;
  const empresaId = ctx.empresaId || null;
  const scopeType = ctx.scopeType || null;
  if (groupId && record.group_id && String(record.group_id) !== String(groupId)) {
    throw new Error('Registro fora do grupo ativo — carga bloqueada.');
  }
  if (
    !isTenantMasterEntity(entityName)
    && empresaId
    && record[campo]
    && String(record[campo]) !== String(empresaId)
    && scopeType === 'empresa'
  ) {
    throw new Error('Registro fora da empresa ativa — carga bloqueada.');
  }
  return record;
}
