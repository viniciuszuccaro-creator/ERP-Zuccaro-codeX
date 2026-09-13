import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SITE_CPA_CUSTOMER_LINK_TYPE,
  SiteCpaCustomerError,
  buildCustomerAddresses,
  customerBelongsToScope,
  isValidCnpj,
  maskCnpj,
  resolveSiteCpaCustomer,
} from '../base44/functions/_lib/security/siteCpaCustomerResolve/entry.ts';
import {
  buildSiteCpaSignatureInput,
  handleSiteCpaGatewayRequest,
  hmacSha256Hex,
} from '../base44/functions/_lib/security/siteCpaS2SPolicy/entry.ts';

const scope = { groupId: 'grupo-cpa', empresaId: 'cpa-aco', scopeType: 'empresa' };
const request = { correlationId: 'corr-customer', operation: 'siteClienteResolve' };
const validCnpj = '11222333000181';

const customer = (overrides = {}) => ({
  id: 'cliente-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  cnpj: validCnpj,
  codigo: 'CLI-1',
  razao_social: 'Cliente Industrial Ltda',
  nome_fantasia: 'Cliente Industrial',
  status: 'Ativo',
  tipo: 'Pessoa Juridica',
  vendedor_responsavel_id: 'seller-1',
  condicao_comercial: { tabela_preco_id: 'tp-1' },
  endereco_principal: {
    id: 'end-principal',
    logradouro: 'Rua A',
    numero: '10',
    cidade: 'Sao Paulo',
    estado: 'SP',
    cep: '01001000',
  },
  locais_entrega: [
    { id: 'obra-1', tipo: 'Obra', nome: 'Obra Centro', cidade: 'Sao Paulo', ativo: true },
    { id: 'inativo', tipo: 'Entrega', cidade: 'Campinas', ativo: false },
  ],
  updated_date: '2026-09-13T12:00:00.000Z',
  ...overrides,
});

const approvedLink = (overrides = {}) => ({
  id: 'link-1',
  tipo_solicitacao: SITE_CPA_CUSTOMER_LINK_TYPE,
  entidade_alvo: 'Cliente',
  entidade_alvo_id: 'cliente-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  status: 'aprovado',
  dados_propostos: {
    source: 'SITE_CPA',
    externalUserId: 'site-user-1',
    erpCustomerId: 'cliente-1',
    role: 'COMPRADOR',
  },
  ...overrides,
});

const stores = ({ customers = [customer()], links = [approvedLink()], contacts = [], sellers = [{
  id: 'seller-1',
  group_id: 'grupo-cpa',
  empresa_id: 'cpa-aco',
  nome_completo: 'Vendedor CPA',
  status: 'Ativo',
}], failAudit = false } = {}) => {
  const audits = [];
  const createdLinks = [];
  const filterRows = (rows, filter) => rows.filter((row) => (
    Object.entries(filter).every(([key, value]) => row[key] === value)
  ));
  const base44 = {
    asServiceRole: {
      entities: {
        Cliente: {
          filter: async (filter) => filterRows(customers, filter),
        },
        SolicitacaoAprovacao: {
          filter: async (filter) => filterRows([...createdLinks, ...links], filter),
          create: async (record) => {
            const created = { id: `link-new-${createdLinks.length + 1}`, ...record };
            createdLinks.push(created);
            return created;
          },
        },
        Colaborador: {
          filter: async (filter) => filterRows(sellers, filter),
        },
        ContatoB2B: {
          filter: async (filter) => filterRows(contacts, filter),
        },
        AuditLog: {
          create: async (record) => {
            if (failAudit) throw new Error('audit offline');
            audits.push(record);
            return record;
          },
        },
      },
    },
  };
  return { base44, audits, createdLinks };
};

const resolve = (base44, data) => resolveSiteCpaCustomer({
  base44,
  scope,
  request,
  payload: { data },
});

const rejectsCode = async (promise, code, status) => {
  await assert.rejects(promise, (error) => (
    error instanceof SiteCpaCustomerError
    && error.code === code
    && error.status === status
  ));
};

test('normaliza e valida CNPJ com digitos verificadores', () => {
  assert.equal(isValidCnpj('11.222.333/0001-81'), true);
  assert.equal(isValidCnpj('11.222.333/0001-82'), false);
  assert.equal(isValidCnpj('11.111.111/1111-11'), false);
  assert.equal(maskCnpj(validCnpj), '11.***.***/0001-**');
});

