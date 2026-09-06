import {
  buildMultiempresaReadFilter,
  entityRequiresEmpresaOnWrite,
  resolveEmpresaIdOnWrite,
  toEntityScope,
  validateMultiempresaContext,
} from "@/components/lib/contextoMultiempresaPolicy";
import { sanitizeAuditPayload, sanitizeOnWrite } from "@/components/lib/sanitizeOnWrite";
import { createAuthDeniedError, evaluateLocalUserSession } from "@/api/localAuthSessionPolicy";
import { applyMasterCadastroOnCreate, MASTER_CODE_SPECS, parseNumericCode, sequenceKeyFor } from "@/api/localCadastroMasterPolicy";
import { assertMovimentacaoEstoque, configAllowsNegativeStock, HISTORICO_ESTOQUE_ENTITIES, isAjusteEstoque } from "@/components/lib/estoqueMovimentoPolicy";
import { GRANULAR_PERMISSION_ACTIONS, normalizeGuardAction, permissionNodeAllows } from "../../base44/functions/_lib/security/entityGuardPolicy/entry.ts";

const reportLocalClientFailure = (operation, error, context = {}) => {
  console.error('[base44-local] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

const STORAGE_KEY = 'erp_integra_local_db_v1';
const USER_KEY = 'erp_integra_local_user_v1';
const SNAPSHOT_IMPORT_KEY = 'erp_integra_base44_snapshot_imported_v5_core_compact';
const DELETED_RECORDS_KEY = 'erp_integra_local_deleted_records_v1';
const AUTO_IMPORT_EXCLUDED_ENTITIES = new Set(['AuditLog']);
const AUTO_IMPORT_COMPLETENESS_ENTITIES = [
  'GrupoEmpresarial',
  'Empresa',
  'PerfilAcesso',
  'Cliente',
  'Fornecedor',
  'Transportadora',
  'Colaborador',
  'Representante',
  'ContatoB2B',
  'SegmentoCliente',
  'RegiaoAtendimento',
  'Motorista',
];
export const PESSOAS_PARCEIROS_ENTITIES = [
  'Cliente',
  'Fornecedor',
  'Transportadora',
  'Colaborador',
  'Representante',
  'ContatoB2B',
  'SegmentoCliente',
  'RegiaoAtendimento',
];
const LOCAL_ENTITY_CONTEXT_FIELD = {
  Fornecedor: 'empresa_dona_id',
  Transportadora: 'empresa_dona_id',
  Colaborador: 'empresa_alocada_id',
};
const LOCAL_SHARED_ENTITIES = new Set(['Cliente', 'Fornecedor', 'Transportadora']);

const now = () => new Date().toISOString();

const safeStorage = {
  getItem(key) {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('[base44-local] Nao foi possivel gravar localStorage:', key, error?.message || error);
    }
  },
  removeItem(key) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  },
};

