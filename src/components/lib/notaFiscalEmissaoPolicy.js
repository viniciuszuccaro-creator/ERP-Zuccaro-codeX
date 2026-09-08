const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const NOTA_FISCAL_ENTITIES = ['NotaFiscal', 'NFe'];

export const nfeSequenceKey = (empresaId, serie) => `seq_nfe_${firstText(empresaId) || 'empresa'}_${firstText(serie) || '1'}`;

export const normalizeAmbienteNfe = (value) => {
  const raw = String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (raw.startsWith('prod')) return 'producao';
  return 'homologacao';
};

export const isAmbienteProducao = (value) => normalizeAmbienteNfe(value) === 'producao';

export const isProvedorFiscalConfigurado = (integracao = {}) => {
  const ativo = integracao.ativo !== false && integracao.ativa !== false;
  return Boolean(ativo && firstText(integracao.api_key, integracao.token));
};

export const isProducaoAutorizada = (...flags) => flags.some((value) => (
  value === true || String(value || '').trim().toLowerCase() === 'true' || String(value || '').trim() === '1'
));

export const parseNumeroNfe = (value) => {
  const parsed = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const resolveNextNumeroNfe = ({ records = [], empresaId, serie = '1', currentMax = 0 } = {}) => {
  const scopedEmpresa = firstText(empresaId);
  const scopedSerie = firstText(serie) || '1';
  const maxExisting = (Array.isArray(records) ? records : []).reduce((max, item) => {
    if (scopedEmpresa && firstText(item.empresa_id, item.empresa_faturamento_id) !== scopedEmpresa) return max;
    if (firstText(item.serie) && firstText(item.serie) !== scopedSerie) return max;
    const parsed = parseNumeroNfe(item.numero || item.numero_nfe);
    return parsed > max ? parsed : max;
  }, 0);
  return String(Math.max(currentMax, maxExisting) + 1);
};

export const assertItensFiscaisMinimos = (nfe = {}) => {
  const cfop = firstText(nfe.cfop, nfe.cfop_pedido, nfe.natureza_cfop);
  const itens = Array.isArray(nfe.itens) ? nfe.itens : [];
  const itemCfop = itens.map((item) => firstText(item.cfop, item.cfop_item)).find(Boolean);
  if (!cfop && !itemCfop) {
    throw new Error('CFOP obrigatorio para emitir NF-e.');
  }
};

export const assertEmissaoNFe = ({
  empresaId,
  ambiente,
  producaoAutorizada = false,
  provedorConfigurado = false,
  nfe = {},
  modoOperacao = 'piloto',
  usuarioPiloto = false,
} = {}) => {
  if (!firstText(empresaId, nfe.empresa_id, nfe.empresa_faturamento_id)) {
    throw new Error('Empresa emitente obrigatoria para NF-e.');
  }
  assertItensFiscaisMinimos(nfe);
  const producao = isAmbienteProducao(ambiente || nfe.ambiente);
  if (!producao) {
    return { ambiente: 'homologacao', permiteSimulacao: true };
  }
  if (!producaoAutorizada) {
    throw new Error('Emissao em producao exige autorizacao explicita.');
  }
  if (!provedorConfigurado) {
    throw new Error('Emissao em producao exige provedor fiscal configurado.');
  }
  const modo = String(modoOperacao || 'piloto').trim().toLowerCase();
  if (modo !== 'producao' && usuarioPiloto !== true) {
    throw new Error('Emissao em producao no piloto exige usuario piloto designado.');
  }
  return { ambiente: 'producao', permiteSimulacao: false };
};

export const applyNumeroNfeOnCreate = ({ record = {}, records = [], sequenceValue = 0 } = {}) => {
  const empresaId = firstText(record.empresa_id, record.empresa_faturamento_id);
  if (!empresaId) {
    throw new Error('Empresa emitente obrigatoria para NF-e.');
  }
  const serie = firstText(record.serie, record.serie_nfe) || '1';
  const incoming = parseNumeroNfe(record.numero || record.numero_nfe);
  if (incoming > 0) {
    return { ...record, serie, numero: String(incoming), ambiente: record.ambiente || 'Homologacao' };
  }
  return {
    ...record,
    serie,
    numero: resolveNextNumeroNfe({ records, empresaId, serie, currentMax: sequenceValue }),
    ambiente: record.ambiente || 'Homologacao',
  };
};

export const assertNotaFiscalOnDelete = (record = {}) => {
  const status = String(record.status || '').toLowerCase();
  if (['autorizada', 'cancelada', 'denegada'].some((item) => status.includes(item))) {
    throw new Error('Exclusao de NF autorizada bloqueada.');
  }
};

const normalizeNfeStatus = (status) => String(status || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const statusIncludes = (status, token) => normalizeNfeStatus(status).includes(token);

const FROZEN_AFTER_AUTORIZADA = [
  'numero',
  'serie',
  'chave_acesso',
  'valor_total',
  'pedido_id',
  'empresa_id',
  'empresa_faturamento_id',
];

const moneyOrTextChanged = (before, patch, field) => {
  if (!Object.prototype.hasOwnProperty.call(patch, field)) return false;
  if (patch[field] === undefined || patch[field] === null || patch[field] === '') {
    return Boolean(firstText(before[field]));
  }
  return firstText(patch[field]) !== firstText(before[field]);
};

export const assertNotaFiscalOnUpdate = ({ before = {}, patch = {} } = {}) => {
  if (!before?.id) throw new Error('Nota fiscal nao encontrada.');

  const beforeEmpresa = firstText(before.empresa_id, before.empresa_faturamento_id);
  const patchEmpresa = firstText(patch.empresa_id, patch.empresa_faturamento_id);
  if (patchEmpresa && beforeEmpresa && patchEmpresa !== beforeEmpresa) {
    throw new Error('NF-e deve pertencer a empresa emitente correta.');
  }

  const nextStatus = firstText(patch.status) || before.status;
  const becomingAutorizada = !statusIncludes(before.status, 'autorizada') && statusIncludes(nextStatus, 'autorizada');
  const becomingCancelada = !statusIncludes(before.status, 'cancelada') && statusIncludes(nextStatus, 'cancelada');
  const retryAutorizada = statusIncludes(before.status, 'autorizada')
    && Object.prototype.hasOwnProperty.call(patch, 'status')
    && statusIncludes(patch.status, 'autorizada')
    && !becomingCancelada;
  const retryCancelada = statusIncludes(before.status, 'cancelada')
    && Object.prototype.hasOwnProperty.call(patch, 'status')
    && statusIncludes(patch.status, 'cancelada');

  const frozenHit = FROZEN_AFTER_AUTORIZADA.some((field) => moneyOrTextChanged(before, patch, field));
  const finalizada = ['autorizada', 'cancelada', 'denegada'].some((token) => statusIncludes(before.status, token));

  if (finalizada && frozenHit && !becomingCancelada) {
    throw new Error('NF autorizada nao pode ser recalculada.');
  }

  if (retryAutorizada || retryCancelada) {
    return { reuse: before, record: before, emit: false, cancel: false };
  }

  if (becomingAutorizada) {
    return {
      reuse: null,
      emit: true,
      cancel: false,
      record: {
        ...patch,
        empresa_id: before.empresa_id || patch.empresa_id,
        empresa_faturamento_id: before.empresa_faturamento_id || patch.empresa_faturamento_id || before.empresa_id,
        pedido_id: before.pedido_id || patch.pedido_id,
        numero: before.numero || patch.numero,
        serie: before.serie || patch.serie,
      },
    };
  }

  if (becomingCancelada) {
    return {
      reuse: null,
      emit: false,
      cancel: true,
      record: {
        ...patch,
        empresa_id: before.empresa_id,
        empresa_faturamento_id: before.empresa_faturamento_id || before.empresa_id,
        pedido_id: before.pedido_id,
        numero: before.numero,
        serie: before.serie,
        chave_acesso: before.chave_acesso,
        status: 'Cancelada',
      },
    };
  }

  return { reuse: null, record: patch, emit: false, cancel: false };
};

export const nfeEmitPermissionActions = () => ['emitir', 'enviar', 'gerarNFe'];
export const nfeCancelPermissionActions = () => ['cancelar'];
