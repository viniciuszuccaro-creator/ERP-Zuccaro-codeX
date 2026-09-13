export const SITE_CPA_CUSTOMER_RESOLVE_OPERATION = 'siteClienteResolve';
export const SITE_CPA_CUSTOMER_LINK_TYPE = 'vinculo_site_cpa_cliente';

const ALLOWED_SITE_ROLES = new Set(['ADMIN_EMPRESA', 'COMPRADOR', 'FINANCEIRO', 'CONSULTA']);
const BLOCKED_CUSTOMER_STATUS = ['inativ', 'bloque', 'restrit', 'cancel'];

const text = (value) => String(value ?? '').trim();
const digitsOnly = (value) => text(value).replace(/\D/g, '');
const normalizeStatus = (value) => text(value || 'Ativo').toLowerCase();

export class SiteCpaCustomerError extends Error {
  constructor(status, code, message = code, details = null) {
    super(message);
    this.name = 'SiteCpaCustomerError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const normalizeCnpj = (value) => digitsOnly(value);

export const isValidCnpj = (value) => {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculateDigit = (part, weights) => {
    const total = part.split('').reduce(
      (sum, current, index) => sum + Number(current) * weights[index],
      0,
    );
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12])
    && calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
};

export const maskCnpj = (value) => {
  const cnpj = normalizeCnpj(value);
  return cnpj.length === 14 ? `${cnpj.slice(0, 2)}.***.***/${cnpj.slice(8, 12)}-**` : null;
};

const customerCnpj = (customer) => normalizeCnpj(
  customer?.cnpj || customer?.cpf_cnpj || customer?.documento,
);

const customerGroupId = (customer) => text(customer?.group_id || customer?.grupo_id);
const customerEmpresaId = (customer) => text(customer?.empresa_id || customer?.empresa_dona_id);

const customerAllowedEmpresaIds = (customer) => [
  customer?.empresa_ids,
  customer?.empresas_ids,
  customer?.empresas_autorizadas,
  customer?.empresas_autorizadas_ids,
  customer?.empresas_compartilhadas_ids,
].flatMap((value) => (Array.isArray(value) ? value : [])).map(text).filter(Boolean);

export const customerBelongsToScope = (customer, scope) => {
  if (!customer || customerGroupId(customer) !== text(scope?.groupId)) return false;
  const ownerEmpresaId = customerEmpresaId(customer);
  if (ownerEmpresaId) return ownerEmpresaId === text(scope?.empresaId);
  const allowlist = customerAllowedEmpresaIds(customer);
  return allowlist.length === 0 || allowlist.includes(text(scope?.empresaId));
};

export const customerAccountStatus = (customer) => {
  const status = normalizeStatus(customer?.status || customer?.situacao);
  if (status.includes('inativ') || customer?.ativo === false) return 'INACTIVE';
  if (BLOCKED_CUSTOMER_STATUS.some((item) => status.includes(item))) return 'BLOCKED';
  return 'VERIFIED';
};

const normalizeRole = (value) => {
  const role = text(value).toUpperCase();
  if (!role) return '';
  if (!ALLOWED_SITE_ROLES.has(role)) {
    throw new SiteCpaCustomerError(400, 'site_cpa_business_role_invalid');
  }
  return role;
};

const normalizeExternalUserId = (data) => text(data?.externalUserId || data?.siteUserId);

const assertExternalUserId = (value) => {
  const externalUserId = text(value);
  if (!externalUserId || externalUserId.length > 160 || !/^[A-Za-z0-9._:@/-]+$/.test(externalUserId)) {
    throw new SiteCpaCustomerError(400, 'site_cpa_external_user_required');
  }
  return externalUserId;
};

const normalizeAddressType = (address, fallback = 'OUTRO') => {
  const value = text(address?.tipo || address?.type || fallback)
    .normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  if (value.includes('FATUR')) return 'FATURAMENTO';
  if (value.includes('COBR')) return 'COBRANCA';
  if (value.includes('OBRA')) return 'OBRA';
  if (value.includes('ENTREG')) return 'ENTREGA';
  return 'OUTRO';
};

const safeAddress = (address, { fallbackType = 'OUTRO', isDefault = false, index = 0 } = {}) => {
  if (!address || typeof address !== 'object') return null;
  if (address.ativo === false || normalizeStatus(address.status).includes('inativ')) return null;
  const id = text(address.id || address.endereco_id || address.codigo) || `embedded-${index}`;
  return {
    addressId: id,
    type: normalizeAddressType(address, fallbackType),
    isDefault: Boolean(isDefault || address.padrao || address.principal || address.padrao_entrega),
    label: text(address.nome || address.apelido || address.descricao) || null,
    cep: text(address.cep) || null,
    logradouro: text(address.logradouro || address.endereco) || null,
    numero: text(address.numero) || null,
    complemento: text(address.complemento) || null,
    bairro: text(address.bairro) || null,
    cidade: text(address.cidade) || null,
    estado: text(address.estado || address.uf).toUpperCase() || null,
  };
};

export const buildCustomerAddresses = (customer) => {
  const addresses = [];
  const principal = safeAddress(customer?.endereco_principal, {
    fallbackType: 'FATURAMENTO',
    isDefault: true,
    index: 0,
  });
  if (principal) addresses.push(principal);
  (Array.isArray(customer?.locais_entrega) ? customer.locais_entrega : []).forEach((address, index) => {
    const normalized = safeAddress(address, {
      fallbackType: address?.obra === true ? 'OBRA' : 'ENTREGA',
      isDefault: false,
      index: index + 1,
    });
    if (normalized) addresses.push(normalized);
  });
  return addresses;
};

const linkMatches = (link, { customerId, externalUserId }) => (
  text(link?.entidade_alvo_id) === text(customerId)
  && normalizeExternalUserId(link?.dados_propostos) === text(externalUserId)
  && text(link?.dados_propostos?.source).toUpperCase() === 'SITE_CPA'
);

const loadCustomerLinks = async (base44, scope) => {
  const links = await base44.asServiceRole.entities.SolicitacaoAprovacao.filter({
    tipo_solicitacao: SITE_CPA_CUSTOMER_LINK_TYPE,
    group_id: scope.groupId,
    empresa_id: scope.empresaId,
  }, '-created_date', 100);
  return Array.isArray(links) ? links : [];
};

const resolveCustomerByCnpj = async (base44, scope, cnpj) => {
  const store = base44.asServiceRole.entities.Cliente;
  const queries = await Promise.all([
    store.filter({ group_id: scope.groupId, cnpj }, '-updated_date', 20),
    store.filter({ group_id: scope.groupId, cpf_cnpj: cnpj }, '-updated_date', 20),
    store.filter({ group_id: scope.groupId, documento: cnpj }, '-updated_date', 20),
  ]);
  const unique = new Map();
  queries.flat().forEach((customer) => {
    if (customer?.id && customerCnpj(customer) === cnpj && customerBelongsToScope(customer, scope)) {
      unique.set(String(customer.id), customer);
    }
  });
  return [...unique.values()];
};

const resolveCustomerById = async (base44, scope, customerId) => {
  const records = await base44.asServiceRole.entities.Cliente.filter({
    id: customerId,
    group_id: scope.groupId,
  }, '-updated_date', 2);
  const customer = (Array.isArray(records) ? records : [])
    .find((item) => customerBelongsToScope(item, scope));
  if (!customer) {
    throw new SiteCpaCustomerError(403, 'site_cpa_customer_forbidden');
  }
  return customer;
};

export const resolveApprovedSiteCustomerContext = async ({
  base44,
  scope,
  erpCustomerId,
  externalUserId,
} = {}) => {
  const customerId = text(erpCustomerId);
  const siteUserId = assertExternalUserId(externalUserId);
  if (!customerId) throw new SiteCpaCustomerError(400, 'site_cpa_customer_context_invalid');
  const customer = await resolveCustomerById(base44, scope, customerId);
  if (customerAccountStatus(customer) !== 'VERIFIED') {
    throw new SiteCpaCustomerError(403, 'site_cpa_customer_context_invalid');
  }
  const links = await loadCustomerLinks(base44, scope);
  const approvedLink = links.find((link) => (
    linkMatches(link, { customerId, externalUserId: siteUserId })
    && text(link.status).toLowerCase() === 'aprovado'
  ));
  if (!approvedLink) throw new SiteCpaCustomerError(403, 'site_cpa_customer_context_invalid');
  return {
    customer,
    link: approvedLink,
    role: normalizeRole(approvedLink?.dados_propostos?.role) || 'CONSULTA',
  };
};

const auditResolution = async ({ base44, scope, request, customer = null, outcome, success }) => {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      usuario: 'SITE_CPA',
      acao: success ? 'Consulta' : 'Bloqueio',
      modulo: 'Integracoes',
      tipo_auditoria: success ? 'integracao' : 'seguranca',
      entidade: 'Cliente',
      registro_id: customer?.id || null,
      descricao: `siteClienteResolve ${outcome}`,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      dados_novos: {
        operation: SITE_CPA_CUSTOMER_RESOLVE_OPERATION,
        correlation_id: request?.correlationId || null,
        customer_id: customer?.id || null,
        cnpj_masked: maskCnpj(customerCnpj(customer)),
        outcome,
      },
      data_hora: new Date().toISOString(),
      sucesso: success === true,
    });
  } catch {
    throw new SiteCpaCustomerError(503, 'site_cpa_audit_unavailable');
  }
};