const readDeletedRecords = () => {
  const raw = safeStorage.getItem(DELETED_RECORDS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveDeletedRecords = (deleted = {}) => {
  safeStorage.setItem(DELETED_RECORDS_KEY, JSON.stringify(deleted || {}));
};

const isRecordDeletedLocally = (entityName, id) => {
  if (!entityName || !id) return false;
  const deleted = readDeletedRecords();
  return Boolean(deleted[entityName]?.[String(id)]);
};

const markRecordDeletedLocally = (entityName, id) => {
  if (!entityName || !id) return;
  const deleted = readDeletedRecords();
  deleted[entityName] = {
    ...(deleted[entityName] || {}),
    [String(id)]: now(),
  };
  saveDeletedRecords(deleted);
};

const makeId = (prefix = 'local') => {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
};

/** @type {import('@base44/sdk').User} */
export const localApiUser = {
  id: 'local-admin-user',
  email: 'admin@erp-local.test',
  full_name: 'Administrador Local',
  role: 'admin',
  app_id: 'erp-zuccaro-local',
  is_service: false,
  perfil_acesso_id: 'local_perfil_admin',
  disabled: false,
  is_verified: true,
  created_date: now(),
  updated_date: now(),
  contexto_atual: 'empresa',
  empresa_atual_id: 'local_empresa_3z',
  empresa_padrao_id: 'local_empresa_3z',
  grupo_atual_id: 'local_grupo_cpa',
  grupo_padrao_id: 'local_grupo_cpa',
  pode_operar_em_grupo: true,
  pode_ver_todas_empresas: true,
  empresas_vinculadas: [
    { empresa_id: 'local_empresa_3z', ativo: true },
    { empresa_id: 'local_empresa_cpa', ativo: true },
  ],
  grupos_vinculados: [{ grupo_id: 'local_grupo_cpa', ativo: true }],
};

const seedRecords = () => {
  const groupId = 'local_grupo_cpa';
  const empresa1Id = 'local_empresa_3z';
  const empresa2Id = 'local_empresa_cpa';

  const configKeys = [
    'ia_leitura_projetos',
    'ia_preditiva_vendas',
    'ia_conciliacao',
    'ia_producao',
    'ia_recomendacao_produtos',
    'ia_anomalia_financeira',
    'cc_ia_preditiva_vendas',
    'cc_ia_conciliacao',
    'cc_ia_producao',
    'cc_ia_leitura_projetos',
    'cc_auditoria_automatica',
    'cc_ia_seguranca_ativa',
    'cc_exigir_mfa',
    'cc_bloquear_ips_suspeitos',
    'cc_backup_automatico',
    'cc_criptografia_dados',
    'seg_login_duplo_fator',
    'seg_bloquear_ip_suspeito',
    'seg_sessao_unica',
    'seg_auditoria_detalhada',
    'seg_notif_novo_dispositivo',
    'seg_lgpd_anonimizacao',
  ];

  return {
    GrupoEmpresarial: [
      {
        id: groupId,
        nome_do_grupo: 'GRUPO CPA LOCAL',
        nome: 'GRUPO CPA LOCAL',
        status: 'Ativo',
        created_date: now(),
        updated_date: now(),
      },
    ],
    Empresa: [
      {
        id: empresa1Id,
        nome_fantasia: '3Z LTDA LOCAL',
        razao_social: '3Z LTDA LOCAL',
        cnpj: '00.000.000/0001-01',
        tipo: 'Matriz',
        status: 'Ativa',
        group_id: groupId,
        grupo_id: groupId,
        grupo_empresarial_id: groupId,
        created_date: now(),
        updated_date: now(),
      },
      {
        id: empresa2Id,
        nome_fantasia: 'CPA FERRO E ACO LOCAL',
        razao_social: 'CPA FERRO E ACO LOCAL',
        cnpj: '00.000.000/0002-92',
        tipo: 'Filial',
        status: 'Ativa',
        group_id: groupId,
        grupo_id: groupId,
        grupo_empresarial_id: groupId,
        created_date: now(),
        updated_date: now(),
      },
    ],
    User: [
      {
        ...localApiUser,
        empresa_atual_id: empresa1Id,
        empresa_padrao_id: empresa1Id,
        grupo_atual_id: groupId,
        grupo_padrao_id: groupId,
        empresas_vinculadas: [
          { empresa_id: empresa1Id, ativo: true },
          { empresa_id: empresa2Id, ativo: true },
        ],
        grupos_vinculados: [{ grupo_id: groupId, ativo: true }],
      },
    ],
    PerfilAcesso: [
      {
        id: 'local_perfil_admin',
        nome: 'Administrador Local',
        ativo: true,
        permissoes: { '*': [...GRANULAR_PERMISSION_ACTIONS] },
        group_id: groupId,
        created_date: now(),
        updated_date: now(),
      },
    ],
    ConfiguracaoSistema: configKeys.map((chave) => ({
      id: `local_config_${chave}`,
      chave,
      categoria: chave.startsWith('seg_') || chave.includes('seguranca') || chave.includes('mfa') ? 'Seguranca' : 'Sistema',
      ativa: true,
      group_id: groupId,
      empresa_id: null,
      created_date: now(),
      updated_date: now(),
    })),
    AuditLog: [],
    Notificacao: [],
    IAConfig: [
      {
        id: 'local_ia_config_sistema',
        modulo: 'Sistema',
        funcionalidade: 'IA Local',
        modelo_base: 'local-simulado',
        limite_tokens: 1000,
        ativo: true,
        group_id: groupId,
        created_date: now(),
        updated_date: now(),
      },
    ],
  };
};

const ensureRecord = (db, entityName, id, factory) => {
  const records = getEntityStore(db, entityName);
  const index = records.findIndex((item) => String(item.id) === String(id));
  const next = factory();
  if (index >= 0) {
    records[index] = { ...next, ...records[index], id, updated_date: records[index].updated_date || now() };
    return records[index];
  }
  records.push(next);
  return next;
};

const uniqueByString = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item ?? '');
    if (!key || key === 'undefined' || key === 'null' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeLocalUser = (user = {}) => {
  const groupId = 'local_grupo_cpa';
  const empresaIds = ['local_empresa_3z', 'local_empresa_cpa'];
  const existingEmpresas = Array.isArray(user.empresas_vinculadas) ? user.empresas_vinculadas : [];
  const existingGrupos = Array.isArray(user.grupos_vinculados) ? user.grupos_vinculados : [];
  const linkedEmpresaIds = uniqueByString([
    ...empresaIds,
    ...existingEmpresas.map((v) => (typeof v === 'string' ? v : v?.empresa_id || v?.id)),
  ]);
  const linkedGroupIds = uniqueByString([
    groupId,
    ...existingGrupos.map((v) => (typeof v === 'string' ? v : v?.grupo_id || v?.group_id || v?.id)),
  ]);

  return {
    ...localApiUser,
    ...user,
    role: user.id === localApiUser.id ? (user.role || 'admin') : (user.role || 'user'),
    perfil_acesso_id: user.perfil_acesso_id || (user.id === localApiUser.id ? 'local_perfil_admin' : null),
    contexto_atual: user.contexto_atual || 'empresa',
    empresa_atual_id: user.empresa_atual_id || empresaIds[0],
    empresa_padrao_id: user.empresa_padrao_id || empresaIds[0],
    grupo_atual_id: user.grupo_atual_id || groupId,
    grupo_padrao_id: user.grupo_padrao_id || groupId,
    pode_operar_em_grupo: user.pode_operar_em_grupo ?? true,
    pode_ver_todas_empresas: user.pode_ver_todas_empresas ?? true,
    empresas_vinculadas: linkedEmpresaIds.map((empresaId) => ({
      empresa_id: empresaId,
      ativo: true,
      nivel_acesso: existingEmpresas.find((v) => v?.empresa_id === empresaId)?.nivel_acesso || 'Administrador',
    })),
    grupos_vinculados: linkedGroupIds.map((gid) => ({
      grupo_id: gid,
      ativo: true,
      nivel_acesso: existingGrupos.find((v) => v?.grupo_id === gid || v?.group_id === gid)?.nivel_acesso || 'Administrador',
    })),
  };
};

const ensureLocalTopology = (db) => {
  const seeded = seedRecords();
  const group = seeded.GrupoEmpresarial[0];
  const empresas = seeded.Empresa;

  const importedGroup =
    (db.GrupoEmpresarial || []).find((item) => item?.id && !String(item.id).startsWith('local_')) ||
    null;
  const importedEmpresas = (db.Empresa || []).filter((item) => item?.id && !String(item.id).startsWith('local_'));

  if (importedGroup) {
    db.GrupoEmpresarial = (db.GrupoEmpresarial || []).filter((item) => String(item?.id) !== String(group.id));
  } else {
    ensureRecord(db, 'GrupoEmpresarial', group.id, () => group);
  }

  if (importedEmpresas.length > 0) {
    const localEmpresaIds = new Set(empresas.map((empresa) => String(empresa.id)));
    db.Empresa = (db.Empresa || []).filter((item) => !localEmpresaIds.has(String(item?.id)));
  } else {
    empresas.forEach((empresa) => ensureRecord(db, 'Empresa', empresa.id, () => empresa));
  }

  const canonicalGroup =
    importedGroup ||
    (db.GrupoEmpresarial || [])[0] ||
    group;
  const canonicalGroupId = canonicalGroup?.id || group.id;
  const canonicalEmpresaIds = (importedEmpresas.length > 0 ? importedEmpresas : (db.Empresa || []))
    .map((empresa) => empresa?.id)
    .filter(Boolean);

  let currentUser = normalizeLocalUser(db.User?.[0] || {});
  if (importedGroup) {
    const currentGroupIsLocal = !currentUser.grupo_atual_id || String(currentUser.grupo_atual_id).startsWith('local_');
    const defaultGroupIsLocal = !currentUser.grupo_padrao_id || String(currentUser.grupo_padrao_id).startsWith('local_');
    currentUser = {
      ...currentUser,
      grupo_atual_id: currentGroupIsLocal ? canonicalGroupId : currentUser.grupo_atual_id,
      grupo_padrao_id: defaultGroupIsLocal ? canonicalGroupId : currentUser.grupo_padrao_id,
      grupos_vinculados: uniqueByString([
        canonicalGroupId,
        ...(currentUser.grupos_vinculados || [])
          .map((v) => v?.grupo_id || v?.group_id || v?.id)
          .filter((id) => id && !String(id).startsWith('local_')),
      ]).map((grupoId) => ({ grupo_id: grupoId, ativo: true, nivel_acesso: 'Administrador' })),
    };
    safeStorage.setItem('group_atual_id', canonicalGroupId);
  }
  if (importedEmpresas.length > 0 && canonicalEmpresaIds.length > 0) {
    const currentEmpresaIsLocal = !currentUser.empresa_atual_id || String(currentUser.empresa_atual_id).startsWith('local_');
    const defaultEmpresaIsLocal = !currentUser.empresa_padrao_id || String(currentUser.empresa_padrao_id).startsWith('local_');
    currentUser = {
      ...currentUser,
      empresa_atual_id: currentEmpresaIsLocal ? canonicalEmpresaIds[0] : currentUser.empresa_atual_id,
      empresa_padrao_id: defaultEmpresaIsLocal ? canonicalEmpresaIds[0] : currentUser.empresa_padrao_id,
      empresas_vinculadas: uniqueByString([
        ...canonicalEmpresaIds,
        ...(currentUser.empresas_vinculadas || [])
          .map((v) => v?.empresa_id || v?.id)
          .filter((id) => id && !String(id).startsWith('local_')),
      ]).map((empresaId) => ({ empresa_id: empresaId, ativo: true, nivel_acesso: 'Administrador' })),
    };
    safeStorage.setItem('empresa_atual_id', currentUser.empresa_atual_id);
  }
  db.User = [currentUser, ...(db.User || []).filter((u) => u.id !== currentUser.id)];

  const perfil = seeded.PerfilAcesso[0];
  if (!isRecordDeletedLocally('PerfilAcesso', perfil.id)) {
    ensureRecord(db, 'PerfilAcesso', perfil.id, () => perfil);
  }

  db.PerfilAcesso = (db.PerfilAcesso || []).map((item) => {
    const hasScope = Boolean(item.group_id || item.grupo_id || item.empresa_id || item.empresa_atual_id);
    const legacyGroup = item.group_id === 'grupo_001' || item.grupo_id === 'grupo_001';
    const isLocalAdminProfile = String(item.id) === 'local_perfil_admin';
    const permissoes = isLocalAdminProfile && !item?.permissoes?.['*']
      ? { ...item.permissoes, '*': [...GRANULAR_PERMISSION_ACTIONS] }
      : item.permissoes;
    if (hasScope && !legacyGroup) {
      return {
        ...item,
        nome: item.nome || item.nome_perfil,
        grupo_id: item.grupo_id || item.group_id || canonicalGroupId,
        permissoes,
      };
    }
    return {
      ...item,
      nome: item.nome || item.nome_perfil,
      group_id: canonicalGroupId,
      grupo_id: canonicalGroupId,
      permissoes,
    };
  });

  return db;
};

const loadDb = () => {
  const raw = safeStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const db = ensureLocalTopology(JSON.parse(raw));
      saveDb(db);
      return db;
    } catch (error) { reportLocalClientFailure('Falha ao carregar banco local; usando dados iniciais', error); }
  }
  const seeded = seedRecords();
  saveDb(seeded);
  try {
    safeStorage.setItem('contexto_atual', 'empresa');
    safeStorage.setItem('empresa_atual_id', seeded.Empresa[0].id);
    safeStorage.setItem('group_atual_id', seeded.GrupoEmpresarial[0].id);
  } catch (error) { reportLocalClientFailure('Falha ao salvar contexto local inicial', error); }
  return seeded;
};

