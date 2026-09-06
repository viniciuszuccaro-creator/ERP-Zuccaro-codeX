const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const MASTER_CODE_SPECS = {
  Produto: { field: 'codigo', width: 4 },
  Cliente: { field: 'codigo', width: 6 },
  Fornecedor: { field: 'codigo', width: 6 },
  Transportadora: { field: 'codigo', width: 6 },
  Pedido: { field: 'numero_pedido', width: 6, prefix: 'PED-' },
};

export const sequenceKeyFor = (entityName, groupId) => `seq_codigo_${entityName}_${groupId || 'grupo'}`;

export const normalizeDocumento = (value) => String(value || '').replace(/\D/g, '');

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
  if (!conflict) return record;
  return {
    ...record,
    [spec.field]: next,
    codigo_origem: record.codigo_origem || incoming,
    codigo_legado: record.codigo_legado || incoming,
  };
};

export const findDuplicateMaster = ({ entityName, record = {}, records = [] } = {}) => {
  const groupId = firstText(record.group_id, record.grupo_id);
  const sameGroup = (item) => !groupId || firstText(item.group_id, item.grupo_id) === groupId;

  if (['Cliente', 'Fornecedor', 'Transportadora'].includes(entityName)) {
    const doc = normalizeDocumento(record.cpf_cnpj || record.cnpj || record.cpf);
    if (doc) {
      const hit = records.find((item) => sameGroup(item) && normalizeDocumento(item.cpf_cnpj || item.cnpj || item.cpf) === doc);
      if (hit) return { type: 'documento', existingId: hit.id };
    }
  }

  return null;
};

export const applyMasterCadastroOnCreate = ({ entityName, record = {}, records = [], sequenceValue = 0 } = {}) => {
  const withCode = applyCodigoOnCreate({ entityName, record, records, sequenceValue });
  const duplicate = findDuplicateMaster({ entityName, record: withCode, records });
  if (duplicate) {
    const error = new Error('Cadastro duplicado no grupo para este documento.');
    error.duplicate = duplicate;
    throw error;
  }
  return withCode;
};
