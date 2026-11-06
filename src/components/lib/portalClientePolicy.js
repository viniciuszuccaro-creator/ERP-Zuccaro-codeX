/**
 * @typedef {Record<string, unknown> & {
 *   id?: string | number,
 *   portal_usuario_id?: unknown,
 *   cliente_id?: unknown,
 *   cliente_fornecedor_id?: unknown,
 *   destinatario_id?: unknown,
 *   nome?: unknown,
 *   razao_social?: unknown,
 *   status?: unknown,
 *   visivel_no_portal?: boolean,
 *   valor?: string | number,
 *   valor_total?: string | number,
 *   data_vencimento?: string | number,
 *   updated_date?: unknown,
 *   portal_segunda_via_key?: unknown,
 *   url_boleto_pdf?: unknown,
 *   pix_copia_cola?: unknown,
 *   linha_digitavel?: unknown,
 *   xml_url?: unknown,
 *   xml_nfe?: unknown,
 *   danfe_url?: unknown,
 *   pdf_url?: unknown,
 * }} PortalRecord
 * @typedef {{ requestedClienteId?: unknown, adminMode?: boolean }} PortalClienteIdOptions
 * @typedef {{ user?: PortalRecord | null, cliente?: PortalRecord | null, requestedClienteId?: unknown, adminMode?: boolean }} PortalScopeOptions
 * @typedef {{ entityName?: string, records?: PortalRecord[], portalClienteId?: unknown }} PortalReadOptions
 * @typedef {{
 *   authLoading?: boolean,
 *   authError?: Error | null,
 *   user?: PortalRecord | null,
 *   vinculoLoading?: boolean,
 *   vinculoFetched?: boolean,
 *   vinculoError?: Error | null,
 *   vinculoCliente?: PortalRecord | null,
 *   requestedClienteId?: unknown,
 *   adminMode?: boolean,
 *   elapsedMs?: number,
 * }} PortalSessionOptions
 * @typedef {{ titulo?: PortalRecord, clienteId?: unknown }} PortalTituloOptions
 * @typedef {{ before?: PortalRecord, patch?: PortalRecord, portalClienteId?: unknown }} PortalTituloWriteOptions
 * @typedef {{ nfe?: PortalRecord, clienteId?: unknown }} PortalNfeOptions
 * @typedef {{ tipo?: unknown, tituloId?: unknown, nonce?: unknown }} PortalFinanceKeyOptions
 * @typedef {{ titulo?: PortalRecord, cliente?: PortalRecord }} PortalSegundaViaOptions
 * @typedef {{ aberto: number, atrasado: number, quantidade: number }} PortalSaldo
 */

/** @param {...unknown} values */
const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

/** @param {unknown} value */
const portalIdentityText = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? firstText(value) : '';

export const PORTAL_TIMEOUT_MS = 12000;

export const PORTAL_SCOPED_ENTITIES = new Set([
  'Pedido',
  'NotaFiscal',
  'NFe',
  'ContaReceber',
  'Entrega',
  'Chamado',
  'OrcamentoCliente',
  'Oportunidade',
]);

/** @param {PortalClienteIdOptions} options */
export const sanitizePortalClienteId = ({ requestedClienteId, adminMode = false } = {}) => {
  if (!adminMode) return null;
  return firstText(requestedClienteId) || null;
};