const saveDb = (db) => {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

const readUser = () => {
  const raw = safeStorage.getItem(USER_KEY);
  if (raw) {
    try {
      const user = normalizeLocalUser(JSON.parse(raw));
      safeStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) { reportLocalClientFailure('Falha ao carregar usuario local', error); }
  }
  const db = loadDb();
  return normalizeLocalUser(db.User?.[0] || {});
};

const writeUser = (updates) => {
  const user = { ...readUser(), ...updates, updated_date: now() };
  safeStorage.setItem(USER_KEY, JSON.stringify(user));
  const db = loadDb();
  db.User = [user, ...(db.User || []).filter((u) => u.id !== user.id)];
  saveDb(db);
  return user;
};

const getValue = (record, field) => {
  if (!field) return undefined;
  return String(field).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), record);
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const matchesOperator = (actual, expected) => {
  if (!isPlainObject(expected)) {
    if (expected === null) return actual === null || actual === undefined;
    if (Array.isArray(actual)) return actual.includes(expected);
    return String(actual ?? '') === String(expected ?? '');
  }

  if ('$in' in expected) {
    const values = Array.isArray(expected.$in) ? expected.$in.map(String) : [];
    if (Array.isArray(actual)) return actual.some((item) => values.includes(String(item)));
    return values.includes(String(actual));
  }
  if ('$ne' in expected && String(actual ?? '') === String(expected.$ne ?? '')) return false;
  if ('$gte' in expected && !(actual >= expected.$gte)) return false;
  if ('$lte' in expected && !(actual <= expected.$lte)) return false;
  if ('$gt' in expected && !(actual > expected.$gt)) return false;
  if ('$lt' in expected && !(actual < expected.$lt)) return false;
  if ('$contains' in expected) return String(actual || '').toLowerCase().includes(String(expected.$contains || '').toLowerCase());

  return true;
};

const matchesFilter = (record, filter = {}) => {
  if (!filter || !Object.keys(filter).length) return true;
  if (Array.isArray(filter.$or) && !filter.$or.some((item) => matchesFilter(record, item))) return false;
  if (Array.isArray(filter.$and) && !filter.$and.every((item) => matchesFilter(record, item))) return false;

  return Object.entries(filter).every(([field, expected]) => {
    if (field === '$or' || field === '$and') return true;
    return matchesOperator(getValue(record, field), expected);
  });
};

const getCurrentGroupId = () => {
  try {
    return (
      safeStorage.getItem('group_atual_id') ||
      safeStorage.getItem('grupo_atual_id') ||
      readUser()?.grupo_atual_id ||
      readUser()?.grupo_padrao_id ||
      null
    );
  } catch {
    return null;
  }
};

const getCurrentEmpresaId = () => {
  try {
    return (
      safeStorage.getItem('empresa_atual_id') ||
      readUser()?.empresa_atual_id ||
      readUser()?.empresa_padrao_id ||
      null
    );
  } catch {
    return null;
  }
};

const getCurrentContext = () => {
  const user = readUser();
  return {
    user,
    contexto: safeStorage.getItem('contexto_atual') || user?.contexto_atual || 'empresa',
    groupId: getCurrentGroupId() || user?.grupo_atual_id || user?.grupo_padrao_id || 'local_grupo_cpa',
    empresaId: getCurrentEmpresaId() || user?.empresa_atual_id || user?.empresa_padrao_id || null,
  };
};

const ENTITY_CONTEXT_FIELD_BY_NAME = {
  Fornecedor: 'empresa_dona_id',
  Transportadora: 'empresa_dona_id',
  Colaborador: 'empresa_alocada_id',
};

const shouldStampEmpresa = (entityName) => ![
  'AuditLog',
  'GrupoEmpresarial',
  'Empresa',
  'PerfilAcesso',
  'ConfiguracaoSistema',
  'Banco',
  'FormaPagamento',
  'TipoDespesa',
  'MoedaIndice',
  'TipoFrete',
  'UnidadeMedida',
  'Departamento',
  'Cargo',
  'Turno',
  'GrupoProduto',
  'Marca',
  'SetorAtividade',
  'LocalEstoque',
  'TabelaFiscal',
  'CentroResultado',
  'OperadorCaixa',
  'RotaPadrao',
  'ModeloDocumento',
  'ApiExterna',
  'Webhook',
  'ChatbotIntent',
  'ChatbotCanal',
  'JobAgendado',
  'EventoNotificacao',
].includes(entityName);

const sanitizeRecord = (value) => {
  return sanitizeOnWrite(value);
};