const createPendingLink = async ({
  base44,
  scope,
  request,
  customer,
  externalUserId,
  requestedRole,
  email,
  contactId,
}) => {
  let record;
  try {
    record = await base44.asServiceRole.entities.SolicitacaoAprovacao.create({
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      solicitante_id: 'SITE_CPA',
      solicitante_nome: 'Site CPA',
      tipo_solicitacao: SITE_CPA_CUSTOMER_LINK_TYPE,
      entidade_alvo: 'Cliente',
      entidade_alvo_id: customer.id,
      dados_propostos: {
        source: 'SITE_CPA',
        externalUserId,
        erpCustomerId: customer.id,
        role: requestedRole || 'CONSULTA',
        contato_b2b_id: contactId || null,
        email_masked: email ? `${email.slice(0, 2)}***@${email.split('@')[1] || '***'}` : null,
      },
      justificativa: 'Vinculo empresarial solicitado pelo Site CPA; requer aprovacao humana no ERP.',
      perfil_aprovador_necessario: 'Comercial.Aprovacoes.aprovar',
      status: 'pendente',
      idempotency_key: `SITE_CPA|${scope.groupId}|${scope.empresaId}|${externalUserId}|${customer.id}`,
      data_solicitacao: new Date().toISOString(),
    });
  } catch {
    throw new SiteCpaCustomerError(503, 'site_cpa_business_link_write_unavailable');
  }
  await auditResolution({
    base44,
    scope,
    request,
    customer,
    outcome: 'business_link_pending',
    success: false,
  });
  return record;
};

