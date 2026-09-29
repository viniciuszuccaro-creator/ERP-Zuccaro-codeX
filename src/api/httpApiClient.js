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
 * Token da sessão autenticada para Bearer (supabase_user).
 * Ordem: erp_runtime_scope.token → base44_access_token / appParams.
 * Nunca logar o valor; retorna string vazia se ausente.
 *
 * @param {{
 *   storage?: { getItem?: (key: string) => string | null },
 *   appToken?: string | null,
 * }} [options]
 * @returns {string}
 */
export function resolveErpAuthSessionToken(options = {}) {
  const storage = options.storage
    ?? (typeof window !== 'undefined' ? window.localStorage : null);
  try {
    const raw = storage?.getItem?.('erp_runtime_scope');
    if (raw) {
      const scope = JSON.parse(raw);
      const fromScope = typeof scope?.token === 'string' ? scope.token.trim() : '';
      if (fromScope) return fromScope;
    }
  } catch {
    // ignore JSON/storage errors — fail-closed sem token
  }
  const storedApp = typeof storage?.getItem === 'function'
    ? String(storage.getItem('base44_access_token') || '').trim()
    : '';
  if (storedApp) return storedApp;
  const appToken = typeof options.appToken === 'string' ? options.appToken.trim() : '';
  return appToken;
}

/**
 * Gate de carga da Central 360: exige flag + tenant + ator + Bearer de sessão.
 * @param {{
 *   flag?: boolean,
 *   clienteId?: string | null,
 *   groupId?: string | null,
 *   empresaId?: string | null,
 *   actorId?: string | null,
 *   token?: string | null,
 * }} input
 */
export function canLoadCentralCliente360(input = {}) {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  return Boolean(
    input.flag
    && input.clienteId
    && input.groupId
    && input.empresaId
    && input.actorId
    && token,
  );
}

/**
 * Fingerprint FNV-1a 32-bit (sync, browser+Node) — isola cache sem colocar o Bearer no queryKey.
 * Dois tokens distintos de mesmo comprimento NÃO colidem (corrigido vs. só `t${length}`).
 * @param {string} value
 * @returns {string} hex sem prefixo 0x
 */
