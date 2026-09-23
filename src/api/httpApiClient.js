import { HTTP_PILOT_ENTITIES, resolveErpApiBaseUrl } from './runtimeBackend.js';

/**
 * Cliente HTTP compativel com a superficie parcial de base44.entities.*
 * UI → facade → HttpApiClient → BFF → PostgreSQL
 */

function createHttpError(status, body, requestId) {
  const message = body?.error?.message || `HTTP ${status}`;
  return Object.assign(new Error(message), {
    name: 'HttpApiError',
    status,
    code: body?.error?.code || 'HTTP_ERROR',
    requestId: requestId || body?.error?.requestId,
    body,
  });
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

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, query?: Record<string, unknown>, signal?: AbortSignal, unwrap?: boolean }} [requestOptions]
   */
  async function request(path, { method = 'GET', body, query, signal, unwrap = true } = {}) {
    const scope = /** @type {{ groupId?: string, empresaId?: string, actorId?: string, actorEmail?: string, token?: string }} */ (getScope() || {});
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
      signal,
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
    return unwrap && payload?.data !== undefined ? payload.data : payload;
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
      const listeners = new Set();
      const notify = () => {
        for (const listener of listeners) {
          try { listener(); } catch (error) { console.error('[Produto HTTP] subscriber falhou', error); }
        }
      };
      const relationRoutes = (segment) => ({
        /** @param {string} produtoId @param {{ signal?: AbortSignal }} [options] */
        list(produtoId, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/${segment}`, { signal });
        },
        /** @param {string} produtoId @param {object} payload @param {{ signal?: AbortSignal }} [options] */
        create(produtoId, payload, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/${segment}`, { method: 'POST', body: payload, signal });
        },
        /** @param {string} produtoId @param {string} relationId @param {object} payload @param {{ signal?: AbortSignal }} [options] */
        update(produtoId, relationId, payload, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/${segment}/${encodeURIComponent(relationId)}`, { method: 'PATCH', body: payload, signal });
        },
        /** @param {string} produtoId @param {string} relationId @param {{ signal?: AbortSignal }} [options] */
        deactivate(produtoId, relationId, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/${segment}/${encodeURIComponent(relationId)}`, { method: 'DELETE', signal });
        },
      });
      return {
        ...base,
        variantes: relationRoutes('variantes'),
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        async create(data) {
          const row = await base.create(data);
          notify();
          return row;
        },
        async update(id, data) {
          const row = await base.update(id, data);
          notify();
          return row;
        },
        async delete(id) {
          const row = await base.delete(id);
          notify();
          return row;
        },
        /** @param {string} produtoId @param {string} status @param {{ signal?: AbortSignal }} [options] */
        workflow(produtoId, status, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/workflow`, { method: 'PATCH', body: { status }, signal });
        },
        /** @param {string} produtoId @param {object} payload @param {{ signal?: AbortSignal }} [options] */
        midiaReserve(produtoId, payload, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/midias/reservas`, { method: 'POST', body: payload, signal });
        },
        /** @param {string} produtoId @param {string} mediaId @param {string} attemptId @param {{ signal?: AbortSignal }} [options] */
        midiaConfirm(produtoId, mediaId, attemptId, { signal } = {}) {
          return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/midias/${encodeURIComponent(mediaId)}/confirmar`, { method: 'POST', body: { attemptId }, signal });
        },
        equivalentes: relationRoutes('equivalentes'),
        midias: {
          /** @param {string} produtoId @param {{ limit?: number, offset?: number, signal?: AbortSignal }} [options] */
          list(produtoId, { limit = 50, offset = 0, signal } = {}) {
            return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/midias`, { query: { limit, offset }, signal });
          },
        },
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

  const orcamentos = {
    /** @param {{ limit?: number, offset?: number, search?: string, status?: string, clienteEmpresaId?: string, validadeDe?: string, validadeAte?: string, signal?: AbortSignal }} [options] */
    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, validadeDe, validadeAte, signal } = {}) {
      return request('/api/v1/orcamentos', { query: { limit, offset, search, status, clienteEmpresaId, validadeDe, validadeAte }, signal, unwrap: false });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    get(id, { signal } = {}) {
      return request(`/api/v1/orcamentos/${encodeURIComponent(id)}`, { signal });
    },
    /** @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    create(payload, { signal } = {}) {
      return request('/api/v1/orcamentos', { method: 'POST', body: payload, signal });
    },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    update(id, payload, { signal } = {}) {
      return request(`/api/v1/orcamentos/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, signal });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    cancel(id, { signal } = {}) {
      return request(`/api/v1/orcamentos/${encodeURIComponent(id)}/cancelar`, { method: 'POST', signal });
    },
  };
  const pedidos = {
    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, tipoOperacao, signal } = {}) {
      return request('/api/v1/pedidos', { query: { limit, offset, search, status, clienteEmpresaId, tipoOperacao }, signal, unwrap: false });
    },
    get(id, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}`, { signal }); },
    create(payload, { signal } = {}) { return request('/api/v1/pedidos', { method: 'POST', body: payload, signal }); },
    update(id, payload, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, signal }); },
    cancel(id, motivo, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}/cancelar`, { method: 'POST', body: motivo ? { motivo } : {}, signal }); },
    transition(id, status, motivo, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, ...(motivo ? { motivo } : {}) }, signal }); },
    history(id, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}/historico`, { signal }); },
    convertOrcamento(id, payload, { signal } = {}) { return request(`/api/v1/orcamentos/${encodeURIComponent(id)}/converter-pedido`, { method: 'POST', body: payload, signal }); },
  };
  /** @type {Record<string, ReturnType<typeof createCrudEntity>>} */
  const entities = {};
  for (const name of HTTP_PILOT_ENTITIES) {
    entities[name] = entityRoutes[name] || entityRoutes.Marca;
  }

  return {
    entities,
    orcamentos,
    pedidos,
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
