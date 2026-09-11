const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const LEGACY_REFERENCE_CODE_SPECS = {
  TabelaPreco: { field: 'codigo_tabela_legado', maxLength: 64 },
  Colaborador: { field: 'codigo_vendedor_legado', maxLength: 64 },
};

export const normalizeLegacyReferenceCode = (value, maxLength = 64) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized.length > maxLength || !/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    throw new Error('Codigo legado invalido: use ate 64 caracteres alfanumericos, ponto, hifen, barra ou sublinhado.');
  }
  return normalized;
};

export const applyLegacyReferenceCodePolicy = ({ entityName, record = {}, records = [], currentId = null } = {}) => {
  const spec = LEGACY_REFERENCE_CODE_SPECS[entityName];
  if (!spec || !Object.prototype.hasOwnProperty.call(record, spec.field)) return record;

  const code = normalizeLegacyReferenceCode(record[spec.field], spec.maxLength);
  if (!code) return { ...record, [spec.field]: '' };

  const groupId = firstText(record.group_id, record.grupo_id);
  if (!groupId) {
    throw new Error('group_id obrigatorio para codigo legado de referencia.');
  }

  const normalizedCode = code.toLocaleUpperCase('pt-BR');
  const duplicate = records.find((item) => (
    firstText(item.id) !== firstText(currentId)
    && firstText(item.group_id, item.grupo_id) === groupId
    && firstText(item[spec.field]).toLocaleUpperCase('pt-BR') === normalizedCode
  ));
  if (duplicate) {
    const error = new Error('Codigo legado duplicado no grupo para este cadastro.');
    error.duplicate = { type: spec.field, existingId: duplicate.id };
    throw error;
  }

  return { ...record, [spec.field]: code };
};

export const assertLegacyReferenceScope = ({
  entityName,
  record = {},
  before = null,
  currentGroupId = null,
  companies = [],
} = {}) => {
  const spec = LEGACY_REFERENCE_CODE_SPECS[entityName];
  if (!spec || !firstText(record[spec.field], before?.[spec.field])) return true;

  const groupId = firstText(record.group_id, record.grupo_id);
  const beforeGroupId = firstText(before?.group_id, before?.grupo_id);
  if (!groupId || (beforeGroupId && beforeGroupId !== groupId) || (currentGroupId && firstText(currentGroupId) !== groupId)) {
    throw new Error('Escopo de grupo invalido para codigo legado de referencia.');
  }

  const empresaField = entityName === 'Colaborador' ? 'empresa_alocada_id' : 'empresa_id';
  const empresaId = firstText(record[empresaField], record.empresa_id);
  if (!empresaId) return true;

  const empresa = (Array.isArray(companies) ? companies : []).find((item) => firstText(item?.id) === empresaId);
  const empresaGroupId = firstText(empresa?.group_id, empresa?.grupo_id, empresa?.grupo_empresarial_id);
  if (!empresa || empresaGroupId !== groupId) {
    throw new Error('Empresa externa ao grupo bloqueada para codigo legado de referencia.');
  }
  return true;
};

export const MASTER_CODE_SPECS = {
  Produto: { field: 'codigo', width: 4 },
  Cliente: { field: 'codigo', width: 6 },
  Fornecedor: { field: 'codigo', width: 6 },
  Transportadora: { field: 'codigo', width: 6 },
  Pedido: { field: 'numero_pedido', width: 6, prefix: 'PED-' },
  OrdemProducao: { field: 'numero_op', width: 6, prefix: 'OP-' },
  Entrega: { field: 'qr_code', width: 6, prefix: 'ENT-' },
  Romaneio: { field: 'numero_romaneio', width: 6, prefix: 'ROM-' },
  SeparacaoConferencia: { field: 'numero_separacao', width: 6, prefix: 'SEP-' },
  OrdemCompra: { field: 'numero_oc', width: 6, prefix: 'OC-' },
  SolicitacaoCompra: { field: 'numero_solicitacao', width: 6, prefix: 'SC-' },
  Cotacao: { field: 'numero_cotacao', width: 6, prefix: 'COT-' },
  Oportunidade: { field: 'codigo_oportunidade', width: 6, prefix: 'OPP-' },
  Interacao: { field: 'codigo_interacao', width: 6, prefix: 'INT-' },
  Campanha: { field: 'codigo_campanha', width: 6, prefix: 'CAMP-' },
  Rota: { field: 'codigo_rota', width: 6, prefix: 'ROT-' },
};