function fnv1a32Hex(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Chave de sessão sem segredo (para queryKey / invalidação ao trocar usuário/token).
 * Inclui length + fingerprint do conteúdo — tokens diferentes com length idêntico invalidam cache.
 * @param {string | null | undefined} token
 */
export function central360SessionKey(token) {
  const t = typeof token === 'string' ? token.trim() : '';
  if (!t) return 'none';
  return `t${t.length}_${fnv1a32Hex(t)}`;
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
    const bearer = typeof scope.token === 'string' ? scope.token.trim() : '';
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (!bearer) {
      if (scope.actorId) headers['X-Actor-Id'] = String(scope.actorId);
      if (scope.actorEmail) headers['X-Actor-Email'] = String(scope.actorEmail);
    }

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
    // CondicaoPagamento R08B — piloto HTTP (CRUD + parcelas/vínculo/padrão/resolve).
    CondicaoPagamento: (() => {
      const base = createCrudEntity('/api/v1/condicoes-pagamento', {
        searchKeys: ['search', 'nome', 'codigo'],
        ativoKeys: ['ativo'],
      });
      return {
        ...base,
        async list(orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/condicoes-pagamento', { query: { limit, ativo: true } });
        },
        async filter(query = {}, orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/condicoes-pagamento', {
            query: {
              limit,
              offset: query.offset,
              search: query.search || query.nome || query.codigo,
              ativo: query.ativo ?? query.ativa,
              eh_padrao: query.eh_padrao ?? query.ehPadrao,
            },
          });
        },
        /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
        restore(id, { signal } = {}) {
          return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/restore`, {
            method: 'POST',
            signal,
          });
        },
        /** @param {string} id @param {unknown} parcelas @param {{ signal?: AbortSignal }} [options] */
        replaceParcelas(id, parcelas, { signal } = {}) {
          return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/parcelas`, {
            method: 'PUT',
            body: parcelas,
            signal,
          });
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        linkEmpresa(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
            { method: 'POST', signal },
          );
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        unlinkEmpresa(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
            { method: 'DELETE', signal },
          );
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        restoreEmpresa(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}/restore`,
            { method: 'POST', signal },
          );
        },
        /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
        setPadrao(id, { signal } = {}) {
          return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/padrao`, {
            method: 'POST',
            signal,
          });
        },
      };
    })(),
    // TabelaPreco R07B — piloto HTTP (CRUD + vínculo/padrão/itens + preco-cliente).
    TabelaPreco: (() => {
      const base = createCrudEntity('/api/v1/tabelas-preco', {
        searchKeys: ['search', 'nome', 'codigo'],
        ativoKeys: ['ativo'],
      });
      return {
        ...base,
        async list(orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/tabelas-preco', { query: { limit, ativo: true } });
        },
        async filter(query = {}, orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/tabelas-preco', {
            query: {
              limit,
              offset: query.offset,
              search: query.search || query.nome || query.codigo,
              ativo: query.ativo ?? query.ativa,
              vigente: query.vigente,
              eh_padrao: query.eh_padrao ?? query.ehPadrao,
            },
          });
        },
        /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
        restore(id, { signal } = {}) {
          return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}/restore`, {
            method: 'POST',
            signal,
          });
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        linkEmpresa(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
            { method: 'POST', signal },
          );
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        unlinkEmpresa(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
            { method: 'DELETE', signal },
          );
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        restoreEmpresa(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}/restore`,
            { method: 'POST', signal },
          );
        },
        /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
        setPadrao(id, empresaId, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}/padrao`,
            { method: 'POST', signal },
          );
        },
        /** @param {string} id @param {{ limit?: number, offset?: number, ativo?: boolean, signal?: AbortSignal }} [options] */
        listItens(id, { limit = 100, offset = 0, ativo, signal } = {}) {
          return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens`, {
            query: { limit, offset, ativo },
            signal,
            unwrap: false,
          });
        },
        /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
        createItem(id, payload, { signal } = {}) {
          return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens`, {
            method: 'POST',
            body: payload,
            signal,
          });
        },
        /** @param {string} id @param {string} itemId @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
        updateItem(id, itemId, payload, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}`,
            { method: 'PATCH', body: payload, signal },
          );
        },
        /** @param {string} id @param {string} itemId @param {{ signal?: AbortSignal }} [options] */
        softDeleteItem(id, itemId, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}`,
            { method: 'DELETE', signal },
          );
        },
        /** @param {string} id @param {string} itemId @param {{ signal?: AbortSignal }} [options] */
        restoreItem(id, itemId, { signal } = {}) {
          return request(
            `/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}/restore`,
            { method: 'POST', signal },
          );
        },
      };
    })(),
    // Cliente R04 — piloto HTTP Onda 3 (CRUD + restore + vínculos/Central 360 no namespace `clientes`).
    Cliente: (() => {
      const base = createCrudEntity('/api/v1/clientes', {
        searchKeys: ['search', 'nome', 'razao_social', 'nome_fantasia', 'codigo', 'documento'],
        ativoKeys: ['ativo'],
      });
      return {
        ...base,
        async list(orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/clientes', {
            query: { limit, ativo: true, order_by: 'nome' },
          });
        },
        async filter(query = {}, orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/clientes', {
            query: {
              limit,
              offset: query.offset,
              search: query.search || query.nome || query.razao_social || query.codigo,
              documento: query.documento || query.cpf_cnpj,
              codigo: query.codigo_exato || query.codigoExact,
              ativo: query.ativo ?? true,
              order_by: query.order_by || query.orderBy || 'nome',
              order_dir: query.order_dir || query.orderDir,
            },
          });
        },
        /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
        restore(id, { signal } = {}) {
          return request(`/api/v1/clientes/${encodeURIComponent(id)}/restore`, {
            method: 'POST',
            signal,
          });
        },
      };
    })(),
    // ClienteEmpresa R05 — piloto HTTP list-for-scope (seleção Comercial); mutações permanecem nested.
    ClienteEmpresa: (() => {
      return {
        async list(orderBy, limit = 100) {
          void orderBy;
          return request('/api/v1/cliente-empresas', {
            query: { limit, ativo: true, habilitado_operacao: true },
          });
        },
        async filter(query = {}, orderBy, limit = 100) {
          void orderBy;
          const habilitado = query.habilitado_operacao ?? query.habilitadoOperacao;
          return request('/api/v1/cliente-empresas', {
            query: {
              limit,
              offset: query.offset,
              search: query.search || query.codigo,
              ativo: query.ativo ?? true,
              bloqueado: query.bloqueado,
              habilitado_operacao: habilitado === undefined ? true : habilitado,
              situacao: query.situacao || query.situacao_comercial || query.situacaoComercial,
              order_by: query.order_by || query.orderBy || 'created_at',
              order_dir: query.order_dir || query.orderDir,
            },
          });
        },
        /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
        get(id, { signal } = {}) {
          return request(`/api/v1/cliente-empresas/${encodeURIComponent(id)}`, { signal });
        },
      };
    })(),
    // ClienteLocal R06A — nested sob Cliente; exige cliente_id no filter (sem flat list-for-scope).
    ClienteLocal: (() => {
      const requireClienteId = (query = {}) => {
        const clienteId = query.cliente_id || query.clienteId;
        if (!clienteId || typeof clienteId !== 'string') {
          throw createHttpError(400, { error: { code: 'CLIENTE_ID_REQUIRED', message: 'cliente_id is required for ClienteLocal HTTP' } });
        }
        return clienteId;
      };
      return {
        async list(orderBy, limit = 100) {
          void orderBy;
          void limit;
          throw createHttpError(400, { error: { code: 'CLIENTE_ID_REQUIRED', message: 'ClienteLocal.list requires filter({ cliente_id })' } });
        },
        async filter(query = {}, orderBy, limit = 100) {
          void orderBy;
          const clienteId = requireClienteId(query);
          return request(`/api/v1/clientes/${encodeURIComponent(clienteId)}/locais`, {
            query: {
              limit,
              offset: query.offset,
              search: query.search || query.nome,
              ativo: query.ativo ?? true,
              finalidade: query.finalidade,
              principal: query.principal,
              cidade: query.cidade,
              uf: query.uf,
              order_by: query.order_by || query.orderBy || 'nome',
              order_dir: query.order_dir || query.orderDir,
            },
            unwrap: false,
          });
        },
        /**
         * @param {string} id
         * @param {{ clienteId?: string, cliente_id?: string, signal?: AbortSignal }} [options]
         */
        get(id, options = {}) {
          const clienteId = options.clienteId || options.cliente_id;
          if (!clienteId) {
            throw createHttpError(400, { error: { code: 'CLIENTE_ID_REQUIRED', message: 'clienteId is required for ClienteLocal.get' } });
          }
          return request(
            `/api/v1/clientes/${encodeURIComponent(clienteId)}/locais/${encodeURIComponent(id)}`,
            { signal: options.signal },
          );
        },
      };
    })(),
    // Obra R06B — nested sob Cliente; exige cliente_id no filter (seleção operacional no Pedido).
    Obra: (() => {
      const requireClienteId = (query = {}) => {
        const clienteId = query.cliente_id || query.clienteId;
        if (!clienteId || typeof clienteId !== 'string') {
          throw createHttpError(400, { error: { code: 'CLIENTE_ID_REQUIRED', message: 'cliente_id is required for Obra HTTP' } });
        }
        return clienteId;
      };
      return {
        async list(orderBy, limit = 100) {
          void orderBy;
          void limit;
          throw createHttpError(400, { error: { code: 'CLIENTE_ID_REQUIRED', message: 'Obra.list requires filter({ cliente_id })' } });
        },
        async filter(query = {}, orderBy, limit = 100) {
          void orderBy;
          const clienteId = requireClienteId(query);
          return request(`/api/v1/clientes/${encodeURIComponent(clienteId)}/obras`, {
            query: {
              limit,
              offset: query.offset,
              search: query.search || query.nome || query.codigo,
              ativo: query.ativo ?? true,
              status: query.status,
              operacional: query.operacional,
              cidade: query.cidade,
              uf: query.uf,
              order_by: query.order_by || query.orderBy || 'nome',
              order_dir: query.order_dir || query.orderDir,
            },
            unwrap: false,
          });
        },
        /**
         * @param {string} id
         * @param {{ clienteId?: string, cliente_id?: string, signal?: AbortSignal }} [options]
         */
        get(id, options = {}) {
          const clienteId = options.clienteId || options.cliente_id;
          if (!clienteId) {
            throw createHttpError(400, { error: { code: 'CLIENTE_ID_REQUIRED', message: 'clienteId is required for Obra.get' } });
          }
          return request(
            `/api/v1/clientes/${encodeURIComponent(clienteId)}/obras/${encodeURIComponent(id)}`,
            { signal: options.signal },
          );
        },
      };
    })(),
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
  /** Simulação comercial Onda 2 (não persiste). Tenant só nos headers via getScope. */
  const comercial = {
    /** @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    simularVenda(payload, { signal } = {}) {
      return request('/api/v1/comercial/simular-venda', { method: 'POST', body: payload, signal });
    },
  };
  /**
   * CondicaoPagamento canônica (R08B + Onda 2 resolve).
   * Tenant só nos headers via getScope; RBAC Cadastros.condicao_pagamento.* no BFF.
   */
  const condicoesPagamento = {
    /**
     * @param {{ limit?: number, offset?: number, search?: string, ativo?: boolean, ehPadrao?: boolean, signal?: AbortSignal }} [options]
     */
    list({ limit = 50, offset = 0, search, ativo = true, ehPadrao, signal } = {}) {
      return request('/api/v1/condicoes-pagamento', {
        query: {
          limit,
          offset,
          search,
          ativo,
          eh_padrao: ehPadrao,
        },
        signal,
        unwrap: false,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    get(id, { signal } = {}) {
      return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}`, { signal });
    },
    /** @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    create(payload, { signal } = {}) {
      return request('/api/v1/condicoes-pagamento', { method: 'POST', body: payload, signal });
    },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    update(id, payload, { signal } = {}) {
      return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: payload,
        signal,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    softDelete(id, { signal } = {}) {
      return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    restore(id, { signal } = {}) {
      return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        signal,
      });
    },
    /** @param {string} id @param {unknown} parcelas @param {{ signal?: AbortSignal }} [options] */
    replaceParcelas(id, parcelas, { signal } = {}) {
      return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/parcelas`, {
        method: 'PUT',
        body: parcelas,
        signal,
      });
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    linkEmpresa(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
        { method: 'POST', signal },
      );
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    unlinkEmpresa(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
        { method: 'DELETE', signal },
      );
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    restoreEmpresa(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}/restore`,
        { method: 'POST', signal },
      );
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    setPadrao(id, { signal } = {}) {
      return request(`/api/v1/condicoes-pagamento/${encodeURIComponent(id)}/padrao`, {
        method: 'POST',
        signal,
      });
    },
    /**
     * Resolve fail-closed ClienteEmpresa → padrão Empresa
     * (Cadastros.condicao_pagamento.visualizar no backend).
     * @param {string} clienteEmpresaId
     * @param {{ signal?: AbortSignal }} [options]
     */
    resolve(clienteEmpresaId, { signal } = {}) {
      return request('/api/v1/condicoes-pagamento/resolve', {
        query: { clienteEmpresaId },
        signal,
      });
    },
  };
  /**
   * TabelaPreco canônica (R07B + Onda 2 preco-cliente).
   * Tenant só nos headers via getScope; RBAC Cadastros.tabela_preco.* no BFF.
   */
  const tabelasPreco = {
    /**
     * @param {{ limit?: number, offset?: number, search?: string, ativo?: boolean, vigente?: boolean, ehPadrao?: boolean, signal?: AbortSignal }} [options]
     */
    list({ limit = 50, offset = 0, search, ativo = true, vigente, ehPadrao, signal } = {}) {
      return request('/api/v1/tabelas-preco', {
        query: {
          limit,
          offset,
          search,
          ativo,
          vigente,
          eh_padrao: ehPadrao,
        },
        signal,
        unwrap: false,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    get(id, { signal } = {}) {
      return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}`, { signal });
    },
    /** @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    create(payload, { signal } = {}) {
      return request('/api/v1/tabelas-preco', { method: 'POST', body: payload, signal });
    },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    update(id, payload, { signal } = {}) {
      return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: payload,
        signal,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    softDelete(id, { signal } = {}) {
      return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    restore(id, { signal } = {}) {
      return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        signal,
      });
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    linkEmpresa(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
        { method: 'POST', signal },
      );
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    unlinkEmpresa(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}`,
        { method: 'DELETE', signal },
      );
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    restoreEmpresa(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}/restore`,
        { method: 'POST', signal },
      );
    },
    /** @param {string} id @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    setPadrao(id, empresaId, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/empresas/${encodeURIComponent(empresaId)}/padrao`,
        { method: 'POST', signal },
      );
    },
    /** @param {string} id @param {{ limit?: number, offset?: number, ativo?: boolean, signal?: AbortSignal }} [options] */
    listItens(id, { limit = 100, offset = 0, ativo, signal } = {}) {
      return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens`, {
        query: { limit, offset, ativo },
        signal,
        unwrap: false,
      });
    },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    createItem(id, payload, { signal } = {}) {
      return request(`/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens`, {
        method: 'POST',
        body: payload,
        signal,
      });
    },
    /** @param {string} id @param {string} itemId @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    updateItem(id, itemId, payload, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}`,
        { method: 'PATCH', body: payload, signal },
      );
    },
    /** @param {string} id @param {string} itemId @param {{ signal?: AbortSignal }} [options] */
    softDeleteItem(id, itemId, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}`,
        { method: 'DELETE', signal },
      );
    },
    /** @param {string} id @param {string} itemId @param {{ signal?: AbortSignal }} [options] */
    restoreItem(id, itemId, { signal } = {}) {
      return request(
        `/api/v1/tabelas-preco/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}/restore`,
        { method: 'POST', signal },
      );
    },
    /**
     * Resolve preço fail-closed via vínculo ClienteEmpresa → padrão Empresa.
     * (Cadastros.tabela_preco.visualizar + cliente_empresa.visualizar no backend).
     * @param {{ clienteEmpresaId: string, produtoId: string, unidadeMedidaId: string, businessDate?: string }} params
     * @param {{ signal?: AbortSignal }} [options]
     */
    resolveClientPrice(params, { signal } = {}) {
      return request('/api/v1/tabelas-preco/preco-cliente', {
        query: {
          clienteEmpresaId: params.clienteEmpresaId,
          produtoId: params.produtoId,
          unidadeMedidaId: params.unidadeMedidaId,
          businessDate: params.businessDate,
        },
        signal,
      });
    },
  };
  /**
   * Cliente canônico (R04 + Central 360 + vínculos R05).
   * Tenant só nos headers; RBAC Cadastros.cliente.* / cliente-empresa.* no BFF.
   */
  const clientes = {
    /**
     * @param {{ limit?: number, offset?: number, search?: string, ativo?: boolean, codigo?: string, documento?: string, orderBy?: string, orderDir?: string, signal?: AbortSignal }} [options]
     */
    list({
      limit = 50,
      offset = 0,
      search,
      ativo = true,
      codigo,
      documento,
      orderBy = 'nome',
      orderDir,
      signal,
    } = {}) {
      return request('/api/v1/clientes', {
        query: {
          limit,
          offset,
          search,
          ativo,
          codigo,
          documento,
          order_by: orderBy,
          order_dir: orderDir,
        },
        signal,
        unwrap: false,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    get(id, { signal } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(id)}`, { signal });
    },
    /** @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    create(payload, { signal } = {}) {
      return request('/api/v1/clientes', { method: 'POST', body: payload, signal });
    },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    update(id, payload, { signal } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: payload,
        signal,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    softDelete(id, { signal } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    restore(id, { signal } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        signal,
      });
    },
    /**
     * Vínculos Cliente×Empresa (R05) — nested sob Cliente; list-for-scope flat em `clienteEmpresas`.
     * @param {string} clienteId
     * @param {{ limit?: number, offset?: number, ativo?: boolean, bloqueado?: boolean, situacao?: string, empresaId?: string, search?: string, signal?: AbortSignal }} [options]
     */
    listEmpresaLinks(clienteId, {
      limit = 50,
      offset = 0,
      ativo = true,
      bloqueado,
      situacao,
      empresaId,
      search,
      signal,
    } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(clienteId)}/empresas`, {
        query: {
          limit,
          offset,
          ativo,
          bloqueado,
          situacao,
          empresa_id: empresaId,
          search,
        },
        signal,
        unwrap: false,
      });
    },
    /** @param {string} clienteId @param {string} empresaId @param {{ signal?: AbortSignal }} [options] */
    getEmpresaLink(clienteId, empresaId, { signal } = {}) {
      return request(
        `/api/v1/clientes/${encodeURIComponent(clienteId)}/empresas/${encodeURIComponent(empresaId)}`,
        { signal },
      );
    },
    /**
     * Locais do Cliente (R06A) — nested; tenant só nos headers.
     * @param {string} clienteId
     * @param {{ limit?: number, offset?: number, search?: string, ativo?: boolean, finalidade?: string, principal?: boolean, cidade?: string, uf?: string, orderBy?: string, orderDir?: string, signal?: AbortSignal }} [options]
     */
    listLocais(clienteId, {
      limit = 50,
      offset = 0,
      search,
      ativo = true,
      finalidade,
      principal,
      cidade,
      uf,
      orderBy = 'nome',
      orderDir,
      signal,
    } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(clienteId)}/locais`, {
        query: {
          limit,
          offset,
          search,
          ativo,
          finalidade,
          principal,
          cidade,
          uf,
          order_by: orderBy,
          order_dir: orderDir,
        },
        signal,
        unwrap: false,
      });
    },
    /**
     * @param {string} clienteId
     * @param {string} localId
     * @param {{ signal?: AbortSignal }} [options]
     */
    getLocal(clienteId, localId, { signal } = {}) {
      return request(
        `/api/v1/clientes/${encodeURIComponent(clienteId)}/locais/${encodeURIComponent(localId)}`,
        { signal },
      );
    },
    /**
     * Obras do Cliente (R06B) — nested; use operacional=true no Pedido (exige empresaId no contexto).
     * @param {string} clienteId
     * @param {{ limit?: number, offset?: number, search?: string, ativo?: boolean, status?: string, operacional?: boolean, cidade?: string, uf?: string, orderBy?: string, orderDir?: string, signal?: AbortSignal }} [options]
     */
    listObras(clienteId, {
      limit = 50,
      offset = 0,
      search,
      ativo = true,
      status,
      operacional,
      cidade,
      uf,
      orderBy = 'nome',
      orderDir,
      signal,
    } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(clienteId)}/obras`, {
        query: {
          limit,
          offset,
          search,
          ativo: operacional ? undefined : ativo,
          status,
          operacional,
          cidade,
          uf,
          order_by: orderBy,
          order_dir: orderDir,
        },
        signal,
        unwrap: false,
      });
    },
    /**
     * @param {string} clienteId
     * @param {string} obraId
     * @param {{ signal?: AbortSignal }} [options]
     */
    getObra(clienteId, obraId, { signal } = {}) {
      return request(
        `/api/v1/clientes/${encodeURIComponent(clienteId)}/obras/${encodeURIComponent(obraId)}`,
        { signal },
      );
    },
    /**
     * Read-model Central Cliente 360 (opt-in UI via VITE_ERP_HTTP_CLIENTE_360).
     * @param {string} id
     * @param {{ orcamentosLimit?: number, pedidosLimit?: number, locaisLimit?: number, obrasLimit?: number, empresasLimit?: number, signal?: AbortSignal }} [options]
     */
    central360(id, {
      orcamentosLimit = 10,
      pedidosLimit = 10,
      locaisLimit = 10,
      obrasLimit = 10,
      empresasLimit = 10,
      signal,
    } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(id)}/central-360`, {
        query: {
          orcamentos_limit: orcamentosLimit,
          pedidos_limit: pedidosLimit,
          locais_limit: locaisLimit,
          obras_limit: obrasLimit,
          empresas_limit: empresasLimit,
        },
        signal,
        unwrap: false,
      });
    },
  };
  /**
   * UnidadeMedida já no piloto — helper de listagem com envelope para mestres Comercial.
   */
  const unidadesMedida = {
    /**
     * @param {{ limit?: number, offset?: number, search?: string, ativo?: boolean, signal?: AbortSignal }} [options]
     */
    list({ limit = 50, offset = 0, search, ativo = true, signal } = {}) {
      return request('/api/v1/unidades-medida', {
        query: { limit, offset, search, ativo },
        signal,
        unwrap: false,
      });
    },
  };
  /**
   * ClienteEmpresa list-for-scope (R05) — seleção Comercial Orçamento/Pedido.
   * Tenant só nos headers; RBAC Cadastros.cliente_empresa.visualizar no BFF.
   * Mutações continuam nested em `clientes.*EmpresaLink`.
   */
  const clienteEmpresas = {
    /**
     * @param {{
     *   limit?: number,
     *   offset?: number,
     *   search?: string,
     *   ativo?: boolean,
     *   bloqueado?: boolean,
     *   habilitadoOperacao?: boolean,
     *   situacao?: string,
     *   orderBy?: string,
     *   orderDir?: string,
     *   signal?: AbortSignal,
     * }} [options]
     */
    list({
      limit = 50,
      offset = 0,
      search,
      ativo = true,
      bloqueado,
      habilitadoOperacao = true,
      situacao,
      orderBy = 'created_at',
      orderDir,
      signal,
    } = {}) {
      return request('/api/v1/cliente-empresas', {
        query: {
          limit,
          offset,
          search,
          ativo,
          bloqueado,
          habilitado_operacao: habilitadoOperacao,
          situacao,
          order_by: orderBy,
          order_dir: orderDir,
        },
        signal,
        unwrap: false,
      });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    get(id, { signal } = {}) {
      return request(`/api/v1/cliente-empresas/${encodeURIComponent(id)}`, { signal });
    },
  };
  /** @type {Record<string, ReturnType<typeof createCrudEntity>>} */
  const entities = {};
  for (const name of HTTP_PILOT_ENTITIES) {
    entities[name] = entityRoutes[name] || entityRoutes.Marca;
  }

  return {
    entities,
    async entityGuard(payload = {}) {
      /** @type {{ token?: string, actorId?: string, groupId?: string }} */
      const scope = getScope() || {};
      if (!scope.token || !scope.actorId || !scope.groupId) throw createHttpError(401, { error: { code: 'AUTH_REQUIRED' } }, undefined);
      // Profile is a selector, never identity: the BFF binds it to the verified Bearer.
      return request('/api/v1/auth/session', {
        query: { guard: JSON.stringify({ ...payload, profile_id: scope.actorId }) },
        unwrap: false,
      });
    },
    orcamentos,
    pedidos,
    comercial,
    condicoesPagamento,
    tabelasPreco,
    clientes,
    clienteEmpresas,
    unidadesMedida,
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