const resolveContactReference = async (base44, scope, customer, email) => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  let contacts;
  try {
    contacts = await base44.asServiceRole.entities.ContatoB2B.filter({
      cliente_id: customer.id,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      email,
    }, '-updated_date', 2);
  } catch {
    throw new SiteCpaCustomerError(503, 'site_cpa_business_contact_lookup_unavailable');
  }
  const active = (Array.isArray(contacts) ? contacts : []).filter((contact) => (
    text(contact?.cliente_id) === text(customer.id)
    && customerBelongsToScope(contact, scope)
    && contact?.ativo !== false
    && !normalizeStatus(contact?.status).includes('inativ')
  ));
  return active.length === 1 ? active[0].id : null;
};

const resolveApprovedContact = async (base44, scope, customer, approvedLink) => {
  const contactId = text(approvedLink?.dados_propostos?.contato_b2b_id);
  if (!contactId) return null;
  try {
    const contacts = await base44.asServiceRole.entities.ContatoB2B.filter({
      id: contactId,
      cliente_id: customer.id,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
    }, undefined, 1);
    const contact = (Array.isArray(contacts) ? contacts : [])[0] || null;
    if (!contact || !customerBelongsToScope(contact, scope) || contact?.ativo === false) return null;
    return {
      contactId: contact.id,
      contactName: text(contact.nome_contato || contact.nome) || null,
      department: text(contact.departamento) || null,
    };
  } catch {
    throw new SiteCpaCustomerError(503, 'site_cpa_business_contact_lookup_unavailable');
  }
};

