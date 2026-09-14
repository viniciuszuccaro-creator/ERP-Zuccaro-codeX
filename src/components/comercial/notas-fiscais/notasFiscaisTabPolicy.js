/** Politicas puras da aba fiscal existente. */

/** @typedef {{id?: string, group_id?: string, grupo_id?: string, nome_fantasia?: string, razao_social?: string, configuracao_fiscal?: Record<string, any>, integracao_nfe?: Record<string, any>}} EmpresaFiscal */
/**
 * @typedef {Object} NotaFiscalTabRecord
 * @property {string} [id]
 * @property {string} [group_id]
 * @property {string} [grupo_id]
 * @property {string} [empresa_id]
 * @property {string} [empresa_faturamento_id]
 * @property {string} [pedido_id]
 * @property {string} [numero_pedido]
 * @property {string} [numero]
 * @property {string} [serie]
 * @property {string} [tipo]
 * @property {string} [status]
 * @property {string} [ambiente]
 * @property {string} [cliente_fornecedor]
 * @property {string} [cliente_cpf_cnpj]
 * @property {string} [data_emissao]
 * @property {number} [valor_produtos]
 * @property {number} [valor_total]
 * @property {string} [observacoes]
 * @property {string} [natureza_operacao]
 * @property {string} [cfop]
 * @property {string} [chave_acesso]
 * @property {string} [protocolo_autorizacao]
 * @property {string} [danfe_url]
 * @property {string} [xml_url]
 * @property {string} [origem_simulacao]
 * @property {boolean} [simulacao]
 * @property {Array<Record<string, any>>} [historico]
 */

/** @returns {NotaFiscalTabRecord} */
export function createInitialNotaFiscalForm() {
  return {
    tipo: 'NF-e (Saída)', cliente_fornecedor: '', numero: '', serie: '1',
    data_emissao: new Date().toISOString().split('T')[0],
    valor_produtos: 0, valor_total: 0, observacoes: '',
  };
}
/** @param {unknown} value */
export function sanitizeFiscalText(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
}

/** @param {unknown} value */
export function resolveSafeFiscalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** @param {Record<string, any>} payload @param {string} groupId @param {string} empresaId */
export function stampFiscalContext(payload, groupId, empresaId) {
  if (!groupId || !empresaId) throw new Error('Grupo e empresa fiscal sao obrigatorios.');
  return { ...payload, group_id: groupId, grupo_id: groupId, empresa_id: empresaId, empresa_faturamento_id: empresaId };
}

/** @param {{groupId?: string|null, empresaId?: string|null, contexto?: string}} input */
export function buildNotaFiscalScope({ groupId, empresaId, contexto }) {
  if (!groupId) return { valid: false, filter: {} };
  if (contexto === 'grupo') return { valid: true, filter: { group_id: groupId } };
  if (!empresaId) return { valid: false, filter: {} };
  return { valid: true, filter: { group_id: groupId, empresa_id: empresaId } };
}

/**
 * @param {NotaFiscalTabRecord} nota
 * @param {{groupId?: string|null, empresaId?: string|null, contexto?: string, empresasDoGrupo?: EmpresaFiscal[]}} scope
 */
export function notaMatchesFiscalScope(nota, { groupId, empresaId, contexto, empresasDoGrupo = [] }) {
  const notaGroupId = nota.group_id || nota.grupo_id;
  const notaEmpresaId = nota.empresa_id || nota.empresa_faturamento_id;
  if (!groupId || !notaGroupId || String(notaGroupId) !== String(groupId) || !notaEmpresaId) return false;
  if (contexto === 'grupo') return empresasDoGrupo.some((empresa) => String(empresa.id) === String(notaEmpresaId));
  return Boolean(empresaId && String(notaEmpresaId) === String(empresaId));
}

/**
 * @param {NotaFiscalTabRecord} nota
 * @param {{groupId?: string|null, empresaId?: string|null, contexto?: string, empresasDoGrupo?: EmpresaFiscal[]}} scope
 * @returns {EmpresaFiscal}
 */
export function resolveEmpresaEmitente(nota, scope) {
  if (!notaMatchesFiscalScope(nota, scope)) throw new Error('NF-e fora do Grupo/Empresa autorizado.');
  const notaEmpresaId = nota.empresa_id || nota.empresa_faturamento_id;
  const empresa = scope.empresasDoGrupo?.find((item) => String(item.id) === String(notaEmpresaId));
  if (!empresa) throw new Error('Empresa emitente nao pertence ao Grupo autorizado.');
  return empresa;
}

/**
 * @param {NotaFiscalTabRecord[]} notas
 * @param {{searchTerm?: string, statusFilter?: string, tipoFilter?: string}} filters
 */
export function filterNotasFiscais(notas, { searchTerm = '', statusFilter = 'todas', tipoFilter = 'todas' }) {
  const search = searchTerm.toLocaleLowerCase('pt-BR');
  return notas.filter((nota) => {
    const values = [nota.cliente_fornecedor, nota.numero, nota.serie, nota.chave_acesso, nota.protocolo_autorizacao, nota.tipo, nota.status, nota.natureza_operacao, nota.cfop, nota.numero_pedido, nota.cliente_cpf_cnpj, nota.observacoes];
    const matchSearch = !search || values.some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
    return matchSearch && (statusFilter === 'todas' || nota.status === statusFilter) && (tipoFilter === 'todas' || nota.tipo === tipoFilter);
  });
}

/** @param {NotaFiscalTabRecord[]} notas */
export function summarizeNotasFiscais(notas) {
  return notas.reduce((totals, nota) => {
    if (nota.status === 'Autorizada') totals.totalAutorizada += Number(nota.valor_total || 0);
    if (nota.status === 'Cancelada') totals.totalCancelada += Number(nota.valor_total || 0);
    return totals;
  }, { total: notas.length, totalAutorizada: 0, totalCancelada: 0 });
}

/** @param {Record<string, any>} resultado @param {boolean} simulacao */
export function summarizeFiscalProviderResult(resultado, simulacao) {
  return {
    sucesso: resultado?.sucesso !== false && resultado?.success !== false && !resultado?.error,
    status: sanitizeFiscalText(resultado?.status || (resultado?.error ? 'erro' : 'concluido')).slice(0, 40),
    provedor: sanitizeFiscalText(resultado?.provedor || (simulacao ? 'Mock/Simulacao' : 'IntegracaoNFe')).slice(0, 60),
    ambiente: simulacao ? 'Homologacao' : 'Producao',
    simulacao: Boolean(simulacao),
    possui_protocolo: Boolean(resultado?.protocolo || resultado?.protocolo_cancelamento),
    possui_xml: Boolean(resultado?.xml_url || resultado?.xml_cancelamento_url),
    possui_danfe: Boolean(resultado?.pdf_url),
  };
}