test('cliente aprovado retorna somente contrato minimo, seller e enderecos ativos', async () => {
  const state = stores();
  const result = await resolve(state.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
    role: 'COMPRADOR',
    email: 'compras@cliente.test',
  });
  assert.equal(result.erpCustomerId, 'cliente-1');
  assert.equal(result.businessAccount.status, 'VERIFIED');
  assert.equal(result.seller.assignmentStatus, 'ASSIGNED');
  assert.deepEqual(result.addresses.map((item) => item.addressId), ['end-principal', 'obra-1']);
  assert.equal(result.addresses[0].isDefault, true);
  assert.equal(result.addresses[1].type, 'OBRA');
  assert.equal(result.capabilities.customerResolve, true);
  assert.equal(result.groupId, 'grupo-cpa');
  assert.equal(result.empresaId, 'cpa-aco');
  assert.equal(state.audits.at(-1).dados_novos.cnpj_masked, '11.***.***/0001-**');
  const collectKeys = (value, keys = []) => {
    if (!value || typeof value !== 'object') return keys;
    Object.entries(value).forEach(([key, nested]) => {
      keys.push(key.toLowerCase());
      collectKeys(nested, keys);
    });
    return keys;
  };
  const responseKeys = collectKeys(result);
  for (const forbidden of ['observacoes', 'dados_bancarios', 'limite_credito', 'token', 'secret', 'margem', 'custo']) {
    assert.equal(responseKeys.includes(forbidden), false);
  }
});

test('erpCustomerId exige ownership e vinculo aprovado do mesmo usuario externo', async () => {
  const state = stores();
  const result = await resolve(state.base44, {
    erpCustomerId: 'cliente-1',
    externalUserId: 'site-user-1',
  });
  assert.equal(result.erpCustomerId, 'cliente-1');

  await rejectsCode(resolve(stores({
    customers: [customer({ group_id: 'outro-grupo' })],
  }).base44, {
    erpCustomerId: 'cliente-1',
    externalUserId: 'site-user-1',
  }), 'site_cpa_customer_forbidden', 403);
});

test('cliente nao encontrado, inativo e duplicado falham com erros estaveis', async () => {
  await rejectsCode(resolve(stores({ customers: [], links: [] }).base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
  }), 'site_cpa_customer_not_found', 404);

  await rejectsCode(resolve(stores({
    customers: [customer({ status: 'Inativo' })],
    links: [],
  }).base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
  }), 'site_cpa_customer_inactive', 423);

  await rejectsCode(resolve(stores({
    customers: [customer(), customer({ id: 'cliente-2' })],
    links: [],
  }).base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
  }), 'site_cpa_customer_ambiguous', 409);
});

test('CNPJ invalido, papel invalido e endereco novo sao bloqueados', async () => {
  const state = stores();
  await rejectsCode(resolve(state.base44, {
    cnpj: '11.222.333/0001-82',
    externalUserId: 'site-user-1',
  }), 'site_cpa_customer_invalid_document', 400);
  await rejectsCode(resolve(state.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
    role: 'SUPERADMIN',
  }), 'site_cpa_business_role_invalid', 400);
  await rejectsCode(resolve(state.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
    address: { cidade: 'Outra' },
  }), 'site_cpa_address_policy_pending', 409);
});

test('email nao vincula conta e solicitacao pendente e idempotente por usuario e cliente', async () => {
  const state = stores({
    links: [],
    contacts: [{
      id: 'contact-1',
      cliente_id: 'cliente-1',
      group_id: 'grupo-cpa',
      empresa_id: 'cpa-aco',
      email: 'admin@cliente.test',
      ativo: true,
    }],
  });
  await rejectsCode(resolve(state.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-new',
    email: 'admin@cliente.test',
    role: 'ADMIN_EMPRESA',
  }), 'site_cpa_business_link_pending', 202);
  assert.equal(state.createdLinks.length, 1);
  assert.equal(state.createdLinks[0].status, 'pendente');
  assert.equal(state.createdLinks[0].dados_propostos.role, 'ADMIN_EMPRESA');
  assert.equal(state.createdLinks[0].dados_propostos.contato_b2b_id, 'contact-1');

  await rejectsCode(resolve(state.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-new',
    email: 'admin@cliente.test',
    role: 'ADMIN_EMPRESA',
  }), 'site_cpa_business_link_pending', 202);
  assert.equal(state.createdLinks.length, 1);
});

