import {
  SITE_CPA_CUSTOMER_RESOLVE_OPERATION,
  SiteCpaCustomerError,
  resolveSiteCpaCustomer,
} from '../siteCpaCustomerResolve/entry.ts';
import {
  SITE_CPA_CATALOG_LIST_OPERATION,
  SiteCpaCatalogError,
  resolveSiteCpaCatalog,
} from '../siteCpaCatalogRead/entry.ts';
import {
  SITE_CPA_ORDER_CREATE_OPERATION,
  SiteCpaOrderError,
  resolveSiteCpaOrderCreate,
} from '../siteCpaOrderCreate/entry.ts';
import {
  SITE_CPA_NEGOTIATION_GET_OPERATION,
  SITE_CPA_NEGOTIATION_RESPOND_OPERATION,
  SITE_CPA_QUOTE_CREATE_OPERATION,
  SITE_CPA_QUOTE_GET_OPERATION,
  SiteCpaQuoteError,
  resolveSiteCpaQuoteOperation,
} from '../siteCpaQuoteNegotiation/entry.ts';
import {
  SITE_CPA_PAYMENT_CANCEL_OPERATION,
  SITE_CPA_PAYMENT_CREATE_OPERATION,
  SITE_CPA_PAYMENT_STATUS_OPERATION,
  SiteCpaPaymentError,
  resolveSiteCpaPaymentOperation,
} from '../siteCpaPayment/entry.ts';
import {
  SITE_CPA_PORTAL_OPERATIONS,
  SiteCpaPortalError,
  resolveSiteCpaPortalOperation,
} from '../siteCpaPortal/entry.ts';

const rejected = (buildResponse, request, failure) => ({
  handled: true,
  status: failure.status,
  body: buildResponse({
    ok: false,
    request,
    code: failure.code,
    message: failure.message,
    details: failure.details,
  }),
  eventStatus: 'rejeitado',
  errorCode: failure.code,
});

const completed = (buildResponse, request, data, status = 200) => ({
  handled: true,
  status,
  body: buildResponse({ ok: true, request, data }),
  eventStatus: 'concluido',
});

export const routeSiteCpaOperation = async ({
  base44,
  payload,
  scope,
  request,
  env,
  now,
  buildResponse,
} = {}) => {
  if ([
    SITE_CPA_PAYMENT_CREATE_OPERATION,
    SITE_CPA_PAYMENT_STATUS_OPERATION,
    SITE_CPA_PAYMENT_CANCEL_OPERATION,
  ].includes(request.operation)) {
    try {
      const data = await resolveSiteCpaPaymentOperation({ base44, payload, scope, request, env, now });
      const status = request.operation === SITE_CPA_PAYMENT_CREATE_OPERATION
        ? (data.status === 'PROCESSING' ? 202 : 201) : 200;
      return completed(buildResponse, request, data, status);
    } catch (error) {
      return rejected(buildResponse, request, error instanceof SiteCpaPaymentError
        ? error : new SiteCpaPaymentError(503, 'site_cpa_payment_unavailable'));
    }
  }

  if (SITE_CPA_PORTAL_OPERATIONS.has(request.operation)) {
    try {
      const data = await resolveSiteCpaPortalOperation({ base44, payload, scope, request, now });
      return completed(buildResponse, request, data);
    } catch (error) {
      return rejected(buildResponse, request, error instanceof SiteCpaPortalError
        ? error : new SiteCpaPortalError(503, 'site_cpa_portal_unavailable'));
    }
  }

  if (request.operation === SITE_CPA_CUSTOMER_RESOLVE_OPERATION) {
    try {
      return completed(buildResponse, request, await resolveSiteCpaCustomer({ base44, payload, scope, request }));
    } catch (error) {
      return rejected(buildResponse, request, error instanceof SiteCpaCustomerError
        ? error : new SiteCpaCustomerError(503, 'site_cpa_customer_resolve_unavailable'));
    }
  }

  if (request.operation === SITE_CPA_CATALOG_LIST_OPERATION) {
    try {
      return completed(buildResponse, request, await resolveSiteCpaCatalog({ base44, payload, scope, request, now }));
    } catch (error) {
      return rejected(buildResponse, request, error instanceof SiteCpaCatalogError
        ? error : new SiteCpaCatalogError(503, 'site_cpa_catalog_unavailable'));
    }
  }

  if (request.operation === SITE_CPA_ORDER_CREATE_OPERATION) {
    try {
      return completed(buildResponse, request, await resolveSiteCpaOrderCreate({
        base44, payload, scope, request, now,
      }), 201);
    } catch (error) {
      return rejected(buildResponse, request, error instanceof SiteCpaOrderError
        ? error : new SiteCpaOrderError(503, 'site_cpa_order_unavailable'));
    }
  }

  if ([
    SITE_CPA_QUOTE_CREATE_OPERATION,
    SITE_CPA_QUOTE_GET_OPERATION,
    SITE_CPA_NEGOTIATION_GET_OPERATION,
    SITE_CPA_NEGOTIATION_RESPOND_OPERATION,
  ].includes(request.operation)) {
    try {
      const data = await resolveSiteCpaQuoteOperation({ base44, payload, scope, request, now });
      return completed(buildResponse, request, data,
        request.operation === SITE_CPA_QUOTE_CREATE_OPERATION ? 201 : 200);
    } catch (error) {
      return rejected(buildResponse, request, error instanceof SiteCpaQuoteError
        ? error : new SiteCpaQuoteError(503, 'site_cpa_quote_unavailable'));
    }
  }

  return { handled: false };
};
