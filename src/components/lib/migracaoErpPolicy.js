const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const MIGRACAO_ORIGENS = ['erp_antigo', 'migracao', 'lote_csv', 'planilha'];
export const SECRET_MIGRACAO_KEYS = [
  'senha',
  'password',
  'senha_hash',
  'senha_legado',
  'password_hash',
  'token',
  'refresh_token',
  'api_key',
  'secret',
];

const slug = (value) => firstText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

export const isMigracaoOrigem = (value) => MIGRACAO_ORIGENS.includes(firstText(value).toLowerCase());

export const isMigracaoRecord = (record = {}) => Boolean(
  firstText(record.origem_migracao)
  || firstText(record.lote_migracao)
  || firstText(record.destino_migracao)
  || firstText(record.status_migracao)
  || record.importacao_erp === true
  || isMigracaoOrigem(record.origem)
  || isMigracaoOrigem(record.origem_cadastro)
);

export const stripSegredosMigracao = (record = {}) => {
  const next = { ...record };
  SECRET_MIGRACAO_KEYS.forEach((key) => {
    if (key in next) delete next[key];
  });
  return next;
};

export const buildLoteMigracaoId = ({
  arquivoNome,
  groupId,
  empresaId,
  entidade = 'registro',
} = {}) => {
  const fileSlug = slug(arquivoNome) || 'sem-arquivo';
  return `MIG-${slug(entidade) || 'registro'}-${firstText(groupId) || 'grupo'}-${firstText(empresaId) || 'grupo'}-${fileSlug}`;
};

export const stampMigracaoRecord = (record = {}, {
  arquivoNome,
  entidade = 'registro',
  confirmado = false,
  destino = 'producao',
} = {}) => {
  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  const codigoLegado = firstText(record.codigo_legado, record.id_antigo, record.codigo_origem, record.codigo, record.numero_pedido);
  return stripSegredosMigracao({
    ...record,
    origem_migracao: firstText(record.origem_migracao, record.origem, 'erp_antigo') || 'erp_antigo',
    origem_cadastro: firstText(record.origem_cadastro, 'migracao'),
    lote_migracao: firstText(record.lote_migracao) || buildLoteMigracaoId({
      arquivoNome,
      groupId,
      empresaId,
      entidade,
    }),
    codigo_legado: codigoLegado || record.codigo_legado,
    id_antigo: firstText(record.id_antigo, codigoLegado) || record.id_antigo,
    destino_migracao: firstText(record.destino_migracao, destino) || 'producao',
    status_migracao: firstText(record.status_migracao, confirmado ? 'validado' : 'staging'),
    importacao_erp: true,
    confirmado: confirmado || record.confirmado === true,
  });
};

export const findRegistroMigracaoDuplicado = (record = {}, records = []) => {
  const groupId = firstText(record.group_id, record.grupo_id);
  const empresaId = firstText(record.empresa_id);
  const legado = firstText(record.codigo_legado, record.id_antigo);
  if (!groupId || !legado) return null;
  return (Array.isArray(records) ? records : []).find((item) => (
    firstText(item.group_id, item.grupo_id) === groupId
    && firstText(item.codigo_legado, item.id_antigo) === legado
    && (!empresaId || firstText(item.empresa_id) === empresaId)
  )) || null;
};

export const buildReconciliacaoMigracao = ({ origem = [], gravados = [], reusos = [], campoValor = 'preco_venda' } = {}) => {
  const origemList = Array.isArray(origem) ? origem : [];
  const gravadoList = Array.isArray(gravados) ? gravados : [];
  const reusoList = Array.isArray(reusos) ? reusos : [];
  const soma = (lista) => lista.reduce((total, item) => total + (Number(item?.[campoValor]) || 0), 0);
  const amostra = gravadoList.slice(0, 5).map((item) => ({
    codigo_legado: firstText(item.codigo_legado, item.id_antigo),
    codigo_novo: firstText(item.codigo, item.numero_pedido, item.id),
    empresa_id: firstText(item.empresa_id),
    status: firstText(item.status, item.status_migracao),
  }));
  return {
    quantidade_origem: origemList.length,
    quantidade_gravada: gravadoList.length,
    quantidade_reuso: reusoList.length,
    divergencia_quantidade: origemList.length - gravadoList.length - reusoList.length,
    total_financeiro_origem: soma(origemList),
    total_financeiro_gravado: soma(gravadoList),
    amostra,
  };
};

export const assertReconciliacaoMigracao = (report = {}) => {
  if (!report || typeof report !== 'object') {
    throw new Error('Reconciliacao de migracao obrigatoria.');
  }
  if (!(Number(report.quantidade_origem) > 0)) {
    throw new Error('Migracao piloto exige ao menos uma linha de origem.');
  }
  if (Number(report.divergencia_quantidade) !== 0) {
    throw new Error(`Migracao com divergencia de quantidade: ${report.divergencia_quantidade}.`);
  }
  const amostra = Array.isArray(report.amostra) ? report.amostra : [];
  if (amostra.length === 0 && Number(report.quantidade_gravada) > 0) {
    throw new Error('Reconciliacao exige amostra com codigo legado e codigo novo.');
  }
  const semLegado = amostra.find((item) => !firstText(item?.codigo_legado));
  if (semLegado) {
    throw new Error('Amostra da reconciliacao exige codigo legado.');
  }
  return true;
};

export const applyMigracaoOnCreate = ({ entityName, record = {}, records = [] } = {}) => {
  if (!isMigracaoRecord(record)) return { reuse: null, record };
  const stripped = stripSegredosMigracao(record);

  if (!firstText(stripped.group_id, stripped.grupo_id)) {
    throw new Error('Grupo obrigatorio para migracao do ERP antigo.');
  }

  const stamped = stampMigracaoRecord(stripped, {
    entidade: entityName,
    confirmado: stripped.confirmado === true,
    destino: stripped.destino_migracao,
  });

  if (!firstText(stamped.codigo_legado, stamped.id_antigo)) {
    throw new Error('Codigo legado obrigatorio para migracao do ERP antigo.');
  }

  if (stamped.confirmado !== true) {
    throw new Error('Migracao para producao exige staging, reconciliacao e confirmacao.');
  }

  const reuse = findRegistroMigracaoDuplicado(stamped, records);
  if (reuse) return { reuse, record: stamped };
  return { reuse: null, record: stamped };
};
