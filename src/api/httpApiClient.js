import { HTTP_PILOT_ENTITIES, resolveErpApiBaseUrl } from './runtimeBackend.js';

/**
 * Cliente HTTP compativel com a superficie parcial de base44.entities.*
 * UI → facade → HttpApiClient → BFF → PostgreSQL
 */

function createHttpError(status, body, requestId) {
  const message = body?.error?.message || `HTTP ${status}`;
  const error = new Error(message);
  error.name = 'HttpApiError';
  error.status = status;
  error.code = body?.error?.code || 'HTTP_ERROR';
  error.requestId = requestId || body?.error?.requestId;
  error.body = body;
  return error;
}

/**
 * @param {{
 *   baseUrl?: string,
 *   getScope?: () => { groupId?: string, empresaId?: string, actorId?: string, actorEmail?: string, token?: string },
 *   fetchImpl?: typeof fetch,
 * }} [options]
 */
export function createHttpApiClient(options = {}) {
  const resolvedBase = options.baseUrl !== undefined
    ? options.baseUrl
    : resolveErpApiBaseUrl();
  const baseUrl = String(resolvedBase || '').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl || fetch;
  const getScope = options.getScope || (() => ({}));

  async function request(path, { method = 'GET', body, query } = {}) {
    const scope = getScope() || {};
    const url = baseUrl
      ? new URL(`${baseUrl}${path}`)
      : new URL(path, 'http://same-origin.local');
    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value == null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (scope.groupId) headers['X-Group-Id'] = String(scope.groupId);
    if (scope.empresaId) headers['X-Empresa-Id'] = String(scope.empresaId);
    if (scope.actorId) headers['X-Actor-Id'] = String(scope.actorId);
    if (scope.actorEmail) headers['X-Actor-Email'] = String(scope.actorEmail);
    if (scope.token) headers.Authorization = `Bearer ${scope.token}`;

    const fetchUrl = baseUrl ? url.toString() : `${url.pathname}${url.search}`;
    const response = await fetchImpl(fetchUrl, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });

    const requestId = response.headers.get('x-request-id') || undefined;
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      throw createHttpError(response.status, payload, requestId);
    }
    return payload?.data !== undefined ? payload.data : payload;
  }

  function createMarcaEntity() {
    return {
      async list(orderBy, limit = 100) {
        void orderBy;
        return request('/api/v1/marcas', { query: { limit } });
      },
      async filter(query = {}, orderBy, limit = 100) {
        void orderBy;
        return request('/api/v1/marcas', {
          query: {
            limit,
            search: query.nome_marca || query.search,
            ativo: query.ativa ?? query.ativo,
          },
        });
      },
      async get(id) {
        return request(`/api/v1/marcas/${encodeURIComponent(id)}`);
      },
      async create(data) {
        return request('/api/v1/marcas', { method: 'POST', body: data });
      },
      async update(id, data) {
        return request(`/api/v1/marcas/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: data,
        });
      },
      async delete(id) {
        return request(`/api/v1/marcas/${encodeURIComponent(id)}`, { method: 'DELETE' });
      },
    };
  }

  const entities = {
    Marca: createMarcaEntity(),
  };

  for (const name of HTTP_PILOT_ENTITIES) {
    if (!entities[name]) {
      entities[name] = createMarcaEntity();
    }
  }

  return {
    entities,
    async health() {
      return request('/health');
    },
    async ready() {
      return request('/ready');
    },
  };
}

export const httpApiClient = createHttpApiClient();