test('email ou telefone isolados nunca resolvem nem vinculam Cliente', async () => {
  const state = stores({ links: [] });
  await rejectsCode(resolve(state.base44, {
    externalUserId: 'site-user-email',
    email: 'admin@cliente.test',
    telefone: '11999999999',
  }), 'site_cpa_customer_identifier_required', 400);
  assert.equal(state.createdLinks.length, 0);
});

test('mesmo CNPJ em outra empresa nao mistura escopo e cliente compartilhado respeita allowlist', async () => {
  const otherCompany = customer({ id: 'cliente-3z', empresa_id: '3z' });
  const state = stores({ customers: [customer(), otherCompany] });
  const result = await resolve(state.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
  });
  assert.equal(result.erpCustomerId, 'cliente-1');
  assert.equal(customerBelongsToScope(customer({
    empresa_id: null,
    empresas_autorizadas_ids: ['cpa-aco'],
  }), scope), true);
  assert.equal(customerBelongsToScope(customer({
    empresa_id: null,
    empresas_autorizadas_ids: ['3z'],
  }), scope), false);
});

test('seller ausente ou inativo nao e inventado e auditoria indisponivel falha fechado', async () => {
  const withoutSeller = stores({ sellers: [] });
  const result = await resolve(withoutSeller.base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
  });
  assert.deepEqual(result.seller, {
    sellerId: null,
    sellerName: null,
    assignmentStatus: 'UNASSIGNED',
  });

  await rejectsCode(resolve(stores({ failAudit: true }).base44, {
    cnpj: validCnpj,
    externalUserId: 'site-user-1',
  }), 'site_cpa_audit_unavailable', 503);
});

test('endereco incorporado pertence ao Cliente e primeiro local nao vira padrao implicitamente', () => {
  const addresses = buildCustomerAddresses(customer({
    endereco_principal: null,
    locais_entrega: [{ id: 'ent-1', tipo: 'Entrega', cidade: 'Santos' }],
  }));
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].isDefault, false);
});

test('siteClienteResolve atravessa autenticacao, escopo, ledger e handler do gateway', async () => {
  const state = stores();
  const eventRows = [];
  Object.assign(state.base44.asServiceRole.entities, {
    Empresa: { filter: async () => [{ id: 'cpa-aco', group_id: 'grupo-cpa' }] },
    IntegracaoEvento: {
      filter: async () => [],
      create: async (record) => {
        const created = { id: 'event-customer', created_date: '2026-09-13T12:00:00.000Z', ...record };
        eventRows.push(created);
        return created;
      },
      update: async (id, patch) => {
        const event = eventRows.find((item) => item.id === id);
        Object.assign(event, patch);
        return event;
      },
    },
  });
  const body = {
    version: '1',
    operation: 'siteClienteResolve',
    data: {
      cnpj: validCnpj,
      externalUserId: 'site-user-1',
    },
  };
  const rawBody = JSON.stringify(body);
  const timestamp = '2026-09-13T12:00:00.000Z';
  const nonce = 'nonce-resolve-1234567890';
  const signature = await hmacSha256Hex('hmac-secret', buildSiteCpaSignatureInput({
    timestamp,
    nonce,
    rawBody,
  }));
  const response = await handleSiteCpaGatewayRequest({
    req: {
      headers: new Headers({
        authorization: 'Bearer service-token',
        'content-type': 'application/json',
        'x-origin': 'SITE_CPA',
        'x-correlation-id': 'corr-customer-gateway',
        'x-site-cpa-timestamp': timestamp,
        'x-site-cpa-nonce': nonce,
        'x-site-cpa-signature': signature,
        'idempotency-key': 'idem-customer-gateway',
      }),
    },
    base44: state.base44,
    payload: body,
    rawBody,
    env: (name) => ({
      SITE_CPA_SERVICE_TOKEN: 'service-token',
      SITE_CPA_HMAC_SECRET: 'hmac-secret',
      SITE_CPA_GROUP_ID: 'grupo-cpa',
      SITE_CPA_DEFAULT_EMPRESA_ID: 'cpa-aco',
      SITE_CPA_ALLOWED_EMPRESA_IDS: 'cpa-aco,3z',
    })[name] || '',
    now: Date.parse(timestamp),
  });
  const responseBody = await response.json();
  assert.equal(response.status, 200);
  assert.equal(responseBody.ok, true);
  assert.equal(responseBody.data.erpCustomerId, 'cliente-1');
  assert.equal(eventRows[0].status, 'concluido');
});
