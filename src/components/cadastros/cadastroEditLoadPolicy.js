/**
 * Carga/edição fail-closed de cadastros no Visualizador universal.
 * Extraído para testes e reuso (lote Empresas / Cadastros Gerais).
 */
import { isTenantMasterEntity } from '../lib/contextoMultiempresaPolicy.js';

/** Mesmo formulário, mesmo Grupo/Empresa e, em HTTP, mesmo escopo do Bearer ativo. */
export function isCadastroSelfManagedScopeCurrent(opened, rendered, active) {
  return Boolean(opened && opened.groupId && rendered && active
    && opened.groupId === rendered.groupId && opened.empresaId === rendered.empresaId
    && opened.groupId === active.groupId && opened.empresaId === active.empresaId
    && (!opened.actorId || opened.actorId === active.actorId)
    && (!opened.token || opened.token === active.token));
}

function hasText(...values) {
  return values.some((v) => v != null && String(v).trim() !== '');
}

function digitsDoc(...values) {
  for (const v of values) {
    const d = String(v ?? '').replace(/\D/g, '');
    if (d.length >= 11) return d;
  }
  return '';
}

/**
 * Fail-closed: edição só com registro completo (id bate + campos mínimos de identidade).
 * Empresa / Cliente / Fornecedor / Produto — GET parcial `{id}` NÃO libera salvamento.
 */
export function isCadastroEditLoadComplete(entityName, record, expectedId) {
  if (!record || !expectedId || String(record.id) !== String(expectedId)) return false;
  const entity = String(entityName || '');
  if (entity === 'Empresa') {
    const nome = String(record.razao_social || record.nome || record.nome_fantasia || '').trim();
    const doc = digitsDoc(record.cnpj, record.documento);
    return Boolean(nome) && doc.length >= 11;
  }
  if (entity === 'Cliente' || entity === 'Fornecedor') {
    const nome = hasText(record.razao_social, record.nome, record.nome_completo, record.nome_fantasia);
    const doc = digitsDoc(record.documento, record.cnpj, record.cpf);
    // Identidade mínima: nome + documento (evita liberar projeção incompleta da grade).
    return nome && doc.length >= 11;
  }
  if (entity === 'Produto') {
    const descricao = hasText(record.descricao, record.nome);
    const codigo = hasText(record.codigo, record.cod);
    return descricao && codigo;
  }
  if (entity === 'Marca') {
    return hasText(record.nome_marca, record.nome);
  }
  if (entity === 'GrupoProduto') {
    return hasText(record.nome_grupo, record.nome);
  }
  if (entity === 'SetorAtividade') {
    return hasText(record.nome, record.descricao);
  }
  if (entity === 'UnidadeMedida') {
    return hasText(record.sigla, record.nome_completo, record.nome);
  }
  if (entity === 'Servico') {
    return hasText(record.nome, record.descricao);
  }
  return hasText(record.nome, record.descricao, record.razao_social, record.nome_marca, record.nome_grupo, record.sigla);
}

/**
 * Hidratação de edição:
 * - chave AUSENTE no GET → preserva valor da grade (resposta parcial);
 * - chave PRESENTE no GET (incl. null/'') → aplica (vazio intencional do backend).
 * Salvamento só após classify/isComplete — GET parcial bloqueia save.
 */
