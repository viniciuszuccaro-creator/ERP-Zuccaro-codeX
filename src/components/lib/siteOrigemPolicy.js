const firstText = (...values) => values.map((value) => String(value || '').trim()).find(Boolean) || '';

export const SITE_ORIGEM = 'site';

export const isSiteOrigemValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'site'
    || normalized === 'e-commerce'
    || normalized === 'ecommerce'
    || normalized === 'site base44';
};

export const stampSiteOrigem = (record = {}) => ({
  ...record,
  origem: SITE_ORIGEM,
  origem_pedido: SITE_ORIGEM,
  canal_origem: SITE_ORIGEM,
  origem_canal: SITE_ORIGEM,
});

export const assertSiteCheckout = ({ empresaId, itens = [] } = {}) => {
  if (!firstText(empresaId)) {
    throw new Error('Empresa obrigatoria para operacao do site.');
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error('Carrinho vazio.');
  }
  return true;
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const matchClienteSite = ({ clientes = [], email, documento } = {}) => {
  const mail = firstText(email).toLowerCase();
  const doc = digitsOnly(documento);
  if (!mail && !doc) return null;
  return (clientes || []).find((cliente) => {
    const clienteMail = firstText(cliente.email, cliente.email_principal, cliente.email_nfe).toLowerCase();
    const clienteDoc = digitsOnly(cliente.cpf_cnpj || cliente.cnpj || cliente.cpf || cliente.documento);
    return (mail && clienteMail && clienteMail === mail) || (doc && clienteDoc && clienteDoc === doc);
  }) || null;
};

export const buildSiteLeadPayload = ({
  nome,
  email,
  telefone,
  documento,
  valor = 0,
  pedidoId,
  orcamentoId,
  clienteId,
} = {}) => stampSiteOrigem({
  titulo: `Lead site ${firstText(nome, email, pedidoId, orcamentoId, 'visitante')}`,
  descricao: 'Lead gerado pelo site proprio existente.',
  cliente_id: clienteId || undefined,
  cliente_nome: firstText(nome, 'Visitante'),
  cliente_email: firstText(email) || undefined,
  cliente_telefone: firstText(telefone) || undefined,
  cliente_cpf_cnpj: firstText(documento) || undefined,
  valor_estimado: Number(valor) || 0,
  etapa: 'Prospecção',
  probabilidade: 30,
  data_abertura: new Date().toISOString().slice(0, 10),
  status: 'Aberto',
  pedido_id: pedidoId || undefined,
  orcamento_site_id: orcamentoId || undefined,
});

export const applySiteOrigemOnCreate = (entityName, record = {}) => {
  const fromEntity = entityName === 'OrcamentoSite';
  const fromField = isSiteOrigemValue(record.origem)
    || isSiteOrigemValue(record.origem_pedido)
    || isSiteOrigemValue(record.canal_origem)
    || isSiteOrigemValue(record.origem_canal);
  if (!fromEntity && !fromField) return record;
  return stampSiteOrigem(record);
};
