const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

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

export const sanitizePortalClienteId = ({ requestedClienteId, adminMode = false } = {}) => {
  if (!adminMode) return null;
  return firstText(requestedClienteId) || null;
};

export const assertPortalClienteScope = ({ user, cliente, requestedClienteId, adminMode = false } = {}) => {
  const requested = firstText(requestedClienteId);
  if (requested && !adminMode) {
    if (!cliente || firstText(cliente.id) !== requested) {
      throw new Error('Acesso a outro cliente bloqueado.');
    }
  }
  if (cliente && user && firstText(cliente.portal_usuario_id) && firstText(cliente.portal_usuario_id) !== firstText(user.id) && !adminMode) {
    throw new Error('Cliente nao vinculado a este usuario.');
  }
  return true;
};

export const resolvePortalClienteId = (clientes = [], user = {}) => {
  const userId = firstText(user.id);
  if (!userId) return null;
  const mine = (Array.isArray(clientes) ? clientes : []).find((item) => firstText(item.portal_usuario_id) === userId);
  return mine?.id || null;
};

export const clienteIdFromNfe = (nfe = {}) => firstText(
  nfe.cliente_id,
  nfe.cliente_fornecedor_id,
  nfe.destinatario_id,
);

export const applyPortalReadScope = ({ entityName, records = [], portalClienteId } = {}) => {
  if (!portalClienteId) return records;
  const list = Array.isArray(records) ? records : [];
  if (entityName === 'Cliente') {
    return list.filter((item) => firstText(item.id) === firstText(portalClienteId));
  }
  if (!PORTAL_SCOPED_ENTITIES.has(entityName)) return list;
  if (entityName === 'NotaFiscal' || entityName === 'NFe') {
    return list.filter((item) => clienteIdFromNfe(item) === firstText(portalClienteId));
  }
  return list.filter((item) => firstText(item.cliente_id) === firstText(portalClienteId));
};

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
  if (vinculoError) return { state: 'erro', cliente: null, title: 'Erro', message: vinculoError.message || 'Falha ao carregar o cliente.' };
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

export const assertPortalTituloDoCliente = ({ titulo = {}, clienteId } = {}) => {
  const scoped = firstText(clienteId);
  if (!scoped) throw new Error('Cliente do portal obrigatorio.');
  if (!titulo?.id) throw new Error('Titulo obrigatorio.');
  if (firstText(titulo.cliente_id) !== scoped) {
    throw new Error('Titulo nao pertence ao cliente do portal.');
  }
  return true;
};

export const assertPortalTituloWrite = ({ before = {}, patch = {}, portalClienteId } = {}) => {
  assertPortalTituloDoCliente({ titulo: before, clienteId: portalClienteId });
  if (Object.prototype.hasOwnProperty.call(patch, 'cliente_id')
    && firstText(patch.cliente_id)
    && firstText(patch.cliente_id) !== firstText(portalClienteId)) {
    throw new Error('Cliente do titulo nao pode ser alterado pelo portal.');
  }
  return true;
};

export const assertPortalNfeDoCliente = ({ nfe = {}, clienteId } = {}) => {
  const scoped = firstText(clienteId);
  if (!scoped) throw new Error('Cliente do portal obrigatorio.');
  if (!nfe?.id) throw new Error('Nota fiscal obrigatoria.');
  if (clienteIdFromNfe(nfe) !== scoped) {
    throw new Error('Nota fiscal nao pertence ao cliente do portal.');
  }
  return true;
};

export const isTituloAbertoPortal = (titulo = {}) => {
  const status = String(titulo.status || '').toLowerCase();
  return !status.includes('recebid')
    && !status.includes('liquid')
    && !status.includes('pago')
    && !status.includes('cancel');
};

export const isTituloVisivelPortal = (titulo = {}) => {
  if (titulo.visivel_no_portal === false) return false;
  if (titulo.visivel_no_portal === true) return true;
  return isTituloAbertoPortal(titulo);
};

export const filtrarTitulosPortal = (titulos = [], clienteId) => (
  (Array.isArray(titulos) ? titulos : []).filter((item) => (
    firstText(item.cliente_id) === firstText(clienteId) && isTituloVisivelPortal(item)
  ))
);

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
  }, { aberto: 0, atrasado: 0, quantidade: list.length });
};

export const portalFinanceKey = ({ tipo, tituloId, nonce = '' } = {}) => {
  const t = firstText(tipo);
  const id = firstText(tituloId);
  if (!t || !id) return '';
  return ['portal', t, id, firstText(nonce)].filter(Boolean).join('|');
};

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

export const buildLinhaDigitavelLocal = (titulo = {}) => {
  const base = `${onlyDigits(titulo.id)}${onlyDigits(titulo.valor || titulo.valor_total)}${onlyDigits(titulo.data_vencimento)}`.padEnd(47, '0');
  return base.slice(0, 47);
};

export const buildPixCopiaColaPortal = (titulo = {}, cliente = {}) => {
  const txid = firstText(titulo.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'PORTALTX';
  const valor = (Number(titulo.valor || titulo.valor_total || 0) || 0).toFixed(2);
  const nome = firstText(cliente.nome, cliente.razao_social, 'ERP ZUCCARO').slice(0, 25);
  // Payload operacional local ate o PSP real; mantem copia-cola estavel por titulo.
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

export const buildSegundaViaPortal = ({ titulo = {}, cliente = {} } = {}) => {
  assertPortalTituloDoCliente({ titulo, clienteId: cliente.id });
  if (!isTituloAbertoPortal(titulo)) {
    throw new Error('Titulo liquidado ou cancelado nao emite segunda via.');
  }
  const key = portalFinanceKey({
    tipo: 'segunda_via',
    tituloId: titulo.id,
    nonce: firstText(titulo.updated_date, titulo.data_vencimento, titulo.valor),
  });
  if (titulo.portal_segunda_via_key === key && (titulo.url_boleto_pdf || titulo.pix_copia_cola)) {
    return { reuse: true, record: titulo };
  }
  const pix = firstText(titulo.pix_copia_cola) || buildPixCopiaColaPortal(titulo, cliente);
  const linha = firstText(titulo.linha_digitavel) || buildLinhaDigitavelLocal(titulo);
  return {
    reuse: false,
    record: {
      ...titulo,
      visivel_no_portal: true,
      url_boleto_pdf: firstText(titulo.url_boleto_pdf) || `portal://boleto/${titulo.id}/2via.pdf`,
      linha_digitavel: linha,
      pix_copia_cola: pix,
      portal_segunda_via_em: new Date().toISOString(),
      portal_segunda_via_key: key,
      idempotency_key: key,
    },
  };
};

export const buildPortalDocumentoLinks = ({ nfe = {}, clienteId } = {}) => {
  assertPortalNfeDoCliente({ nfe, clienteId });
  return {
    xml: firstText(nfe.xml_url, nfe.xml_nfe) || null,
    danfe: firstText(nfe.danfe_url, nfe.pdf_url) || null,
    pode_baixar: Boolean(firstText(nfe.xml_url, nfe.xml_nfe, nfe.danfe_url, nfe.pdf_url)),
  };
};