const stampRecordContext = (entityName, data = {}) => {
  const record = sanitizeRecord(data || {});
  const { contexto, groupId, empresaId } = getCurrentContext();
  const ctxField = ENTITY_CONTEXT_FIELD_BY_NAME[entityName] || 'empresa_id';
  const contextEmpresaId = contexto === 'grupo' ? null : empresaId;

  if (groupId && !record.group_id && !record.grupo_id && entityName !== 'GrupoEmpresarial') {
    record.group_id = groupId;
  }
  if (shouldStampEmpresa(entityName) && !record[ctxField] && !record.empresa_id && contextEmpresaId) {
    record[ctxField] = contextEmpresaId;
    if (ctxField !== 'empresa_id') record.empresa_id = record.empresa_id || contextEmpresaId;
  }
  if (entityRequiresEmpresaOnWrite(entityName)) {
    const effectiveEmpresa = resolveEmpresaIdOnWrite(record, contextEmpresaId);
    if (!effectiveEmpresa) {
      throw new Error('Empresa obrigatoria para operacao nesta entidade.');
    }
    if (!record[ctxField]) record[ctxField] = effectiveEmpresa;
    if (ctxField !== 'empresa_id' && !record.empresa_id) record.empresa_id = effectiveEmpresa;
  }
  return record;
};

const auditLocalMutation = (entityName, action, { before = null, after = null, recordId = null } = {}) => {
  if (entityName === 'AuditLog') return;
  try {
    const db = loadDb();
    const audit = getEntityStore(db, 'AuditLog');
    const { user, groupId, empresaId } = getCurrentContext();
    const correlacaoId = makeId('audit');
    audit.unshift({
      id: correlacaoId,
      usuario: user?.full_name || user?.email || 'Administrador Local',
      usuario_id: user?.id || null,
      acao: action,
      modulo: 'Sistema Local',
      tipo_auditoria: 'entidade',
      entidade: entityName,
      registro_id: recordId || after?.id || before?.id || null,
      descricao: `${action} local em ${entityName}`,
      empresa_id: after?.empresa_id || after?.empresa_dona_id || after?.empresa_alocada_id || before?.empresa_id || empresaId || null,
      group_id: after?.group_id || after?.grupo_id || before?.group_id || groupId || null,
      correlacao_id: correlacaoId,
      dados_anteriores: sanitizeAuditPayload(before) || null,
      dados_novos: sanitizeAuditPayload(after) || null,
      sucesso: true,
      local: true,
      created_date: now(),
      updated_date: now(),
      data_hora: now(),
    });
    saveDb(db);
    notify('AuditLog', 'create', audit[0]);
  } catch (error) { reportLocalClientFailure('Falha ao auditar mutacao local', error, { entityName, action, recordId }); }
};

const expandLocalContextFilter = (entityName, filter = {}) => {
  if (!isPlainObject(filter)) return filter || {};
  if (filter.$or || filter.$and) return filter || {};

  const empresaId = filter.empresa_id;
  const explicitGroupId = filter.group_id || filter.grupo_id || filter.grupo_empresarial_id;
  const groupId = explicitGroupId || (empresaId ? getCurrentGroupId() : null);
  const rest = { ...filter };
  delete rest.empresa_id;
  delete rest.group_id;
  delete rest.grupo_id;
  delete rest.grupo_empresarial_id;

  const ctxField = LOCAL_ENTITY_CONTEXT_FIELD[entityName] || 'empresa_id';
  const shared = entityName === 'Cliente' || LOCAL_SHARED_ENTITIES.has(entityName);
  return buildMultiempresaReadFilter({ groupId, empresaId, ctxField, shared, rest });
};

const normalizePermissionText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9.]/g, '');

const normalizePermissionAction = (action = 'visualizar') => normalizeGuardAction(action);

const LOCAL_MODULE_ALIASES = {
  dashboard: 'dashboard',
  dashboardcorporativo: 'dashboard',
  comercial: 'comercial',
  comercialevendas: 'comercial',
  compras: 'compras',
  comprasesuprimentos: 'compras',
  financeiro: 'financeiro',
  financeiroecontabil: 'financeiro',
  estoque: 'estoque',
  estoqueealmoxarifado: 'estoque',
  expedicao: 'expedicao',
  expedicaologistica: 'expedicao',
  producao: 'producao',
  rh: 'rh',
  recursoshumanos: 'rh',
  fiscal: 'fiscal',
  cadastros: 'cadastros',
  cadastrosgerais: 'cadastros',
  crm: 'crm',
  relatorios: 'relatorios',
  relatorioseanalises: 'relatorios',
  agenda: 'agenda',
  administracao: 'sistema',
  administracaosistema: 'sistema',
  sistema: 'sistema',
};

const LOCAL_SECTION_ALIASES = {
  controledeacesso: 'acessos',
  gestaoacessos: 'acessos',
  acessos: 'acessos',
  integracoes: 'integracoes',
  ia: 'ia',
  iaeotimizacao: 'ia',
  configuracoesgerais: 'configuracoes',
  configuracoes: 'configuracoes',
  cliente: 'pessoas',
  clientes: 'pessoas',
  fornecedor: 'pessoas',
  fornecedores: 'pessoas',
  transportadora: 'pessoas',
  transportadoras: 'pessoas',
  colaborador: 'pessoas',
  colaboradores: 'pessoas',
  representante: 'pessoas',
  representantes: 'pessoas',
  contatob2b: 'pessoas',
  segmentocliente: 'pessoas',
  regiaoatendimento: 'pessoas',
  pessoasparceiros: 'pessoas',
};

const findPermissionNode = (root, key) => {
  if (!root || typeof root !== 'object') return undefined;
  const normalizedKey = normalizePermissionText(key);
  const found = Object.keys(root).find((item) => normalizePermissionText(item) === normalizedKey);
  return found ? root[found] : undefined;
};

const findPermissionNodeByPath = (root, path = []) => {
  let cursor = root;
  for (const rawPart of path) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    const alias = LOCAL_SECTION_ALIASES[normalizePermissionText(rawPart)] || rawPart;
    cursor = findPermissionNode(cursor, alias);
  }
  return cursor;
};

const evaluateLocalPermission = ({ module, section, entityName, action } = {}) => {
  const db = loadDb();
  const user = readUser();
  if (!user) return { allowed: false, reason: 'usuario-local-ausente' };

  const perfilId = user.perfil_acesso_id;
  const perfil = perfilId
    ? getEntityStore(db, 'PerfilAcesso').find((item) => String(item.id) === String(perfilId))
    : null;
  const permissoes = perfil?.permissoes;
  if (!permissoes || typeof permissoes !== 'object') return { allowed: false, reason: 'perfil-sem-permissoes' };
  const desired = normalizePermissionAction(action);
  if (permissionNodeAllows(permissoes['*'], desired)) return { allowed: true, reason: 'perfil-wildcard' };

  const moduleKey = LOCAL_MODULE_ALIASES[normalizePermissionText(module || entityName)] || normalizePermissionText(module || entityName);
  const sectionPath = Array.isArray(section)
    ? section
    : String(section || entityName || '').split('.').filter(Boolean);
  const sectionKey = LOCAL_SECTION_ALIASES[normalizePermissionText(sectionPath[0] || entityName)] || normalizePermissionText(sectionPath[0] || entityName);
  const moduleNode = findPermissionNode(permissoes, moduleKey);
  if (!moduleNode) return { allowed: false, reason: 'modulo-negado' };
  if (!sectionKey) return { allowed: permissionNodeAllows(moduleNode, desired), reason: 'modulo' };
  const sectionNode = findPermissionNodeByPath(moduleNode, sectionPath.length ? sectionPath : [sectionKey]);
  return {
    allowed: permissionNodeAllows(sectionNode || moduleNode, desired),
    reason: sectionNode ? 'secao' : 'modulo-fallback',
  };
};

