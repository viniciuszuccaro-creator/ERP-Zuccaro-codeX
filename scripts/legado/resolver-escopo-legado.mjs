/**
 * Contrato sintético Grupo/Empresa do seletor legado.
 * Extraído de mapear-registro-sintetico.mjs (arquivo passou do limite de manutenção).
 * Não lê HD, não importa e não prova CNPJ.
 */

/** Empresas exibidas na aba Empresas do seletor. Não comprovam CNPJ. */
export const LEGADO_CODIGOS_EMPRESA_SELETOR = Object.freeze(['001', '002', '005']);

/** Grupo exibido na aba Grupo. Não é empresa emissora. */
export const LEGADO_CODIGO_GRUPO_SELETOR = '003';

export const LEGADO_SELETOR_MAP = Object.freeze({
  '001': { papel: 'empresa', label: 'CPA' },
  '002': { papel: 'empresa', label: '3Z_Armacao' },
  '003': { papel: 'grupo', label: 'GRUPO_CPA' },
  '005': { papel: 'empresa', label: 'ZUCCARO' },
});

/**
 * Rótulos de empresa do seletor. `003` não entra: é grupo.
 * `004` não está no seletor; ausência não prova inatividade.
 */
export const LEGADO_EMPRESA_CODIGO_MAP = Object.freeze({
  '001': { label: 'CPA', papel: 'empresa', comprovadoJuridico: false },
  '002': { label: '3Z_Armacao', papel: 'empresa', comprovadoJuridico: false },
  '005': { label: 'ZUCCARO', papel: 'empresa', comprovadoJuridico: false },
});

export const LEGADO_EMPRESA_CODIGOS_VALIDOS = LEGADO_CODIGOS_EMPRESA_SELETOR;

export const LEGADO_ENTIDADES_EXCLUIDAS = Object.freeze(['usuario', 'senha', 'permissao']);

export const PAPEL_ENTIDADE_LEGADO = Object.freeze({
  cliente: 'mestre',
  fornecedor: 'mestre',
  produto: 'mestre',
  obra: 'cadastro',
  condicao_pagamento: 'cadastro',
  tabela_preco: 'cadastro',
  empresa: 'cadastro',
  pedido: 'operacao',
  orcamento: 'operacao',
  estoque: 'operacao',
  contas_receber: 'operacao',
  contas_pagar: 'operacao',
  nota_fiscal: 'operacao',
});

const EMPRESA_KEYS = ['codigo_empresa', 'codigoempresa', 'cod_empresa', 'empresa_codigo', 'codigo_empresa_legado'];
const GRUPO_KEYS = ['codigo_grupo', 'codigo_grupo_legado', 'cod_grupo', 'grupo_codigo'];
const TIPO_NOTA_KEYS = [
  'codigo_tipo_nota',
  'codigo_tipo_nota_legado',
  'tipo_nota',
  'cod_tipo_nf',
  'tipo_nf',
  'codigo_tipo_nf',
];

const text = (value) => String(value ?? '').trim();

const first = (...vals) => {
  for (const v of vals) {
    const t = text(v);
    if (t) return t;
  }
  return '';
};

export const snapshotLinhaLegado = (row) => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  const out = {};
  for (const key of Object.keys(row)) {
    let value;
    try {
      value = row[key];
    } catch {
      throw new Error('linha_com_getter_invalido');
    }
    if (value && typeof value === 'object') continue;
    out[key] = value;
  }
  return out;
};

const lowerRow = (row) => Object.fromEntries(
  Object.entries(row || {}).map(([k, v]) => [String(k).toLowerCase(), v]),
);

export const pickAliasLegado = (row, aliases = []) => {
  const lower = lowerRow(row);
  for (const key of aliases) {
    if (lower[key] != null && text(lower[key]) !== '') return lower[key];
  }
  return '';
};

/** Preserva zeros à esquerda. `1` → `001`. Sequência só de zeros → `0`. */
export const normalizarCodigoSeletor = (codigo) => {
  const raw = text(codigo);
  if (!raw) return '';
  if (!/^\d+$/.test(raw)) return raw;
  if (/^0+$/.test(raw)) return '0';
  return raw.padStart(3, '0');
};