export const sequenceKeyFor = (entityName, groupId) => `seq_codigo_${entityName}_${groupId || 'grupo'}`;

export const normalizeDocumento = (value) => String(value || '').replace(/\D/g, '');

const SUPPLIER_PERSON_TYPE_ALIASES = new Map([
  ['F', 'Pessoa Fisica'],
  ['PF', 'Pessoa Fisica'],
  ['PESSOA FISICA', 'Pessoa Fisica'],
  ['J', 'Pessoa Juridica'],
  ['PJ', 'Pessoa Juridica'],
  ['PESSOA JURIDICA', 'Pessoa Juridica'],
]);

export const normalizeFornecedorPersonType = (value, document = '') => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();
  if (!normalized) return normalizeDocumento(document).length === 11 ? 'Pessoa Fisica' : 'Pessoa Juridica';
  const personType = SUPPLIER_PERSON_TYPE_ALIASES.get(normalized);
  if (!personType) throw new Error('Tipo de pessoa do fornecedor invalido.');
  return personType;
};

const hasRepeatedDigits = (document) => /^(\d)\1+$/.test(document);

const calculateCpfDigit = (digits, factor) => {
  const total = digits.split('').reduce((sum, digit) => sum + Number(digit) * factor--, 0);
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
};

export const isValidCpf = (value) => {
  const document = normalizeDocumento(value);
  if (document.length !== 11 || hasRepeatedDigits(document)) return false;
  const first = calculateCpfDigit(document.slice(0, 9), 10);
  const second = calculateCpfDigit(document.slice(0, 10), 11);
  return first === Number(document[9]) && second === Number(document[10]);
};