const ENTITY_PERMISSION_SCOPE = {
  User: { module: 'Sistema', section: 'Controle de Acesso' },
  PerfilAcesso: { module: 'Sistema', section: 'Controle de Acesso' },
  ConfiguracaoSistema: { module: 'Sistema', section: 'Configuracoes' },
  GrupoEmpresarial: { module: 'Cadastros', section: 'Organizacional' },
  Empresa: { module: 'Cadastros', section: 'Organizacional' },
  Cliente: { module: 'Cadastros', section: 'Pessoas' },
  Fornecedor: { module: 'Cadastros', section: 'Pessoas' },
  Transportadora: { module: 'Cadastros', section: 'Pessoas' },
  Colaborador: { module: 'Cadastros', section: 'Pessoas' },
  Representante: { module: 'Cadastros', section: 'Pessoas' },
  ContatoB2B: { module: 'Cadastros', section: 'Pessoas' },
  Produto: { module: 'Estoque', section: 'Produtos' },
  GrupoProduto: { module: 'Cadastros', section: 'Produtos' },
  Marca: { module: 'Cadastros', section: 'Produtos' },
  FormaPagamento: { module: 'Cadastros', section: 'Financeiro' },
  Banco: { module: 'Cadastros', section: 'Financeiro' },
  CentroCusto: { module: 'Cadastros', section: 'Financeiro' },
};

const getEntityPermissionScope = (entityName) => {
  if (ENTITY_PERMISSION_SCOPE[entityName]) return ENTITY_PERMISSION_SCOPE[entityName];
  return { module: 'Cadastros', section: entityName };
};

const auditLocalPermissionDenied = (entityName, action, recordId = null) => {
  try {
    const db = loadDb();
    const audit = getEntityStore(db, 'AuditLog');
    const { user, groupId, empresaId } = getCurrentContext();
    audit.unshift({
      id: makeId('audit'),
      usuario: user?.full_name || user?.email || 'Administrador Local',
      usuario_id: user?.id || null,
      acao: 'Bloqueio',
      modulo: 'Sistema Local',
      tipo_auditoria: 'seguranca',
      entidade: entityName,
      registro_id: recordId,
      descricao: `Permissao negada para ${action} em ${entityName}`,
      empresa_id: empresaId || null,
      group_id: groupId || null,
      sucesso: false,
      local: true,
      created_date: now(),
      updated_date: now(),
      data_hora: now(),
    });
    saveDb(db);
    notify('AuditLog', 'create', audit[0]);
  } catch (error) { reportLocalClientFailure('Falha ao auditar permissao local negada', error, { entityName, action, recordId }); }
};

const assertLocalMutationAllowed = (entityName, action, recordId = null) => {
  if (entityName === 'AuditLog') return;
  const scope = getEntityPermissionScope(entityName);
  const result = evaluateLocalPermission({ ...scope, entityName, action });
  if (!result.allowed) {
    auditLocalPermissionDenied(entityName, action, recordId);
    throw new Error(`Permissao negada para ${action} em ${entityName}.`);
  }
};

const sortRecords = (records, order, direction) => {
  if (!order) return records;
  let field = order;
  let dir = direction || 'asc';
  if (typeof order === 'string' && order.startsWith('-')) {
    field = order.slice(1);
    dir = 'desc';
  }

  return [...records].sort((a, b) => {
    const av = getValue(a, field);
    const bv = getValue(b, field);
    const at = Date.parse(av);
    const bt = Date.parse(bv);
    const left = Number.isNaN(at) ? av : at;
    const right = Number.isNaN(bt) ? bv : bt;
    if (left === right) return 0;
    const result = left > right ? 1 : -1;
    return dir === 'desc' ? -result : result;
  });
};

const listeners = new Map();

const notify = (entityName, type, data) => {
  const set = listeners.get(entityName);
  if (!set) return;
  set.forEach((listener) => {
    try {
      listener({ type, data });
    } catch (error) { reportLocalClientFailure('Falha em listener local', error, { entityName, type }); }
  });
};

const getEntityStore = (db, entityName) => {
  if (!Array.isArray(db[entityName])) db[entityName] = [];
  return db[entityName];
};

const applyLocalMasterCadastro = (db, entityName, record) => {
  const needsCode = Boolean(MASTER_CODE_SPECS[entityName]);
  const needsDuplicate = ['Cliente', 'Fornecedor', 'Transportadora'].includes(entityName);
  if (!needsCode && !needsDuplicate) return record;

  const groupId = record.group_id || record.grupo_id || null;
  const records = getEntityStore(db, entityName).filter((item) => {
    if (!groupId) return true;
    return String(item.group_id || item.grupo_id || '') === String(groupId);
  });
  const configs = getEntityStore(db, 'ConfiguracaoSistema');
  const chave = sequenceKeyFor(entityName, groupId);
  const seqRow = configs.find((item) => item.chave === chave);
  const sequenceValue = Number(seqRow?.valor_numero) || 0;
  const nextRecord = applyMasterCadastroOnCreate({
    entityName,
    record,
    records,
    sequenceValue,
  });
  const spec = MASTER_CODE_SPECS[entityName];
  if (spec) {
    const used = parseNumericCode(nextRecord[spec.field]);
    if (used > 0) {
      const nextValue = Math.max(sequenceValue, used);
      if (seqRow) {
        seqRow.valor_numero = nextValue;
        seqRow.valor = String(nextValue);
        seqRow.updated_date = now();
      } else {
        configs.unshift({
          id: makeId('seq'),
          chave,
          categoria: 'Cadastros',
          valor_numero: nextValue,
          valor: String(nextValue),
          group_id: groupId,
          created_date: now(),
          updated_date: now(),
        });
      }
    }
  }
  return nextRecord;
};

const applyLocalEstoqueMovimento = (db, entityName, record) => {
  if (entityName !== 'MovimentacaoEstoque') return { record, reuse: null };
  const produtoId = String(record.produto_id || '');
  const produto = produtoId
    ? getEntityStore(db, 'Produto').find((item) => String(item.id) === produtoId)
    : null;
  const permiteNegativo = configAllowsNegativeStock(getEntityStore(db, 'ConfiguracaoSistema'));
  return assertMovimentacaoEstoque({
    record,
    produto,
    movements: getEntityStore(db, 'MovimentacaoEstoque'),
    permiteNegativo,
  });
};

const applyLocalEstoqueProdutoPatch = (db, produtoId, patch) => {
  if (!produtoId || !patch) return;
  const produtos = getEntityStore(db, 'Produto');
  const index = produtos.findIndex((item) => String(item.id) === String(produtoId));
  if (index < 0) return;
  produtos[index] = {
    ...produtos[index],
    ...patch,
    updated_date: now(),
  };
};

