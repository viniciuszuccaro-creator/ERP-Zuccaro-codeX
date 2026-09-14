import { paymentCapability } from '../siteCpaPayment/provider.ts';
import { portalCapabilities } from '../siteCpaPortal/entry.ts';
import { deliveryCapability } from '../siteCpaDelivery/entry.ts';
import { chatCapability } from '../siteCpaChat/entry.ts';
import { armationCapabilities } from '../siteCpaArmacao/entry.ts';
import { workCapabilities } from '../siteCpaWork/entry.ts';
import { opportunityCapabilities } from '../siteCpaOpportunity/entry.ts';

const STATE_ORDER = Object.freeze({ ready: 0, degraded: 1, blocked: 2, not_verified: 1, not_required: 0 });

const worstState = (states) => states.reduce((worst, state) => (
  (STATE_ORDER[state] ?? 2) > (STATE_ORDER[worst] ?? 2) ? state : worst
), 'ready');

const probeEntity = async (base44, scope, name, methods = ['filter']) => {
  const entity = base44?.asServiceRole?.entities?.[name];
  if (!entity || methods.some((method) => typeof entity[method] !== 'function')) return false;
  try {
    if (methods.includes('filter')) {
      await entity.filter({ group_id: scope.groupId, empresa_id: scope.empresaId }, '-updated_date', 1);
    }
    return true;
  } catch { return false; }
};

export const coreSiteCapabilities = async ({ base44, scope } = {}) => {
  const [customer, link, product, catalog, category, unit, paymentTerm, order, audit, opportunity] = await Promise.all([
    probeEntity(base44, scope, 'Cliente'),
    probeEntity(base44, scope, 'SolicitacaoAprovacao'),
    probeEntity(base44, scope, 'Produto'),
    probeEntity(base44, scope, 'CatalogoWeb'),
    probeEntity(base44, scope, 'GrupoProduto'),
    probeEntity(base44, scope, 'UnidadeMedida'),
    probeEntity(base44, scope, 'FormaPagamento'),
    probeEntity(base44, scope, 'Pedido', ['filter', 'create', 'update']),
    probeEntity(base44, scope, 'AuditLog', ['create']),
    probeEntity(base44, scope, 'Oportunidade', ['filter', 'create']),
  ]);
  const customerReady = customer && link && audit;
  const catalogReady = product && catalog && category && unit && audit;
  const orderReady = customerReady && catalogReady && paymentTerm && order;
  const quoteReady = customerReady && catalogReady && order && opportunity;
  return {
    CUSTOMER_RESOLVE: customerReady ? 'ready' : 'blocked',
    CATALOG_READ: catalogReady ? 'ready' : 'blocked',
    ORDER_CREATE: orderReady ? 'ready' : 'blocked',
    QUOTE_CREATE: quoteReady ? 'ready' : 'blocked',
    NEGOTIATION: quoteReady ? 'ready' : 'blocked',
  };
};

export const buildSiteCpaHealth = async ({ base44, scope, env, now, contractVersion, origin } = {}) => {
  const [core, payment, portal, delivery, chat, armation, work, opportunity] = await Promise.all([
    coreSiteCapabilities({ base44, scope }), paymentCapability({ base44, scope, env }),
    portalCapabilities({ base44, scope }), deliveryCapability({ base44, scope }),
    chatCapability({ base44, scope }), armationCapabilities({ base44, scope }),
    workCapabilities({ base44, scope }), opportunityCapabilities({ base44, scope }),
  ]);
  const aggregateWork = worstState([armation.WORK, work.WORK]);
  const capabilities = {
    ...core, PAYMENT: payment, ...portal, DELIVERY: delivery, CHAT: chat,
    ...armation, ...work, WORK: aggregateWork, ...opportunity,
  };
  const critical = [
    capabilities.CUSTOMER_RESOLVE, capabilities.CATALOG_READ, capabilities.ORDER_CREATE,
    capabilities.QUOTE_CREATE, capabilities.NEGOTIATION, capabilities.OPPORTUNITY_READ,
  ];
  const readiness = critical.includes('blocked') ? 'blocked'
    : Object.values(capabilities).every((state) => state === 'ready') ? 'ready' : 'degraded';
  return {
    status: readiness,
    contractVersion,
    origin,
    timestamp: new Date(now).toISOString(),
    scope: { groupId: scope.groupId, empresaId: scope.empresaId, scopeType: scope.scopeType },
    capabilities,
    dependencies: {
      ERP_RUNTIME: 'ready',
      PAYMENT_PROVIDER: payment,
      PRIVATE_STORAGE: portal.PORTAL_DOCUMENT,
      AI_PROVIDER: opportunity.COMMERCIAL_COPILOT === 'degraded' ? 'not_verified' : opportunity.COMMERCIAL_COPILOT,
      MALWARE_SCANNER: armation.PRODUCTION_INTAKE === 'ready' ? 'ready' : 'not_verified',
      DWG_CONVERTER: 'not_verified',
      OUTBOUND_MESSAGING: 'not_required',
    },
  };
};