export const resolveSiteCpaSeller = async (base44, scope, customer) => {
  const sellerId = text(customer?.vendedor_responsavel_id);
  if (!sellerId) return { sellerId: null, sellerName: null, assignmentStatus: 'UNASSIGNED' };
  let sellers;
  try {
    sellers = await base44.asServiceRole.entities.Colaborador.filter({
      id: sellerId,
      group_id: scope.groupId,
    }, undefined, 2);
  } catch {
    return { sellerId: null, sellerName: null, assignmentStatus: 'UNASSIGNED' };
  }
  const seller = (Array.isArray(sellers) ? sellers : []).find((item) => (
    customerBelongsToScope(item, scope)
    && !normalizeStatus(item?.status).includes('inativ')
    && item?.ativo !== false
  ));
  if (!seller) return { sellerId: null, sellerName: null, assignmentStatus: 'UNASSIGNED' };
  return {
    sellerId: seller.id,
    sellerName: text(seller.nome_completo || seller.nome) || null,
    assignmentStatus: 'ASSIGNED',
  };
};

export const resolveSiteCpaCustomer = async ({ base44, payload = {}, scope, request } = {}) => {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  if (data?.address || data?.newAddress || data?.endereco) {
    throw new SiteCpaCustomerError(
      409,
      'site_cpa_address_policy_pending',
      'BLOCKED_PENDING_ADDRESS_CREATE_POLICY',
      { state: 'BLOCKED_PENDING_ADDRESS_CREATE_POLICY' },
    );
  }

  const customerId = text(data?.erpCustomerId);
  const cnpj = normalizeCnpj(data?.cnpj);
  const externalUserId = assertExternalUserId(normalizeExternalUserId(data));
  const requestedRole = normalizeRole(data?.role || data?.requestedRole);
  const email = text(data?.email).toLowerCase();

  if (!customerId && !cnpj) {
    throw new SiteCpaCustomerError(400, 'site_cpa_customer_identifier_required');
  }
  if (cnpj && !isValidCnpj(cnpj)) {
    throw new SiteCpaCustomerError(400, 'site_cpa_customer_invalid_document');
  }
  let candidates;
  try {
    candidates = customerId
      ? [await resolveCustomerById(base44, scope, customerId)]
      : await resolveCustomerByCnpj(base44, scope, cnpj);
  } catch (error) {
    if (error instanceof SiteCpaCustomerError) {
      await auditResolution({ base44, scope, request, outcome: error.code, success: false });
      throw error;
    }
    throw new SiteCpaCustomerError(503, 'site_cpa_customer_lookup_unavailable');
  }

  const active = candidates.filter((customer) => customerAccountStatus(customer) === 'VERIFIED');
  if (active.length > 1) {
    await auditResolution({ base44, scope, request, outcome: 'customer_ambiguous', success: false });
    throw new SiteCpaCustomerError(409, 'site_cpa_customer_ambiguous');
  }
  const customer = active[0] || candidates[0] || null;
  if (!customer) {
    await auditResolution({ base44, scope, request, outcome: 'customer_not_found', success: false });
    throw new SiteCpaCustomerError(
      404,
      'site_cpa_customer_not_found',
      'BLOCKED_PENDING_CUSTOMER_CREATION_POLICY',
      { state: 'BLOCKED_PENDING_CUSTOMER_CREATION_POLICY' },
    );
  }

  const accountStatus = customerAccountStatus(customer);
  if (accountStatus !== 'VERIFIED') {
    await auditResolution({ base44, scope, request, customer, outcome: accountStatus.toLowerCase(), success: false });
    throw new SiteCpaCustomerError(
      423,
      accountStatus === 'INACTIVE' ? 'site_cpa_customer_inactive' : 'site_cpa_customer_blocked',
      accountStatus,
      { state: accountStatus },
    );
  }
  if (cnpj && customerCnpj(customer) !== cnpj) {
    await auditResolution({ base44, scope, request, customer, outcome: 'customer_forbidden', success: false });
    throw new SiteCpaCustomerError(403, 'site_cpa_customer_forbidden');
  }

  let links;
  try {
    links = await loadCustomerLinks(base44, scope);
  } catch {
    throw new SiteCpaCustomerError(503, 'site_cpa_business_link_lookup_unavailable');
  }
  const matchingLinks = links.filter((link) => linkMatches(link, {
    customerId: customer.id,
    externalUserId,
  }));
  const approvedLink = matchingLinks.find((link) => text(link.status).toLowerCase() === 'aprovado');
  const pendingLink = matchingLinks.find((link) => text(link.status).toLowerCase() === 'pendente');
  const rejectedLink = matchingLinks.find((link) => text(link.status).toLowerCase() === 'rejeitado');

  if (!approvedLink) {
    if (rejectedLink && !pendingLink) {
      await auditResolution({ base44, scope, request, customer, outcome: 'business_link_rejected', success: false });
      throw new SiteCpaCustomerError(403, 'site_cpa_business_link_rejected');
    }
    const contactId = pendingLink ? null : await resolveContactReference(base44, scope, customer, email);
    const link = pendingLink || await createPendingLink({
      base44,
      scope,
      request,
      customer,
      externalUserId,
      requestedRole,
      email,
      contactId,
    });
    if (pendingLink) {
      await auditResolution({ base44, scope, request, customer, outcome: 'business_link_pending', success: false });
    }
    throw new SiteCpaCustomerError(
      202,
      'site_cpa_business_link_pending',
      'PENDING_VERIFICATION',
      { state: 'PENDING_VERIFICATION', requestId: link.id },
    );
  }

  const approvedRole = normalizeRole(approvedLink?.dados_propostos?.role) || 'CONSULTA';
  if (requestedRole && requestedRole !== approvedRole) {
    await auditResolution({ base44, scope, request, customer, outcome: 'business_role_forbidden', success: false });
    throw new SiteCpaCustomerError(403, 'site_cpa_business_role_forbidden');
  }

  const seller = await resolveSiteCpaSeller(base44, scope, customer);
  const approvedContact = await resolveApprovedContact(base44, scope, customer, approvedLink);
  const addresses = buildCustomerAddresses(customer);
  const commercial = customer?.condicao_comercial || {};
  const response = {
    erpCustomerId: customer.id,
    customerCode: text(customer.codigo || customer.codigo_cliente) || null,
    cnpjMasked: maskCnpj(customerCnpj(customer)),
    razaoSocial: text(customer.razao_social || customer.nome) || null,
    nomeFantasia: text(customer.nome_fantasia || customer.nome) || null,
    status: text(customer.status || customer.situacao || 'Ativo'),
    customerType: text(customer.tipo || customer.tipo_pessoa || 'Pessoa Juridica'),
    seller,
    businessAccount: {
      erpCustomerId: customer.id,
      cnpjMasked: maskCnpj(customerCnpj(customer)),
      razaoSocial: text(customer.razao_social || customer.nome) || null,
      nomeFantasia: text(customer.nome_fantasia || customer.nome) || null,
      status: 'VERIFIED',
      verified: true,
      currentUser: {
        externalUserId,
        role: approvedRole,
        status: 'VERIFIED',
        ...(approvedContact || {}),
      },
    },
    addresses,
    capabilities: {
      customerResolve: true,
      customerUsers: false,
      customerWorks: false,
      customerCommercialCondition: false,
      addressCreate: false,
      hasCommercialCondition: Boolean(Object.keys(commercial).length),
      hasPriceTable: Boolean(text(commercial?.tabela_preco_id)),
      creditValidationRequired: true,
      sellerAssigned: seller.assignmentStatus === 'ASSIGNED',
    },
    groupId: scope.groupId,
    empresaId: scope.empresaId,
    source: 'ERP',
    updatedAt: customer.updated_date || customer.updatedAt || null,
  };

  await auditResolution({
    base44,
    scope,
    request,
    customer,
    outcome: 'customer_resolved',
    success: true,
  });
  return response;
};