const mergeSnapshotRecords = (db, entityName, incoming = []) => {
  if (!Array.isArray(incoming) || incoming.length === 0) return { created: 0, updated: 0 };
  const records = getEntityStore(db, entityName);
  let created = 0;
  let updated = 0;

  incoming.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    if (raw.id && isRecordDeletedLocally(entityName, raw.id)) return;
    const record = {
      ...raw,
      id: raw.id || makeId(entityName.toLowerCase()),
      imported_from_base44: true,
      imported_at: raw.imported_at || now(),
      created_date: raw.created_date || now(),
      updated_date: raw.updated_date || raw.created_date || now(),
    };
    const index = records.findIndex((item) => String(item.id) === String(record.id));
    if (index >= 0) {
      records[index] = { ...records[index], ...record, id: records[index].id };
      updated += 1;
    } else {
      records.push(record);
      created += 1;
    }
  });

  return { created, updated };
};

const selectImportedTopology = (db) => {
  const importedGroups = getEntityStore(db, 'GrupoEmpresarial').filter((g) => g.imported_from_base44);
  const importedEmpresas = getEntityStore(db, 'Empresa').filter((e) => e.imported_from_base44);
  return {
    groupId: importedGroups[0]?.id || getEntityStore(db, 'GrupoEmpresarial')[0]?.id || 'local_grupo_cpa',
    empresaId: importedEmpresas[0]?.id || getEntityStore(db, 'Empresa')[0]?.id || 'local_empresa_3z',
    empresaIds: importedEmpresas.map((e) => e.id).filter(Boolean),
    groupIds: importedGroups.map((g) => g.id).filter(Boolean),
  };
};

const isLegacyGroupId = (value, validGroupIds = []) => {
  if (!value) return true;
  const text = String(value);
  if (validGroupIds.includes(text)) return false;
  return text === 'grupo_001' || text.startsWith('local_') || text.startsWith('grupo_');
};

const normalizeSnapshotRecord = (entityName, raw, topology) => {
  const canonicalGroupId = topology.groupId;
  const empresaIds = topology.empresaIds || [];
  const validGroupIds = topology.groupIds?.length ? topology.groupIds : [canonicalGroupId];
  const record = { ...raw };

  if (entityName === 'GrupoEmpresarial') {
    record.group_id = record.id || canonicalGroupId;
    record.grupo_id = record.id || canonicalGroupId;
    record.nome = record.nome || record.nome_do_grupo || record.razao_social_grupo;
    return record;
  }

  if (canonicalGroupId && isLegacyGroupId(record.group_id, validGroupIds)) record.group_id = canonicalGroupId;
  if (canonicalGroupId && isLegacyGroupId(record.grupo_id, validGroupIds)) record.grupo_id = canonicalGroupId;
  if (canonicalGroupId && isLegacyGroupId(record.grupo_empresarial_id, validGroupIds)) record.grupo_empresarial_id = canonicalGroupId;

  if (entityName === 'Empresa') {
    record.group_id = canonicalGroupId;
    record.grupo_id = canonicalGroupId;
    record.grupo_empresarial_id = canonicalGroupId;
  }

  if (entityName === 'PerfilAcesso') {
    record.group_id = canonicalGroupId;
    record.grupo_id = canonicalGroupId;
    record.nome = record.nome || record.nome_perfil;
  }

  if (entityName === 'User') {
    record.group_id = canonicalGroupId;
    record.grupo_id = canonicalGroupId;
    record.grupo_atual_id = canonicalGroupId;
    record.grupo_padrao_id = canonicalGroupId;
    record.contexto_atual = record.contexto_atual || 'grupo';
    record.pode_operar_em_grupo = record.pode_operar_em_grupo ?? true;
    record.pode_ver_todas_empresas = record.pode_ver_todas_empresas ?? true;
    const atuais = Array.isArray(record.empresas_vinculadas) ? record.empresas_vinculadas : [];
    record.empresas_vinculadas = uniqueByString([
      ...atuais.map((v) => (typeof v === 'string' ? v : v?.empresa_id || v?.id)),
      ...empresaIds,
    ]).map((empresa_id) => ({
      ...(atuais.find((v) => v?.empresa_id === empresa_id) || {}),
      empresa_id,
      ativo: true,
    }));
    record.grupos_vinculados = [{
      grupo_id: canonicalGroupId,
      ativo: true,
      nivel_acesso: record.role === 'admin' ? 'Administrador' : 'Operacional',
    }];
    if (!record.empresa_atual_id && empresaIds[0]) record.empresa_atual_id = empresaIds[0];
    if (!record.empresa_padrao_id && empresaIds[0]) record.empresa_padrao_id = empresaIds[0];
  }

  return record;
};