export function mergeCadastroEditHydration(listRow, fullRecord) {
  const base = listRow && typeof listRow === 'object' ? { ...listRow } : {};
  const full = fullRecord && typeof fullRecord === 'object' ? fullRecord : {};
  const out = { ...base };
  for (const [key, value] of Object.entries(full)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Distingue falha de carga, carga incompleta e campos realmente ausentes.
 * @returns {{ kind: 'ok'|'load_failed'|'load_incomplete', message: string|null, absentFields?: string[] }}
 */
export function classifyCadastroEditLoad({
  entityName,
  expectedId,
  listRow = null,
  fullRecord = null,
  loadError = null,
} = {}) {
  if (loadError) {
    return {
      kind: 'load_failed',
      message: 'Falha ao carregar registro completo. Campos da lista preservados; salvamento bloqueado ate recarregar.',
    };
  }
  if (!fullRecord || !expectedId || String(fullRecord.id) !== String(expectedId)) {
    return {
      kind: 'load_incomplete',
      message: 'Carregamento incompleto do registro. Salvamento bloqueado ate recarregar.',
    };
  }
  // GET parcial: hidrata com a grade antes do gate de identidade (não esvaziar nome/código).
  const merged = mergeCadastroEditHydration(listRow, fullRecord);
  if (!isCadastroEditLoadComplete(entityName, merged, expectedId)) {
    return {
      kind: 'load_incomplete',
      message: 'Carregamento incompleto do registro. Salvamento bloqueado ate recarregar.',
    };
  }
  const entity = String(entityName || '');
  const watchByEntity = {
    Empresa: ['razao_social', 'nome', 'cnpj'],
    Cliente: ['razao_social', 'nome', 'nome_completo', 'documento', 'cnpj', 'cpf'],
    Fornecedor: ['razao_social', 'nome', 'documento', 'cnpj', 'cpf'],
    Produto: ['descricao', 'nome', 'codigo'],
    Marca: ['nome_marca', 'nome', 'codigo'],
    GrupoProduto: ['nome_grupo', 'nome', 'codigo'],
    SetorAtividade: ['nome', 'descricao', 'codigo'],
    UnidadeMedida: ['sigla', 'nome_completo', 'codigo'],
    Servico: ['nome', 'descricao', 'codigo'],
  };
  const watch = watchByEntity[entity] || ['nome', 'descricao', 'codigo'];
  const absentFields = watch.filter((field) => {
    const v = merged[field];
    return v == null || String(v).trim() === '';
  });
  // Só alerta "ausente" quando nenhum dos aliases de identidade principais veio preenchido.
  const hasIdentity = watch.some((field) => {
    const v = merged[field];
    return v != null && String(v).trim() !== '';
  });
  return {
    kind: 'ok',
    message: (!hasIdentity && absentFields.length)
      ? `Campos ausentes no cadastro (nao e falha de carga): ${absentFields.join(', ')}.`
      : null,
    absentFields: hasIdentity ? [] : absentFields,
  };
}

/**
 * Mestre organizacional usa exatamente o gate efetivo do cliente local.
 * Não libera role=admin sozinha nem aliases que o backend recusaria.
 */
export function hasCadastroEntityPermission(entityName, action, checkers = {}) {
  const entity = String(entityName || '');
  const act = String(action || 'visualizar');
  const hasPermission = typeof checkers.hasPermission === 'function' ? checkers.hasPermission : null;
  const canCreate = typeof checkers.canCreate === 'function' ? checkers.canCreate : null;
  const canEdit = typeof checkers.canEdit === 'function' ? checkers.canEdit : null;
  const canDelete = typeof checkers.canDelete === 'function' ? checkers.canDelete : null;

  // #229: mestres = gate Organizacional do backend local (sem Sistema.* / Cadastros.Empresa sozinho).
  if (isTenantMasterEntity(entity)) {
    if (act === 'visualizar') return Boolean(hasPermission && hasPermission('Cadastros', 'Organizacional', 'visualizar'));
    if (act === 'criar') return Boolean(canCreate && canCreate('Cadastros', 'Organizacional'));
    if (act === 'editar') return Boolean(canEdit && canEdit('Cadastros', 'Organizacional'));
    if (act === 'excluir') return Boolean(canDelete && canDelete('Cadastros', 'Organizacional'));
    return false;
  }

  if (act === 'visualizar') {
    return Boolean(
      hasPermission
      && (hasPermission('Cadastros', entity, 'visualizar') || hasPermission('Cadastros', null, 'visualizar')),
    );
  }
  if (act === 'criar') return Boolean(canCreate && (canCreate('Cadastros', entity) || canCreate('Cadastros', null)));
  if (act === 'editar') return Boolean(canEdit && (canEdit('Cadastros', entity) || canEdit('Cadastros', null)));
  if (act === 'excluir') return Boolean(canDelete && (canDelete('Cadastros', entity) || canDelete('Cadastros', null)));
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