const calculateCnpjDigit = (digits, weights) => {
  const total = digits.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

export const isValidCnpj = (value) => {
  const document = normalizeDocumento(value);
  if (document.length !== 14 || hasRepeatedDigits(document)) return false;
  const first = calculateCnpjDigit(document.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateCnpjDigit(document.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(document[12]) && second === Number(document[13]);
};

export const normalizeFornecedorWebsite = (value) => {
  const website = String(value || '').trim();
  if (!website) return '';
  if (website.length > 240) throw new Error('Website do fornecedor excede 240 caracteres.');
  let parsed;
  try {
    parsed = new URL(website);
  } catch {
    throw new Error('Website do fornecedor invalido. Use uma URL completa com http ou https.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Website do fornecedor deve usar http ou https.');
  }
  return parsed.toString();
};

export const normalizeFornecedorRg = (value) => {
  const rg = String(value || '').trim().toUpperCase();
  if (!rg) return '';
  if (rg.length > 30 || !/^[0-9A-Z.\-/\s]+$/.test(rg)) {
    throw new Error('RG do fornecedor invalido.');
  }
  return rg;
};

export const normalizeFornecedorSimplesNacional = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0' || value == null || value === '') return false;
  const normalized = String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
  if (['sim', 's', 'true'].includes(normalized)) return true;
  if (['nao', 'n', 'false'].includes(normalized)) return false;
  throw new Error('Indicador do Simples Nacional invalido.');
};

const SUPPLIER_ACCOUNT_TYPES = new Map([
  ['CORRENTE', 'Corrente'],
  ['POUPANCA', 'Poupanca'],
  ['PAGAMENTO', 'Pagamento'],
]);

export const normalizeFornecedorDadosBancarios = (value) => {
  if (value == null || value === '') return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dados bancarios do fornecedor invalidos.');
  }
  const banco = String(value.banco || '').replace(/[<>]/g, '').trim().slice(0, 120);
  const agencia = String(value.agencia || '').replace(/[^0-9A-Za-z.\-/]/g, '').trim().slice(0, 30);
  const conta = String(value.conta || '').replace(/[^0-9A-Za-z.\-/]/g, '').trim().slice(0, 40);
  const rawType = String(value.tipo_conta || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
  if (![banco, agencia, conta, rawType].some(Boolean)) return {};
  if (!banco || !conta) throw new Error('Banco e conta sao obrigatorios nos dados bancarios do fornecedor.');
  const tipoConta = SUPPLIER_ACCOUNT_TYPES.get(rawType || 'CORRENTE');
  if (!tipoConta) throw new Error('Tipo de conta bancaria do fornecedor invalido.');
  return { banco, agencia, conta, tipo_conta: tipoConta };
};

export const normalizeFornecedorCadastro = (record = {}) => {
  const hasDocumentFields = ['tipo_pessoa', 'cpf_cnpj', 'cpf', 'cnpj'].some((field) => (
    Object.prototype.hasOwnProperty.call(record, field)
  ));
  const normalized = { ...record };

  if (hasDocumentFields) {
    const document = normalizeDocumento(firstText(record.cpf_cnpj, record.cpf, record.cnpj));
    const personType = normalizeFornecedorPersonType(record.tipo_pessoa, document);
    if (document) {
      const valid = personType === 'Pessoa Fisica' ? isValidCpf(document) : isValidCnpj(document);
      if (!valid) throw new Error(`Documento invalido para ${personType}.`);
    }
    normalized.tipo_pessoa = personType;
    normalized.cpf_cnpj = document;
    normalized.cpf = personType === 'Pessoa Fisica' ? document : '';
    normalized.cnpj = personType === 'Pessoa Juridica' ? document : '';
  }

  if (Object.prototype.hasOwnProperty.call(record, 'website')) {
    normalized.website = normalizeFornecedorWebsite(record.website);
  }
  if (Object.prototype.hasOwnProperty.call(record, 'rg')) {
    normalized.rg = normalizeFornecedorRg(record.rg);
  }
  if (Object.prototype.hasOwnProperty.call(record, 'simples_nacional')) {
    normalized.simples_nacional = normalizeFornecedorSimplesNacional(record.simples_nacional);
  }
  if (Object.prototype.hasOwnProperty.call(record, 'dados_bancarios')) {
    normalized.dados_bancarios = normalizeFornecedorDadosBancarios(record.dados_bancarios);
  }

  return normalized;
};

export const assertFornecedorScope = ({ record = {}, before = null, currentGroupId = null, companies = [] } = {}) => {
  const groupId = firstText(record.group_id, record.grupo_id, before?.group_id, before?.grupo_id);
  const beforeGroupId = firstText(before?.group_id, before?.grupo_id);
  if (!groupId || (beforeGroupId && beforeGroupId !== groupId) || (currentGroupId && firstText(currentGroupId) !== groupId)) {
    throw new Error('Escopo de grupo invalido para fornecedor.');
  }

  const empresaId = firstText(record.empresa_dona_id, record.empresa_id, before?.empresa_dona_id, before?.empresa_id);
  if (!empresaId) return true;
  const empresa = (Array.isArray(companies) ? companies : []).find((item) => firstText(item?.id) === empresaId);
  const empresaGroupId = firstText(empresa?.group_id, empresa?.grupo_id, empresa?.grupo_empresarial_id);
  if (!empresa || empresaGroupId !== groupId) {
    throw new Error('Empresa externa ao grupo bloqueada para fornecedor.');
  }
  return true;
};

export const parseNumericCode = (value) => {
  const match = String(value || '').match(/(\d+)(?!.*\d)/);
  const parsed = Number.parseInt(match?.[1] || '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const maxNumericCode = (records = [], field = 'codigo') => records.reduce((max, item) => {
  const parsed = parseNumericCode(item?.[field]);
  return parsed > max ? parsed : max;
}, 0);

export const resolveNextSequentialCode = ({ records = [], field = 'codigo', width = 4, currentMax = 0, prefix = '' } = {}) => {
  const next = Math.max(currentMax, maxNumericCode(records, field)) + 1;
  return `${prefix}${String(next).padStart(width, '0')}`;
};

export const applyCodigoOnCreate = ({ entityName, record = {}, records = [], sequenceValue = 0 } = {}) => {
  const spec = MASTER_CODE_SPECS[entityName];
  if (!spec) return record;
  const incoming = firstText(record[spec.field]);
  const next = resolveNextSequentialCode({
    records,
    field: spec.field,
    width: spec.width,
    currentMax: sequenceValue,
    prefix: spec.prefix || '',
  });
  if (!incoming) {
    return { ...record, [spec.field]: next };
  }
  const conflict = records.some((item) => firstText(item[spec.field]) === incoming);
  const isMigracao = Boolean(record.origem_migracao || record.lote_migracao || record.importacao_erp);
  if (isMigracao && !conflict) {
    return {
      ...record,
      codigo_origem: record.codigo_origem || incoming,
      codigo_legado: record.codigo_legado || incoming,
    };
  }
  // Produto (nao migracao): codigo interno sempre reservado no backend
  if (entityName === 'Produto' && !isMigracao) {
    return {
      ...record,
      [spec.field]: next,
      codigo_origem: record.codigo_origem || incoming,
      codigo_legado: record.codigo_legado || incoming,
    };
  }
  if (!conflict) return record;
  return {
    ...record,
    [spec.field]: next,
    codigo_origem: record.codigo_origem || incoming,
    codigo_legado: record.codigo_legado || incoming,
  };
};

export const findDuplicateMaster = ({ entityName, record = {}, records = [], currentId = null } = {}) => {
  const groupId = firstText(record.group_id, record.grupo_id);
  if (!groupId) {
    if (['Cliente', 'Fornecedor', 'Transportadora', 'Produto'].includes(entityName)) {
      return { type: 'sem_grupo' };
    }
    return null;
  }
  const sameGroup = (item) => firstText(item.group_id, item.grupo_id) === groupId;

  if (entityName === 'Produto') {
    const codigo = firstText(record.codigo);
    if (codigo) {
      const hit = records.find((item) => sameGroup(item) && firstText(item.codigo) === codigo);
      if (hit) return { type: 'codigo', existingId: hit.id };
    }
  }

  if (['Cliente', 'Fornecedor', 'Transportadora'].includes(entityName)) {
    const doc = normalizeDocumento(record.cpf_cnpj || record.cnpj || record.cpf);
    if (doc) {
      const hit = records.find((item) => (
        firstText(item.id) !== firstText(currentId)
        && sameGroup(item)
        && normalizeDocumento(item.cpf_cnpj || item.cnpj || item.cpf) === doc
      ));
      if (hit) return { type: 'documento', existingId: hit.id };
    }
  }

  return null;
};

export const applyMasterCadastroOnCreate = ({ entityName, record = {}, records = [], sequenceValue = 0 } = {}) => {
  const normalizedRecord = entityName === 'Fornecedor' ? normalizeFornecedorCadastro(record) : record;
  const groupId = firstText(normalizedRecord.group_id, normalizedRecord.grupo_id);
  const requiresGroup = Boolean(MASTER_CODE_SPECS[entityName])
    || Boolean(LEGACY_REFERENCE_CODE_SPECS[entityName] && firstText(record[LEGACY_REFERENCE_CODE_SPECS[entityName].field]))
    || ['Cliente', 'Fornecedor', 'Transportadora', 'Produto'].includes(entityName);
  if (requiresGroup && !groupId) {
    const error = new Error('group_id obrigatorio para cadastro mestre.');
    error.duplicate = { type: 'sem_grupo' };
    throw error;
  }
  const isMigracao = Boolean(normalizedRecord.origem_migracao || normalizedRecord.lote_migracao || normalizedRecord.importacao_erp);
  // Produto nao-migracao: rejeita codigo ja existente antes da reserva remapear
  if (entityName === 'Produto' && !isMigracao) {
    const preDup = findDuplicateMaster({ entityName, record: normalizedRecord, records });
    if (preDup?.type === 'codigo') {
      const error = new Error('Codigo duplicado no grupo para este cadastro.');
      error.duplicate = preDup;
      throw error;
    }
  }
  const withCode = applyCodigoOnCreate({ entityName, record: normalizedRecord, records, sequenceValue });
  const duplicate = findDuplicateMaster({ entityName, record: withCode, records });
  if (duplicate?.type === 'sem_grupo') {
    const error = new Error('group_id obrigatorio para cadastro mestre.');
    error.duplicate = duplicate;
    throw error;
  }
  if (duplicate) {
    const error = new Error(
      duplicate.type === 'codigo'
        ? 'Codigo duplicado no grupo para este cadastro.'
        : 'Cadastro duplicado no grupo para este documento.',
    );
    error.duplicate = duplicate;
    throw error;
  }
  return applyLegacyReferenceCodePolicy({ entityName, record: withCode, records });
};
