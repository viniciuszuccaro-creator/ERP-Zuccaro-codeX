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

  /**
   * @param {string} basePath
   * @param {{ searchKeys?: string[], ativoKeys?: string[] }} [opts]
   */
  function createCrudEntity(basePath, opts = {}) {
    const searchKeys = opts.searchKeys || ['search', 'nome', 'descricao'];
    const ativoKeys = opts.ativoKeys || ['ativo', 'ativa'];
    return {
      async list(orderBy, limit = 100) {
        void orderBy;
        return request(basePath, { query: { limit } });
      },
      async filter(query = {}, orderBy, limit = 100) {
        void orderBy;
        let search;
        for (const key of searchKeys) {
          if (query[key] != null && query[key] !== '') {
            search = query[key];
            break;
          }
        }
        let ativo;
        for (const key of ativoKeys) {
          if (query[key] != null && query[key] !== '') {
            ativo = query[key];
            break;
          }
        }
        return request(basePath, {
          query: { limit, search, ativo },
        });
      },
      async get(id) {
        return request(`${basePath}/${encodeURIComponent(id)}`);
      },
      async create(data) {
        return request(basePath, { method: 'POST', body: data });
      },
      async update(id, data) {
        return request(`${basePath}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: data,
        });
      },
      async delete(id) {
        return request(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      },
    };
  }

  const entityRoutes = {
    Marca: createCrudEntity('/api/v1/marcas', {
      searchKeys: ['nome_marca', 'search', 'nome'],
      ativoKeys: ['ativa', 'ativo'],
    }),
    UnidadeMedida: createCrudEntity('/api/v1/unidades-medida', {
      searchKeys: ['sigla', 'nome_completo', 'search'],
    }),
    GrupoProduto: createCrudEntity('/api/v1/grupos-produto', {
      searchKeys: ['nome_grupo', 'codigo', 'search'],
    }),
    SetorAtividade: createCrudEntity('/api/v1/setores-atividade', {
      searchKeys: ['nome', 'search'],
    }),
    // API MASTER DATA pronta; NAO habilitada em HTTP_PILOT_ENTITIES.
    Produto: (() => {
      const base = createCrudEntity('/api/v1/produtos', {
        searchKeys: ['descricao', 'codigo', 'nome', 'codigo_barras', 'search'],
      });
      return {
        ...base,
        async list(orderBy, limit = 50, offset = 0) {
          void orderBy;
          return request('/api/v1/produtos', { query: { limit, offset } });
        },
        async filter(query = {}, orderBy, limit = 50) {
          void orderBy;
          return request('/api/v1/produtos', {
            query: {
              limit,
              offset: query.offset,
              search: query.descricao || query.search || query.nome,
              codigo: query.codigo,
              codigo_barras: query.codigo_barras,
              ativo: query.ativo ?? query.ativa,
            },
          });
        },
      };
    })(),
  };

  /** @type {Record<string, ReturnType<typeof createCrudEntity>>} */
  const entities = {};
  for (const name of HTTP_PILOT_ENTITIES) {
    entities[name] = entityRoutes[name] || entityRoutes.Marca;
  }

  return {
    entities,
    /** Acesso direto a rotas preparadas (ex.: Produto base) sem feature flag. */
    preparedEntities: entityRoutes,
    async health() {
      return request('/health');
    },
    async ready() {
      return request('/ready');
    },
  };
}

export const httpApiClient = createHttpApiClient();