/** @param {unknown} value @returns {value is string} */
export function isPortalClienteIdentificado(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** @param {PortalRecord} orcamento @param {unknown} clienteId
 * @returns {asserts orcamento is PortalRecord & {id: string}} */
export function assertPortalOrcamentoIdentificado(orcamento, clienteId) {
  if (!isPortalClienteIdentificado(clienteId) || !isPortalClienteIdentificado(orcamento?.id)) {
    throw new Error('Identidade do cliente e do orcamento obrigatoria.');
  }
  assertPortalTituloDoCliente({titulo: orcamento, clienteId});
  if (orcamento.cliente_id !== clienteId || orcamento.status !== 'Pendente') {
    throw new Error('Orcamento sem vinculo literal ou fora do estado pendente.');
  }
}

/** Checksum dos bytes PNG; nao autentica pessoa, certificado ou aceite.
 * @param {Blob} blob */
export async function calcularChecksumAssinaturaPortal(blob) {
  if (!(blob instanceof Blob) || blob.type !== 'image/png' || blob.size > 2 * 1024 * 1024 || blob.size < 8) {
    throw new Error('Arquivo de assinatura PNG invalido.');
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const header = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!header.every((value, index) => bytes[index] === value)) throw new Error('Arquivo de assinatura PNG invalido.');
  if (!globalThis.crypto?.subtle) throw new Error('Checksum de assinatura indisponivel.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

/** @param {PortalScopeOptions} options */
export const assertPortalClienteScope = ({ user, cliente, requestedClienteId, adminMode = false } = {}) => {
  if (!portalIdentityText(user?.id) || !portalIdentityText(cliente?.id)) {
    throw new Error('Identidade do usuario e do cliente obrigatoria.');
  }
  const requested = firstText(requestedClienteId);
  if (requested && !adminMode) {
    if (!cliente || firstText(cliente.id) !== requested) {
      throw new Error('Acesso a outro cliente bloqueado.');
    }
  }
  if (!adminMode && (!portalIdentityText(cliente.portal_usuario_id) || portalIdentityText(cliente.portal_usuario_id) !== portalIdentityText(user.id))) {
    throw new Error('Cliente nao vinculado a este usuario.');
  }
  return true;
};

/**
 * @param {PortalRecord[]} clientes
 * @param {PortalRecord} user
 */
export const resolvePortalClienteId = (clientes = [], user = {}) => resolvePortalClienteVinculado(clientes, user)?.id || null;

/** @param {PortalRecord[]} clientes @param {PortalRecord} user @param {PortalClienteIdOptions} options */
export const resolvePortalClienteVinculado = (clientes = [], user = {}, {requestedClienteId, adminMode = false} = {}) => {
  const userId = portalIdentityText(user.id);
  if (!userId) return null;
  if (!Array.isArray(clientes)) throw new Error('Resposta de vinculo do portal invalida.');
  const requested = sanitizePortalClienteId({requestedClienteId, adminMode});
  const matches = clientes.filter(item => requested
    ? portalIdentityText(item?.id) === requested
    : portalIdentityText(item?.portal_usuario_id) === userId);
  if (matches.length > 1) throw new Error('Vinculo de cliente ambiguo. Revisao cadastral necessaria.');
  const cliente = matches[0] || null;
  if (cliente) assertPortalClienteScope({user, cliente, requestedClienteId: requested, adminMode});
  return cliente;
};

/** @param {PortalRecord} nfe */
export const clienteIdFromNfe = (nfe = {}) => {
  for (const value of [nfe.cliente_id, nfe.cliente_fornecedor_id, nfe.destinatario_id]) {
    if (value == null || value === '') continue;
    const id = portalIdentityText(value);
    if (!id) throw new Error('Identidade do cliente da nota fiscal invalida.');
    return id;
  }
  return '';
};

/** @param {PortalReadOptions} options */
export const applyPortalReadScope = ({ entityName, records = [], portalClienteId } = {}) => {
  if (!portalClienteId) return records;
  const scoped = portalIdentityText(portalClienteId);
  if (!scoped) throw new Error('Identidade do cliente do portal invalida.');
  const list = Array.isArray(records) ? records : [];
  if (entityName === 'Cliente') {
    return list.filter((item) => portalIdentityText(item.id) === scoped);
  }
  if (!PORTAL_SCOPED_ENTITIES.has(entityName)) return list;
  if (entityName === 'NotaFiscal' || entityName === 'NFe') {
    return list.filter((item) => clienteIdFromNfe(item) === scoped);
  }
  return list.filter((item) => portalIdentityText(item.cliente_id) === scoped);
};

/** @param {PortalSessionOptions} options */
export const resolvePortalSessionState = ({
  authLoading = false,
  authError = null,
  user = null,
  vinculoLoading = false,
  vinculoFetched = false,
  vinculoError = null,
  vinculoCliente = null,
  requestedClienteId = null,
  adminMode = false,
  elapsedMs = 0,
} = {}) => {
  if (authLoading) return { state: 'autenticando', cliente: null, title: 'Autenticando', message: 'Validando sua sessao.' };
  if (authError || !user) return { state: 'erro', cliente: null, title: 'Erro', message: 'Nao foi possivel autenticar no portal.' };
  if (elapsedMs >= PORTAL_TIMEOUT_MS && (vinculoLoading || authLoading)) {
    return { state: 'timeout', cliente: null, title: 'Timeout', message: 'O portal demorou demais para vincular o cliente.' };
  }
  if (vinculoLoading && !vinculoFetched) return { state: 'vinculando', cliente: null, title: 'Vinculando cliente', message: 'Localizando o cadastro vinculado ao seu usuario.' };
  if (vinculoError) return { state: 'erro', cliente: null, title: 'Erro', message: 'Falha ao carregar o cliente. Revise o vinculo do portal.' };
  if (!vinculoCliente) {
    return {
      state: adminMode ? 'sem_vinculo' : 'sem_vinculo',
      cliente: null,
      title: adminMode ? 'Sem vinculo para pre-visualizar' : 'Sem vinculo',
      message: adminMode
        ? 'Selecione um cliente em Cadastros para pre-visualizar, ou vincule um usuario ao cliente.'
        : 'Seu usuario nao esta vinculado a um cliente do portal.',
    };
  }
  try {
    assertPortalClienteScope({ user, cliente: vinculoCliente, requestedClienteId, adminMode });
  } catch (error) {
    return { state: 'sem_permissao', cliente: null, title: 'Sem permissao', message: error.message };
  }
  return { state: 'pronto', cliente: vinculoCliente, title: 'Pronto', message: '' };
};

/** @param {PortalTituloOptions} options */
export const assertPortalTituloDoCliente = ({ titulo = {}, clienteId } = {}) => {
  const scoped = portalIdentityText(clienteId);
  if (!scoped) throw new Error('Cliente do portal obrigatorio.');
  if (!portalIdentityText(titulo?.id)) throw new Error('Titulo obrigatorio.');
  if (portalIdentityText(titulo.cliente_id) !== scoped) {
    throw new Error('Titulo nao pertence ao cliente do portal.');
  }
  return true;
};

/** @param {PortalTituloWriteOptions} options */
export const assertPortalTituloWrite = ({ before = {}, patch = {}, portalClienteId } = {}) => {
  assertPortalTituloDoCliente({ titulo: before, clienteId: portalClienteId });
  if (Object.prototype.hasOwnProperty.call(patch, 'cliente_id')
    && (!portalIdentityText(patch.cliente_id) || portalIdentityText(patch.cliente_id) !== portalIdentityText(portalClienteId))) {
    throw new Error('Cliente do titulo nao pode ser alterado pelo portal.');
  }
  return true;
};

/** @param {PortalNfeOptions} options */
export const assertPortalNfeDoCliente = ({ nfe = {}, clienteId } = {}) => {
  const scoped = portalIdentityText(clienteId);
  if (!scoped) throw new Error('Cliente do portal obrigatorio.');
  if (!portalIdentityText(nfe?.id)) throw new Error('Nota fiscal obrigatoria.');
  if (clienteIdFromNfe(nfe) !== scoped) {
    throw new Error('Nota fiscal nao pertence ao cliente do portal.');
  }
  return true;
};

/** @param {PortalRecord} titulo */
export const isTituloAbertoPortal = (titulo = {}) => {
  const status = String(titulo.status || '').toLowerCase();
  return !status.includes('recebid')
    && !status.includes('liquid')
    && !status.includes('pago')
    && !status.includes('cancel');
};

/** @param {PortalRecord} titulo */
export const isTituloVisivelPortal = (titulo = {}) => {
  if (titulo.visivel_no_portal === false) return false;
  if (titulo.visivel_no_portal === true) return true;
  return isTituloAbertoPortal(titulo);
};

/**
 * @param {PortalRecord[]} titulos
 * @param {unknown} clienteId
 */
export const filtrarTitulosPortal = (titulos = [], clienteId) => {
  const scoped = portalIdentityText(clienteId);
  if (!scoped) return [];
  return (Array.isArray(titulos) ? titulos : []).filter((item) => (
    portalIdentityText(item.cliente_id) === scoped && isTituloVisivelPortal(item)
  ));
};

/**
 * @param {PortalRecord[]} titulos
 * @param {unknown} clienteId
 */
export const calcularSaldoPortal = (titulos = [], clienteId) => {
  const list = filtrarTitulosPortal(titulos, clienteId).filter(isTituloAbertoPortal);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return list.reduce((acc, item) => {
    const valor = Number(item.valor || item.valor_total || 0) || 0;
    acc.aberto += valor;
    const venc = item.data_vencimento ? new Date(item.data_vencimento) : null;
    if (venc && !Number.isNaN(venc.getTime()) && venc < hoje) acc.atrasado += valor;
    return acc;
  }, /** @type {PortalSaldo} */ ({ aberto: 0, atrasado: 0, quantidade: list.length }));
};

/** @param {PortalFinanceKeyOptions} options */
export const portalFinanceKey = ({ tipo, tituloId, nonce = '' } = {}) => {
  const t = firstText(tipo);
  const id = firstText(tituloId);
  if (!t || !id) return '';
  return ['portal', t, id, firstText(nonce)].filter(Boolean).join('|');
};

/** @param {unknown} value */
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

/** @param {PortalRecord} titulo */
export const buildLinhaDigitavelLocal = (titulo = {}) => {
  const base = `${onlyDigits(titulo.id)}${onlyDigits(titulo.valor || titulo.valor_total)}${onlyDigits(titulo.data_vencimento)}`.padEnd(47, '0');
  return base.slice(0, 47);
};

/**
 * @param {PortalRecord} titulo
 * @param {PortalRecord} cliente
 */
export const buildPixCopiaColaPortal = (titulo = {}, cliente = {}) => {
  const txid = firstText(titulo.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'PORTALTX';
  const valor = (Number(titulo.valor || titulo.valor_total || 0) || 0).toFixed(2);
  const nome = firstText(cliente.nome, cliente.razao_social, 'ERP ZUCCARO').slice(0, 25);
  // Formato sintetico legado, nao e PIX emitido. Segunda via nao usa este gerador.
  return [
    '000201',
    '2658',
    '0014BR.GOV.BCB.PIX',
    `01${String(txid.length).padStart(2, '0')}${txid}`,
    '52040000',
    '5303986',
    `54${String(valor.length).padStart(2, '0')}${valor}`,
    '5802BR',
    `59${String(nome.length).padStart(2, '0')}${nome}`,
    '6009SAO PAULO',
    '62070503***',
    '6304PORT',
  ].join('');
};

/** @param {PortalSegundaViaOptions} options */
export const buildSegundaViaPortal = ({ titulo = {}, cliente = {} } = {}) => {
  assertPortalTituloDoCliente({ titulo, clienteId: cliente.id });
  if (!isTituloAbertoPortal(titulo)) {
    throw new Error('Titulo liquidado ou cancelado nao emite segunda via.');
  }
  const pix = typeof titulo.pix_copia_cola === 'string' ? titulo.pix_copia_cola.trim() : '';
  const linha = typeof titulo.linha_digitavel === 'string' ? titulo.linha_digitavel.trim() : '';
  const url = typeof titulo.url_boleto_pdf === 'string' ? titulo.url_boleto_pdf.trim() : '';
  if (!pix && !linha && !url) {
    throw new Error('Segunda via indisponivel: aguarde os dados da emissao bancaria.');
  }
  const key = portalFinanceKey({
    tipo: 'segunda_via',
    tituloId: titulo.id,
    nonce: firstText(titulo.updated_date, titulo.data_vencimento, titulo.valor),
  });
  if (titulo.portal_segunda_via_key === key) {
    return { reuse: true, record: titulo };
  }
  return {
    reuse: false,
    record: {
      ...titulo,
      visivel_no_portal: true,
      url_boleto_pdf: url || undefined,
      linha_digitavel: linha || undefined,
      pix_copia_cola: pix || undefined,
      portal_segunda_via_em: new Date().toISOString(),
      portal_segunda_via_key: key,
      idempotency_key: key,
    },
  };
};

/** @param {PortalNfeOptions} options */
export const buildPortalDocumentoLinks = ({ nfe = {}, clienteId } = {}) => {
  assertPortalNfeDoCliente({ nfe, clienteId });
  return {
    xml: firstText(nfe.xml_url, nfe.xml_nfe) || null,
    danfe: firstText(nfe.danfe_url, nfe.pdf_url) || null,
    pode_baixar: Boolean(firstText(nfe.xml_url, nfe.xml_nfe, nfe.danfe_url, nfe.pdf_url)),
  };
};