export const hydrateLocalBase44FromSnapshot = async ({ force = false, includeAuditLog = false, sourceUrl = '/base44-local-core-snapshot.json', onlyEntities = null } = {}) => {
  if (typeof window === 'undefined') return { imported: false, reason: 'server' };

  let snapshot;
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const response = await fetch(sourceUrl, { cache: 'no-store', signal: controller.signal });
    window.clearTimeout(timeout);
    if (!response.ok) return { imported: false, reason: 'snapshot-not-found' };
    snapshot = await response.json();
  } catch (error) {
    console.warn('[base44-local] Snapshot local indisponivel:', error?.message || error);
    return { imported: false, reason: 'snapshot-error' };
  }

  const snapshotId = snapshot?.exported_at || snapshot?.id || 'snapshot';
  const db = loadDb();
  const completenessEntities = Array.isArray(onlyEntities) && onlyEntities.length
    ? onlyEntities
    : AUTO_IMPORT_COMPLETENESS_ENTITIES;
  const localDbLooksComplete = completenessEntities.every((entityName) => {
    const snapshotCount = Array.isArray(snapshot?.entities?.[entityName]) ? snapshot.entities[entityName].length : 0;
    const dbCount = Array.isArray(db?.[entityName]) ? db[entityName].length : 0;
    const deletedCount = Object.keys(readDeletedRecords()[entityName] || {}).length;
    return !snapshotCount || dbCount + deletedCount >= snapshotCount;
  });
  const importKey = Array.isArray(onlyEntities) && onlyEntities.length
    ? `${SNAPSHOT_IMPORT_KEY}_${onlyEntities.join('_')}`
    : SNAPSHOT_IMPORT_KEY;
  if (!force && safeStorage.getItem(importKey) === snapshotId && localDbLooksComplete) {
    return { imported: false, reason: 'already-imported', snapshotId };
  }

  const snapshotGroups = Array.isArray(snapshot?.entities?.GrupoEmpresarial) ? snapshot.entities.GrupoEmpresarial : [];
  const snapshotEmpresas = Array.isArray(snapshot?.entities?.Empresa) ? snapshot.entities.Empresa : [];
  const snapshotTopology = {
    groupId: snapshotGroups[0]?.id || selectImportedTopology(db).groupId,
    groupIds: snapshotGroups.map((g) => g.id).filter(Boolean),
    empresaId: snapshotEmpresas[0]?.id || selectImportedTopology(db).empresaId,
    empresaIds: snapshotEmpresas.map((e) => e.id).filter(Boolean),
  };
  const summary = {};
  const allowedEntities = Array.isArray(onlyEntities) && onlyEntities.length ? new Set(onlyEntities) : null;
  Object.entries(snapshot?.entities || {}).forEach(([entityName, rows]) => {
    if (allowedEntities && !allowedEntities.has(entityName)) return;
    if (!includeAuditLog && AUTO_IMPORT_EXCLUDED_ENTITIES.has(entityName)) {
      summary[entityName] = {
        skipped: true,
        reason: 'excluded-from-auto-import',
        total: Array.isArray(rows) ? rows.length : 0,
      };
      return;
    }
    const normalizedRows = Array.isArray(rows)
      ? rows.map((row) => normalizeSnapshotRecord(entityName, row, snapshotTopology))
      : rows;
    summary[entityName] = mergeSnapshotRecords(db, entityName, normalizedRows);
  });

  const topology = {
    ...selectImportedTopology(db),
    ...snapshotTopology,
  };
  const currentStoredUser = readUser();
  const currentUser = normalizeLocalUser({
    ...currentStoredUser,
    contexto_atual: 'grupo',
    grupo_atual_id: topology.groupId,
    grupo_padrao_id: topology.groupId,
    empresa_atual_id: topology.empresaId,
    empresa_padrao_id: topology.empresaId,
    empresas_vinculadas: [
      ...(currentStoredUser?.empresas_vinculadas || []),
      ...topology.empresaIds.map((empresa_id) => ({ empresa_id, ativo: true, nivel_acesso: 'Administrador' })),
    ],
    grupos_vinculados: [
      ...(currentStoredUser?.grupos_vinculados || []),
      ...topology.groupIds.map((grupo_id) => ({ grupo_id, ativo: true, nivel_acesso: 'Administrador' })),
    ],
  });
  db.User = [currentUser, ...getEntityStore(db, 'User').filter((u) => u.id !== currentUser.id)];
  saveDb(ensureLocalTopology(db));

  safeStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  safeStorage.setItem('contexto_atual', 'grupo');
  safeStorage.setItem('empresa_atual_id', topology.empresaId);
  safeStorage.setItem('group_atual_id', topology.groupId);
  safeStorage.setItem(importKey, snapshotId);

  try {
    await entities.AuditLog.create({
      usuario: currentUser.email || 'admin@erp-local.test',
      acao: 'Importacao',
      modulo: 'Sistema',
      tipo_auditoria: 'dados',
      entidade: 'Base44Snapshot',
      descricao: 'Snapshot Base44 importado para banco local',
      dados_novos: { snapshotId, summary },
      local: true,
      data_hora: now(),
    });
  } catch (error) { reportLocalClientFailure('Falha ao auditar importacao do snapshot', error, { snapshotId }); }

  return { imported: true, snapshotId, summary };
};

const createEntityApi = (entityName) => ({
  async list(order, limit, skip = 0) {
    if (typeof order === 'number') {
      limit = order;
      order = undefined;
    }
    const db = loadDb();
    const records = sortRecords(getEntityStore(db, entityName), order);
    return records.slice(skip || 0, limit ? (skip || 0) + limit : undefined);
  },

  async filter(filter = {}, order, limit, skip = 0) {
    if (typeof order === 'number') {
      skip = limit || 0;
      limit = order;
      order = undefined;
    }
    const db = loadDb();
    const scopedFilter = expandLocalContextFilter(entityName, filter);
    const records = getEntityStore(db, entityName).filter((record) => matchesFilter(record, scopedFilter));
    return sortRecords(records, order).slice(skip || 0, limit ? (skip || 0) + limit : undefined);
  },

  async get(id) {
    const db = loadDb();
    const record = getEntityStore(db, entityName).find((item) => String(item.id) === String(id));
    if (!record) throw new Error(`${entityName} local nao encontrado: ${id}`);
    return record;
  },

  async create(data = {}) {
    assertLocalMutationAllowed(entityName, 'criar');
    if (entityName === 'MovimentacaoEstoque' && isAjusteEstoque(data)) {
      assertLocalMutationAllowed(entityName, 'ajustar');
    }
    const db = loadDb();
    const records = getEntityStore(db, entityName);
    const stamped = applyLocalMasterCadastro(db, entityName, stampRecordContext(entityName, data));
    const estoque = applyLocalEstoqueMovimento(db, entityName, stamped);
    if (estoque.reuse) return estoque.reuse;
    const payload = estoque.record || stamped;
    const record = {
      ...payload,
      id: payload.id || makeId(entityName.toLowerCase()),
      created_date: payload.created_date || now(),
      updated_date: now(),
    };
    records.unshift(record);
    if (entityName === 'MovimentacaoEstoque') {
      applyLocalEstoqueProdutoPatch(db, record.produto_id, estoque.produtoPatch);
    }
    saveDb(db);
    notify(entityName, 'create', record);
    auditLocalMutation(entityName, 'Criacao', { after: record, recordId: record.id });
    return record;
  },

  async update(id, data = {}) {
    assertLocalMutationAllowed(entityName, 'editar', id);
    const db = loadDb();
    const records = getEntityStore(db, entityName);
    const index = records.findIndex((item) => String(item.id) === String(id));
    if (index < 0) throw new Error(`${entityName} local nao encontrado: ${id}`);
    const before = { ...records[index] };
    const payload = stampRecordContext(entityName, data);
    records[index] = {
      ...records[index],
      ...payload,
      id: records[index].id,
      updated_date: now(),
    };
    saveDb(db);
    notify(entityName, 'update', records[index]);
    auditLocalMutation(entityName, 'Atualizacao', { before, after: records[index], recordId: records[index].id });
    return records[index];
  },

  async delete(id) {
    if (HISTORICO_ESTOQUE_ENTITIES.includes(entityName)) {
      throw new Error('Exclusao de historico bloqueada.');
    }
    assertLocalMutationAllowed(entityName, 'excluir', id);
    const db = loadDb();
    const records = getEntityStore(db, entityName);
    const index = records.findIndex((item) => String(item.id) === String(id));
    markRecordDeletedLocally(entityName, id);
    if (index < 0) return { success: true };
    const [removed] = records.splice(index, 1);
    saveDb(db);
    notify(entityName, 'delete', removed);
    auditLocalMutation(entityName, 'Exclusao', { before: removed, recordId: removed?.id || id });
    return { success: true };
  },

  async bulkCreate(items = []) {
    const created = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
  },

  async schema() {
    const db = loadDb();
    const sample = getEntityStore(db, entityName)[0] || {};
    const properties = Object.fromEntries(
      ['id', 'created_date', 'updated_date', 'empresa_id', 'group_id', ...Object.keys(sample)].map((key) => [key, { type: 'string' }])
    );
    return { properties };
  },

  subscribe(listener) {
    if (!listeners.has(entityName)) listeners.set(entityName, new Set());
    listeners.get(entityName).add(listener);
    return () => listeners.get(entityName)?.delete(listener);
  },
});

const entities = new Proxy({}, {
  get(target, prop) {
    if (typeof prop !== 'string') return undefined;
    if (!target[prop]) target[prop] = createEntityApi(prop);
    return target[prop];
  },
});