export const resolverEmpresaLegadoCodigo = (codigo) => {
  const c = normalizarCodigoSeletor(codigo);
  if (!c) return { codigo: '', conhecido: false };
  if (c === '0') return { codigo: '0', conhecido: false, quarentena: true, papel: 'invalido' };
  const hit = LEGADO_SELETOR_MAP[c];
  if (!hit) {
    return { codigo: c, conhecido: false, papel: 'desconhecido', comprovadoJuridico: false };
  }
  return {
    codigo: c,
    label: hit.label,
    papel: hit.papel,
    ativo: hit.papel === 'empresa',
    conhecido: true,
    comprovadoJuridico: false,
  };
};

export const extrairCodigosLegado = (row = {}) => {
  const tipoNota = normalizarCodigoSeletor(pickAliasLegado(row, TIPO_NOTA_KEYS));
  const grupoInformado = normalizarCodigoSeletor(pickAliasLegado(row, GRUPO_KEYS));
  const empresaBruta = normalizarCodigoSeletor(pickAliasLegado(row, EMPRESA_KEYS));
  const grupoNoCampoEmpresa = empresaBruta === LEGADO_CODIGO_GRUPO_SELETOR;
  return {
    codigo_tipo_nota_legado: tipoNota,
    codigo_grupo_legado: grupoNoCampoEmpresa
      ? (grupoInformado || LEGADO_CODIGO_GRUPO_SELETOR)
      : grupoInformado,
    codigo_empresa_legado: grupoNoCampoEmpresa ? '' : empresaBruta,
    grupo_no_campo_empresa: grupoNoCampoEmpresa,
  };
};

export const ehProdutoRevendaLegado = (row = {}) => {
  const flag = row.revenda ?? row.somente_revenda;
  if (flag === true || flag === 'true' || flag === 1 || flag === '1') return true;
  const tipo = text(row.tipo_produto ?? row.tipo ?? row.finalidade).toLowerCase();
  return tipo === 'revenda' || tipo === 'somente_revenda';
};

const motivosCodigo = (codigos) => {
  const motivos = [];
  const empresa = codigos.codigo_empresa_legado;
  if (empresa === '0') motivos.push('codigo_empresa_legado_0');
  if (empresa && empresa !== '0' && !LEGADO_CODIGOS_EMPRESA_SELETOR.includes(empresa)) {
    motivos.push('codigo_empresa_legado_nao_comprovado');
  }
  return motivos;
};

/**
 * Contexto autorizado (opts) não substitui a linha. Payload sozinho não vira escopo.
 * Operação só recebe empresa_id canônico de vínculo comprovado do mesmo grupo.
 * @param {Record<string, unknown>} row
 * @param {{ entidade?: string, groupId?: string, empresaId?: string, vinculosComprovados?: { groupId?: string, empresas?: Record<string, { empresaId?: string, comprovado?: boolean }> } }} opts
 */
export const avaliarEscopoLegado = (row = {}, opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const papel = PAPEL_ENTIDADE_LEGADO[entidade] || 'cadastro';
  const codigos = extrairCodigosLegado(row);
  const contextoGrupo = text(opts.groupId);
  const contextoEmpresa = text(opts.empresaId);
  const payloadGrupo = first(row.group_id, row.grupo_id);
  const payloadEmpresa = first(row.empresa_id);
  const vinculos = opts.vinculosComprovados || {};
  const vinculoGrupo = text(vinculos.groupId);
  const motivos = [...motivosCodigo(codigos)];

  if (!contextoGrupo) motivos.push('escopo_somente_payload');
  if (contextoGrupo && payloadGrupo && contextoGrupo !== payloadGrupo) motivos.push('grupo_divergente');
  if (contextoGrupo && vinculoGrupo && contextoGrupo !== vinculoGrupo) motivos.push('contexto_fora_do_vinculo');
  if ((papel === 'mestre' || (papel === 'cadastro' && entidade !== 'empresa')) && (contextoEmpresa || payloadEmpresa)) {
    motivos.push('empresa_proprietaria_indevida');
  }

  let groupCanonico = '';
  let empresaCanonica = '';
  let comprovado = false;

  const grupoOk = contextoGrupo
    && !motivos.includes('escopo_somente_payload')
    && !motivos.includes('grupo_divergente')
    && !motivos.includes('contexto_fora_do_vinculo');

  if (papel === 'operacao') {
    const empresa = codigos.codigo_empresa_legado;
    if (codigos.grupo_no_campo_empresa || (!empresa && codigos.codigo_grupo_legado === LEGADO_CODIGO_GRUPO_SELETOR)) {
      motivos.push('codigo_grupo_nao_e_emissor');
    } else if (!empresa) {
      motivos.push('empresa_nao_comprovada');
    } else if (LEGADO_CODIGOS_EMPRESA_SELETOR.includes(empresa)) {
      const mapa = vinculos.empresas?.[empresa];
      if (!mapa || mapa.comprovado !== true || !text(mapa.empresaId)) {
        motivos.push('vinculo_juridico_nao_comprovado');
      } else if (contextoEmpresa && contextoEmpresa !== text(mapa.empresaId)) {
        motivos.push('empresa_divergente');
      } else if (payloadEmpresa && payloadEmpresa !== text(mapa.empresaId)) {
        motivos.push('empresa_divergente');
      } else if (grupoOk) {
        empresaCanonica = text(mapa.empresaId);
        groupCanonico = contextoGrupo;
        comprovado = true;
      }
    }
  } else if (grupoOk && !motivos.includes('empresa_proprietaria_indevida')) {
    groupCanonico = contextoGrupo;
    if (entidade === 'empresa') {
      const code = codigos.codigo_empresa_legado || normalizarCodigoSeletor(opts.codigoEntidade);
      if (code === LEGADO_CODIGO_GRUPO_SELETOR || codigos.grupo_no_campo_empresa) {
        motivos.push('codigo_grupo_nao_e_emissor');
        groupCanonico = '';
      } else if (LEGADO_CODIGOS_EMPRESA_SELETOR.includes(code)) {
        const mapa = vinculos.empresas?.[code];
        if (!mapa || mapa.comprovado !== true || !text(mapa.empresaId)) {
          motivos.push('vinculo_juridico_nao_comprovado');
          groupCanonico = '';
        } else if ((contextoEmpresa && contextoEmpresa !== text(mapa.empresaId))
          || (payloadEmpresa && payloadEmpresa !== text(mapa.empresaId))) {
          motivos.push('empresa_divergente');
          groupCanonico = '';
        } else {
          empresaCanonica = text(mapa.empresaId);
          comprovado = true;
        }
      }
    }
  }

  const escopoMotivos = motivos.filter((m) => m !== 'codigo_empresa_legado_0'
    && m !== 'codigo_empresa_legado_nao_comprovado'
    && m !== 'codigo_grupo_no_campo_empresa');
  const aceito = escopoMotivos.length === 0
    && Boolean(groupCanonico)
    && (papel !== 'operacao' || Boolean(empresaCanonica));

  return {
    papel,
    aceito,
    motivos: [...new Set(motivos)],
    motivos_escopo: [...new Set(escopoMotivos)],
    group_id: aceito ? groupCanonico : '',
    empresa_id: aceito && (papel === 'operacao' || entidade === 'empresa') ? empresaCanonica : '',
    group_id_contexto: contextoGrupo,
    group_id_payload: payloadGrupo,
    empresa_id_contexto: contextoEmpresa,
    empresa_id_payload: payloadEmpresa,
    comprovado_juridico: aceito && comprovado,
    visivel_consolidado_grupo: papel === 'operacao' && aceito,
    duplicacao_fisica: false,
    escopo_mestre: (papel === 'mestre' || papel === 'cadastro') && aceito ? 'grupo' : '',
    ...codigos,
  };
};