const normalizeLocalConfigScope = (scope = {}) => {
  const context = validateMultiempresaContext(scope);
  if (!context.valid) return { valid: false, error: context.error, scope: {} };
  return { valid: true, error: null, scope: toEntityScope(context) };
};

const upsertConfig = async ({ chave, data = {}, scope = {} }) => {
  const normalizedScope = normalizeLocalConfigScope(scope);
  if (!chave) throw new Error('Chave obrigatoria para ConfiguracaoSistema local');
  if (!normalizedScope.valid) {
    throw new Error(`Contexto multiempresa obrigatorio para ConfiguracaoSistema local: ${normalizedScope.error}`);
  }

  const filter = { chave, ...normalizedScope.scope };
  const existing = await entities.ConfiguracaoSistema.filter(filter, '-updated_date', 1);
  const payload = {
    chave,
    categoria: data.categoria || 'Sistema',
    ...data,
    ...normalizedScope.scope,
    updated_date: now(),
  };
  const record = existing[0]
    ? await entities.ConfiguracaoSistema.update(existing[0].id, payload)
    : await entities.ConfiguracaoSistema.create(payload);
  return { data: { record } };
};

const countEntity = async (entityName, filter = {}) => {
  const rows = await entities[entityName].filter(filter);
  return rows.length;
};

const functions = {
  async invoke(name, payload = {}) {
    switch (name) {
      case 'getEntityRecord': {
        if (!payload.entityName) return { data: [] };
        const filter = expandLocalContextFilter(payload.entityName, payload.filter || {});
        const data = await entities[payload.entityName].filter(filter, payload.sortField, payload.limit);
        return { data };
      }
      case 'entityListSorted': {
        if (!payload.entityName) return { data: [] };
        const filter = expandLocalContextFilter(payload.entityName, payload.filter || {});
        const data = await entities[payload.entityName].filter(filter, payload.sortField, payload.limit);
        return { data: sortRecords(data, payload.sortField, payload.sortDirection) };
      }
      case 'upsertConfig':
        return upsertConfig(payload);
      case 'countEntities': {
        if (payload.entityName) {
          const filter = expandLocalContextFilter(payload.entityName, payload.filter || {});
          const count = await countEntity(payload.entityName, filter);
          return { data: { count, counts: { [payload.entityName]: count }, [payload.entityName]: count } };
        }
        const entitiesList = payload.entities || [];
        const counts = {};
        for (const item of entitiesList) {
          const entityName = typeof item === 'string' ? item : item.entityName || item.name;
          if (entityName) counts[entityName] = await countEntity(entityName, expandLocalContextFilter(entityName, item.filter || {}));
        }
        return { data: { counts, ...counts } };
      }
      case 'entityGuard':
        {
          const result = evaluateLocalPermission(payload);
          return {
            data: {
              allowed: result.allowed,
              can: result.allowed,
              permitido: result.allowed,
              local: true,
              reason: result.reason || null,
            },
          };
        }
      case 'verifyTotp':
        return { data: { valid: true, local: true } };
      case 'iaFinanceAnomalyScan':
      case 'groupConsolidation':
      case 'conflictPolicy':
      case 'sodValidator':
      case 'seedData':
      case 'backfillGroupEmpresa':
        return { data: { ok: true, local: true, message: 'Simulado localmente.' } };
      default:
        return { data: { ok: true, local: true, functionName: name, message: 'Funcao externa simulada no modo local.' } };
    }
  },
};

const Core = {
  async InvokeLLM(payload = {}) {
    return {
      response: payload.response_json_schema ? {} : 'Resposta simulada localmente. Configure um provedor local de IA para respostas reais.',
      data: payload.response_json_schema ? {} : undefined,
      local: true,
    };
  },
  async SendEmail() {
    return { success: true, local: true, message: 'Email nao enviado: modo local.' };
  },
  async SendSMS() {
    return { success: true, local: true, message: 'SMS nao enviado: modo local.' };
  },
  async UploadFile({ file } = {}) {
    return { file_url: `local://uploads/${file?.name || makeId('arquivo')}`, url: `local://uploads/${file?.name || makeId('arquivo')}`, local: true };
  },
  async GenerateImage() {
    return { url: '', local: true, message: 'Geracao de imagem externa desativada no modo local.' };
  },
  async ExtractDataFromUploadedFile() {
    return { output: {}, data: {}, local: true, message: 'Extracao externa desativada no modo local.' };
  },
};

export const localBase44 = {
  entities,
  functions,
  integrations: { Core },
  appLogs: {
    async logUserInApp(pageName) {
      try {
        await entities.AuditLog.create({
          usuario: readUser()?.email || 'admin@erp-local.test',
          acao: 'Navegacao',
          modulo: pageName || 'Sistema',
          tipo_auditoria: 'ui',
          entidade: 'AppLog',
          descricao: `Acesso local a ${pageName || 'pagina'}`,
          data_hora: now(),
          local: true,
        });
      } catch (error) { reportLocalClientFailure('Falha ao registrar navegacao local', error, { pageName }); }
      return { success: true, local: true };
    },
  },
  analytics: {
    async track(event = {}) {
      try {
        await entities.AuditLog.create({
          usuario: readUser()?.email || 'admin@erp-local.test',
          acao: 'Analytics',
          modulo: 'Sistema',
          tipo_auditoria: 'ui',
          entidade: 'Analytics',
          descricao: event?.eventName || event?.name || 'Evento local',
          dados_novos: event,
          data_hora: now(),
          local: true,
        });
      } catch (error) { reportLocalClientFailure('Falha ao registrar analytics local', error, { eventName: event?.eventName || event?.name }); }
      return { success: true, local: true };
    },
  },
  users: {
    async inviteUser(email, role = 'user') {
      const user = await entities.User.create({
        email,
        role,
        full_name: email,
        disabled: false,
        is_verified: false,
        convite_local: true,
        group_id: readUser()?.grupo_atual_id || 'local_grupo_cpa',
      });
      return { success: true, local: true, user };
    },
  },
  auth: {
    async me() {
      const user = readUser();
      const evaluation = evaluateLocalUserSession(user);
      if (!evaluation.allowed) throw createAuthDeniedError(evaluation);
      return user;
    },
    async isAuthenticated() {
      const user = readUser();
      return evaluateLocalUserSession(user).allowed;
    },
    async updateMe(updates = {}) {
      const user = writeUser(updates);
      try {
        if (updates.contexto_atual) safeStorage.setItem('contexto_atual', updates.contexto_atual);
        if (updates.empresa_atual_id) safeStorage.setItem('empresa_atual_id', updates.empresa_atual_id);
        if (updates.grupo_atual_id) safeStorage.setItem('group_atual_id', updates.grupo_atual_id);
      } catch (error) { reportLocalClientFailure('Falha ao atualizar contexto do usuario local', error, { user_id: user?.id }); }
      return user;
    },
    logout() {
      return true;
    },
    redirectToLogin() {
      return true;
    },
  },
  __local: {
    reset() {
      safeStorage.removeItem(STORAGE_KEY);
      safeStorage.removeItem(USER_KEY);
      safeStorage.removeItem(DELETED_RECORDS_KEY);
      return loadDb();
    },
    export() {
      return loadDb();
    },
  },
};

localBase44.asServiceRole = localBase44;
