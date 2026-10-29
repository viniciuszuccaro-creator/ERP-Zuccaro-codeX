import { HTTP_PILOT_ENTITIES, resolveErpApiBaseUrl } from './runtimeBackend.js';
import { toClienteMasterHttpPayload, withHydratedContatos } from './clienteHttpPayload.js';
import { readErpHttpSession } from './erpHttpSession.js';
import { parseA1CertificateMetadata } from './a1CertificateContract.js';
import { createBankStatementApi } from './bankStatementHttp.js';
import { createFinancialMovementApi } from './financialMovementHttp.js';
import { MAX_BANK_STATEMENT_BYTES } from './bankStatementContract.js';

/**
 * Cliente HTTP compativel com a superficie parcial de base44.entities.*
 * UI → facade → HttpApiClient → BFF → PostgreSQL
 */

/** @typedef {Error & { status: number, code: string, requestId?: unknown, body?: unknown }} HttpApiError */

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
 * @param {unknown} error
 * @returns {error is HttpApiError}
 */
export function isHttpApiError(error) {
  return error instanceof Error
    && error.name === 'HttpApiError'
    && 'status' in error
    && Number.isInteger(error.status)
    && 'code' in error
    && typeof error.code === 'string';
}

/**
 * Extrai somente codigo textual, preservando o corpo bruto nao confiavel.
 * @param {unknown} body
 * @returns {string | undefined}
 */
export function readHttpErrorBodyCode(body) {
  if (!body || typeof body !== 'object' || !('error' in body)) return undefined;
  const detail = body.error;
  if (!detail || typeof detail !== 'object' || !('code' in detail)) return undefined;
  return typeof detail.code === 'string' ? detail.code : undefined;
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
  /** @type {() => {groupId?: string, empresaId?: string, actorId?: string, actorEmail?: string, token?: string}} */
  const getScope = options.getScope || (() => ({}));

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, query?: Record<string, unknown>, signal?: AbortSignal, unwrap?: boolean, ofx?: boolean }} [requestOptions]
   * @param {{groupId?: string, empresaId?: string, actorId?: string, actorEmail?: string, token?: string}} [boundScope]
   */
  async function request(path, { method = 'GET', body, query, signal, unwrap = true, ofx = false } = {}, boundScope = undefined) {
    const scope = boundScope || getScope() || {};
    const url = baseUrl
      ? new URL(`${baseUrl}${path}`)
      : new URL(path, 'http://same-origin.local');
    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value == null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const bankFile = ofx && typeof Blob !== 'undefined' && body instanceof Blob;
    if (ofx && (!bankFile || body.size < 1 || body.size > MAX_BANK_STATEMENT_BYTES || method !== 'POST')) {
      throw createHttpError(422, { error: { code: 'BANK_INPUT_INVALID' } }, undefined);
    }
    /** @type {Record<string, string>} */
    const headers = {
      Accept: 'application/json',
      ...(multipart ? {} : { 'Content-Type': bankFile ? 'application/x-ofx' : 'application/json' }),
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
      body: body == null ? undefined : multipart || bankFile ? body : JSON.stringify(body),
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
  /**
   * Converte orderBy legado Base44 (`-created_date`, `codigo`) em query BFF.
   * Campos não suportados pelo endpoint são ignorados no servidor (allowlist).
   * @param {unknown} orderBy
   */
  function normalizeOrderByQuery(orderBy) {
    if (typeof orderBy !== 'string' || !orderBy.trim()) return {};
    const desc = orderBy.startsWith('-');
    let field = (desc ? orderBy.slice(1) : orderBy).trim();
    if (!field) return {};
    if (field === 'created_date') field = 'created_at';
    return { order_by: field, order_dir: desc ? 'desc' : 'asc' };
  }

  function createCrudEntity(basePath, opts = {}) {
    const searchKeys = opts.searchKeys || ['search', 'nome', 'descricao'];
    const ativoKeys = opts.ativoKeys || ['ativo', 'ativa'];
    async function readFilterPage(query = {}, orderBy, limit = 100, skip = 0, unwrap = true) {
        if (typeof orderBy === 'number') {
          skip = limit || 0;
          limit = orderBy;
          orderBy = undefined;
        }
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
        const offset = Number.isInteger(Number(skip)) && Number(skip) > 0 ? Number(skip) : undefined;
        // Coerce status legado ("Ativo"/"Inativo") e booleans; strings inválidas
        // NÃO viram ativo=false no BFF (parseAtivoQuery trata qualquer não-true como false).
        let ativoQuery;
        if (typeof ativo === 'boolean') {
          ativoQuery = ativo;
        } else if (ativo != null && ativo !== '') {
          const raw = String(ativo).trim().toLowerCase();
          if (['1', 'true', 'yes', 'ativo', 'ativa', 'active'].includes(raw)) ativoQuery = true;
          else if (['0', 'false', 'no', 'inativo', 'inativa', 'inactive'].includes(raw)) ativoQuery = false;
        }
        const exact = {};
        if (basePath === '/api/v1/clientes') {
          for (const key of ['documento','codigo']) {
            if (!Object.prototype.hasOwnProperty.call(query,key)) continue;
            const value = query[key];
            if (typeof value !== 'string' || !value || value !== value.trim() || value.length > (key === 'documento' ? 32 : 80)
              || (key === 'documento' && (!/^[0-9.\/\- ]+$/.test(value) || ![11,14].includes(value.replace(/\D/g,'').length)))) {
              throw createHttpError(422,{error:{code:'VALIDATION_ERROR',message:'Explicit exact selector required'}}, undefined);
            }
            exact[key] = value;
          }
        }
        return request(basePath, {
          query: { limit, offset, search, ativo: ativoQuery, ...exact, ...normalizeOrderByQuery(orderBy) },
          unwrap,
        });
    }
    return {
      async list(orderBy, limit = 100) {
        return request(basePath, { query: { limit, ...normalizeOrderByQuery(orderBy) } });
      },
      async filter(query = {}, orderBy, limit = 100, skip = 0) {
        const result = await readFilterPage(query, orderBy, limit, skip);
        // entityListSorted exige array; BFF pode devolver página {data|rows}.
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result?.rows)) return result.rows;
        return [];
      },
      async count(query = {}) {
        const page = await readFilterPage(query, undefined, 1, 0, false);
        const total = page?.meta?.total;
        if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
          throw new Error('HTTP_COUNT_UNAVAILABLE: total autoritativo ausente ou invalido.');
        }
        return total;
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

  const expedicao = {
    /** @param {{limit?: number, offset?: number, search?: string, status?: string, pedidoId?: string, cidade?: string, clienteId?: string, signal?: AbortSignal}} options */
    listEntregas({ limit = 50, offset = 0, search, status, pedidoId, cidade, clienteId, signal } = {}) {
      return request('/api/v1/entregas', { query: { limit, offset, search, status, pedidoId, cidade, clienteId }, signal, unwrap: false });
    },
    getEntrega(id, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) { return request(`/api/v1/entregas/${encodeURIComponent(id)}`, { signal }); },
    createEntrega(payload, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) { return request('/api/v1/entregas', { method: 'POST', body: payload, signal }); },
    patchEntrega(id, payload, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) { return request(`/api/v1/entregas/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, signal }); },
    historyEntrega(id, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) { return request(`/api/v1/entregas/${encodeURIComponent(id)}/historico`, { signal }); },
    separacao(id, payload, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
      return request(`/api/v1/entregas/${encodeURIComponent(id)}/separacao`, { method: 'POST', body: payload, signal });
    },
    registrar(id, payload, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
      return request(`/api/v1/entregas/${encodeURIComponent(id)}/registrar`, { method: 'POST', body: payload, signal });
    },
    devolucao(id, payload, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
      return request(`/api/v1/entregas/${encodeURIComponent(id)}/devolucao`, { method: 'POST', body: payload, signal });
    },
    /** @param {{limit?: number, offset?: number, signal?: AbortSignal}} options */
    listRomaneios({ limit = 50, offset = 0, signal } = {}) {
      return request('/api/v1/romaneios', { query: { limit, offset }, signal, unwrap: false });
    },
    getRomaneio(id, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) { return request(`/api/v1/romaneios/${encodeURIComponent(id)}`, { signal }); },
    criarRomaneio(payload, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) { return request('/api/v1/romaneios', { method: 'POST', body: payload, signal }); },
  };

  const entityRoutes = {
Entrega: {
      async list(orderBy, limit = 100) {
        void orderBy;
        const page = await request('/api/v1/entregas', { query: { limit }, unwrap: false });
        return page?.data || [];
      },
      async filter(query = {}, orderBy, limit = 100) {
        void orderBy;
        const page = await request('/api/v1/entregas', {
          query: {
            limit,
            search: query.search || query.busca || query.q || query.numero_pedido || query.cliente_nome,
            status: query.status,
            pedidoId: query.pedido_id || query.pedidoId,
            cidade: query.cidade,
            clienteId: query.cliente_id || query.clienteId,
            offset: query.offset,
          },
          unwrap: false,
        });
        let rows = page?.data || [];
        if (query.id) rows = rows.filter((row) => String(row.id) === String(query.id));
        return rows;
      },
      async get(id) { return request(`/api/v1/entregas/${encodeURIComponent(id)}`); },
      async create(data) { return request('/api/v1/entregas', { method: 'POST', body: data }); },
      async update(id, data) { return request(`/api/v1/entregas/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }); },
    },
Romaneio: {
      async list(orderBy, limit = 100) {
        void orderBy;
        const page = await request('/api/v1/romaneios', { query: { limit }, unwrap: false });
        return page?.data || [];
      },
      async filter(query = {}, orderBy, limit = 100) {
        void orderBy;
        const page = await request('/api/v1/romaneios', { query: { limit, offset: query.offset }, unwrap: false });
        let rows = page?.data || [];
        if (query.id) rows = rows.filter((row) => String(row.id) === String(query.id));
        return rows;
      },
      async get(id) { return request(`/api/v1/romaneios/${encodeURIComponent(id)}`); },
      async create(data) {
        const payload = {
          confirmed: true,
          motorista_nome: data.motorista_nome || data.motorista,
          motorista_id: data.motorista_id || null,
          veiculo: data.veiculo,
          placa: data.placa,
          tipo_veiculo: data.tipo_veiculo || 'Caminhao',
          instrucoes_motorista: data.instrucoes_motorista,
          checklist_saida: data.checklist_saida || {
            documentos_ok: true,
            veiculo_ok: true,
            carga_conferida: true,
            combustivel_ok: true,
          },
          entregas_ids: data.entregas_ids || [],
          despachar: data.despachar !== false,
          idempotency_key: data.idempotency_key,
        };
        const result = await request('/api/v1/romaneios', { method: 'POST', body: payload });
        return result?.romaneio || result;
      },
      async update(id, data) {
        void id; void data;
        throw Object.assign(new Error('Romaneio update via PATCH nao suportado; use endpoints de dominio'), { status: 405 });
      },
    },
SeparacaoConferencia: {
      async create(data) {
        const entregaId = data.entrega_id;
        if (!entregaId) throw Object.assign(new Error('entrega_id obrigatorio'), { status: 422 });
        const checklist = data.checklist || {};
        const itens = (Array.isArray(data.itens) ? data.itens : []).map((item) => ({
          produto_id: item.produto_id || null,
          descricao: item.descricao || item.produto_descricao || 'Item',
          unidade_sigla: item.unidade_separada || item.unidade || item.unidade_medida || 'UN',
          quantidade_pedida: item.quantidade_pedida ?? item.quantidade ?? 0,
          quantidade_separada: item.quantidade_separada ?? 0,
        }));
        const result = await request(`/api/v1/entregas/${encodeURIComponent(entregaId)}/separacao`, {
          method: 'POST',
          body: {
            confirmed: true,
            checklist: {
              conferiu_quantidade: checklist.conferiu_quantidade === true,
              conferiu_qualidade: checklist.conferiu_qualidade === true,
              conferiu_embalagem: checklist.conferiu_embalagem === true,
              conferiu_etiquetas: checklist.conferiu_etiquetas === true,
              conferiu_documentos: checklist.conferiu_documentos === true,
            },
            itens,
            idempotency_key: data.idempotency_key,
          },
        });
        return result?.separacao || result;
      },
      async filter() { return []; },
      async list() { return []; },
    },

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
    // Listagem/CRUD Cliente no BFF — piloto quando VITE_ERP_HTTP_CLIENTE_360=true.
    Cliente: (() => {
      const base = createCrudEntity('/api/v1/clientes', {
        searchKeys: ['search', 'nome', 'razao_social', 'nome_fantasia', 'documento', 'cnpj', 'codigo'],
        // NÃO usar "status" aqui: filtros multiempresa / colunas status:"Ativo"
        // quebravam parseAtivoQuery → ativo=false → grade vazia com API n>0.
        ativoKeys: ['ativo', 'ativa'],
      });
      return {
        ...base,
        async get(id) {
          return withHydratedContatos(await base.get(id));
        },
        async list(orderBy, limit = 100) {
          const rows = await base.list(orderBy, limit);
          return Array.isArray(rows) ? rows.map(withHydratedContatos) : rows;
        },
        async filter(query = {}, orderBy, limit = 100, skip = 0) {
          const rows = await base.filter(query, orderBy, limit, skip);
          return Array.isArray(rows) ? rows.map(withHydratedContatos) : rows;
        },
        async create(data) {
          return withHydratedContatos(await base.create(toClienteMasterHttpPayload(data)));
        },
        async update(id, data) {
          return withHydratedContatos(await base.update(id, toClienteMasterHttpPayload(data)));
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
        empresaOperacao: {
          /** @param {string} produtoId @param {{signal?:AbortSignal}} [options] */
          get(produtoId,{signal}={}) {
            return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/empresa-operacao`,{signal});
          },
          /** @param {string} produtoId @param {{ativo:boolean,habilitado_operacao:boolean,expected_version:number}} payload @param {{signal?:AbortSignal}} [options] */
          update(produtoId,payload,{signal}={}) {
            return request(`/api/v1/produtos/${encodeURIComponent(produtoId)}/empresa-operacao`,{method:'PUT',body:payload,signal});
          },
        },
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
        /** Claim concorrente outbox produto.publicado. @param {{ limit?: number, leaseMs?: number, signal?: AbortSignal }} [options] */
        outboxClaim({ limit = 10, leaseMs = 60_000, signal } = {}) {
          return request('/api/v1/produtos/outbox/claim', { method: 'POST', body: { limit, leaseMs }, signal });
        },
        /** Confirm com lease token. @param {string} eventId @param {string} leaseToken @param {{ signal?: AbortSignal }} [options] */
        outboxConfirm(eventId, leaseToken, { signal } = {}) {
          return request(`/api/v1/produtos/outbox/${encodeURIComponent(eventId)}/confirm`, {
            method: 'POST', body: { leaseToken }, signal,
          });
        },
        /** Fail/retry/dead-letter. @param {string} eventId @param {string} leaseToken @param {string} [errorMessage] @param {{ signal?: AbortSignal }} [options] */
        outboxFail(eventId, leaseToken, errorMessage = 'delivery_failed', { signal } = {}) {
          return request(`/api/v1/produtos/outbox/${encodeURIComponent(eventId)}/fail`, {
            method: 'POST', body: { leaseToken, errorMessage }, signal,
          });
        },
        /** Reprocessa dead-letter → pending (RBAC reprocessar). @param {string} eventId @param {string} [reason] @param {{ signal?: AbortSignal }} [options] */
        outboxReprocess(eventId, reason = 'manual_reprocess', { signal } = {}) {
          return request(`/api/v1/produtos/outbox/${encodeURIComponent(eventId)}/reprocess`, {
            method: 'POST', body: { reason }, signal,
          });
        },
        /** Listagem read-only outbox. @param {{ status?: string, produtoId?: string, limit?: number, offset?: number, signal?: AbortSignal }} [options] */
        outboxList({ status, produtoId, limit = 20, offset = 0, signal } = {}) {
          return request('/api/v1/produtos/outbox', {
            query: { status, produtoId, limit, offset }, signal,
          });
        },
        /** Contagens por status. @param {{ produtoId?: string, signal?: AbortSignal }} [options] */
        outboxMetrics({ produtoId, signal } = {}) {
          return request('/api/v1/produtos/outbox/metrics', { query: { produtoId }, signal });
        },
        /** Descarta dead-letter → cancelled (RBAC descartar). @param {string} eventId @param {string} [reason] @param {{ signal?: AbortSignal }} [options] */
        outboxDiscard(eventId, reason = 'manual_discard', { signal } = {}) {
          return request(`/api/v1/produtos/outbox/${encodeURIComponent(eventId)}/discard`, {
            method: 'POST', body: { reason }, signal,
          });
        },
        /** Lote claim→publisher fake→confirm/fail (sem canal real). @param {{ limit?: number, leaseMs?: number, signal?: AbortSignal }} [options] */
        outboxProcess({ limit = 10, leaseMs = 60_000, signal } = {}) {
          return request('/api/v1/produtos/outbox/process', { method: 'POST', body: { limit, leaseMs }, signal });
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

  const comercialMasters = {
    /** @param {{clienteSearch?:string,produtoSearch?:string,clienteEmpresaId?:string,signal?:AbortSignal}} [options] */
    async list({ clienteSearch = '', produtoSearch = '', clienteEmpresaId, signal } = {}) {
      const before = Object.freeze({ ...(getScope() || {}) });
      const matches = current => current.token === before.token && current.groupId === before.groupId
        && current.empresaId === before.empresaId && current.actorId === before.actorId;
      const failure = (status, code) => createHttpError(status, { error: { code } }, undefined);
      if (!before.token || !before.groupId || !before.empresaId || !before.actorId) throw failure(401, 'AUTH_COMPANY_REQUIRED');
      if ([clienteSearch, produtoSearch].some(value => typeof value !== 'string' || value.length > 200 || value !== value.trim())) {
        throw failure(422, 'VALIDATION_ERROR');
      }
      if (signal?.aborted) throw failure(409, 'CONTEXT_CHANGED');
      if (clienteEmpresaId !== undefined && (typeof clienteEmpresaId !== 'string'
        || clienteEmpresaId.length !== 36 || clienteEmpresaId !== clienteEmpresaId.trim() || clienteSearch)) {
        throw failure(422, 'VALIDATION_ERROR');
      }
      let pages, caught;
      try {
        pages = await Promise.all([
          request('/api/v1/clientes', { query: { operacao: true, ativo: true, cliente_empresa_id: clienteEmpresaId, search: clienteSearch, limit: clienteEmpresaId ? 1 : 50, offset: 0, order_by: 'codigo' }, signal, unwrap: false }, before),
          request('/api/v1/produtos', { query: { operacao: true, ativo: true, search: produtoSearch, limit: 50, offset: 0 }, signal, unwrap: false }, before),
          request('/api/v1/condicoes-pagamento', { query: { ativo: true, limit: 200, offset: 0 }, signal, unwrap: false }, before),
          request('/api/v1/unidades-medida', { query: { ativo: true, limit: 200 }, signal, unwrap: false }, before),
          request('/api/v1/tabelas-preco', { query: { ativo: true, limit: 200, offset: 0 }, signal, unwrap: false }, before),
        ]);
      } catch (error) { caught = error; }
      if (signal?.aborted || !matches(getScope() || {})) throw failure(409, 'CONTEXT_CHANGED');
      if (caught) throw caught;
      if (!pages) throw failure(502, 'COMERCIAL_MASTERS_INVALID');
      return { clientes: pages[0], produtos: pages[1], condicoes: pages[2], unidades: pages[3], tabelas: pages[4] };
    },
    /**
     * Lookup leve de vínculo operacional (somente /clientes).
     * Evita fan-out N×5 do list() completo na hidratação de labels por linha.
     * @param {{clienteEmpresaId?:string,signal?:AbortSignal}} [options]
     */
    async resolveClienteEmpresa({ clienteEmpresaId, signal } = {}) {
      const before = Object.freeze({ ...(getScope() || {}) });
      const matches = current => current.token === before.token && current.groupId === before.groupId
        && current.empresaId === before.empresaId && current.actorId === before.actorId;
      const failure = (status, code) => createHttpError(status, { error: { code } }, undefined);
      if (!before.token || !before.groupId || !before.empresaId || !before.actorId) throw failure(401, 'AUTH_COMPANY_REQUIRED');
      if (typeof clienteEmpresaId !== 'string'
        || clienteEmpresaId.length !== 36 || clienteEmpresaId !== clienteEmpresaId.trim()) {
        throw failure(422, 'VALIDATION_ERROR');
      }
      if (signal?.aborted) throw failure(409, 'CONTEXT_CHANGED');
      let page, caught;
      try {
        page = await request('/api/v1/clientes', {
          query: {
            operacao: true, ativo: true, cliente_empresa_id: clienteEmpresaId,
            search: '', limit: 1, offset: 0, order_by: 'codigo',
          },
          signal, unwrap: false,
        }, before);
      } catch (error) { caught = error; }
      if (signal?.aborted || !matches(getScope() || {})) throw failure(409, 'CONTEXT_CHANGED');
      if (caught) throw caught;
      if (!page) throw failure(502, 'COMERCIAL_MASTERS_INVALID');
      return { clientes: page };
    },
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
    /** @param {{ limit?: number, offset?: number, search?: string, status?: string, clienteEmpresaId?: string, clienteId?: string, tipoOperacao?: string, signal?: AbortSignal }} [options] */
    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, clienteId, tipoOperacao, signal } = {}) {
      return request('/api/v1/pedidos', { query: { limit, offset, search, status, clienteEmpresaId, clienteId, tipoOperacao }, signal, unwrap: false });
    },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    get(id, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}`, { signal }); },
    /** @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    create(payload, { signal } = {}) { return request('/api/v1/pedidos', { method: 'POST', body: payload, signal }); },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    update(id, payload, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, signal }); },
    /** @param {string} id @param {string} motivo @param {{ signal?: AbortSignal }} [options] */
    cancel(id, motivo, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}/cancelar`, { method: 'POST', body: motivo ? { motivo } : {}, signal }); },
    /** @param {string} id @param {string} status @param {string} motivo @param {{ signal?: AbortSignal }} [options] */
    transition(id, status, motivo, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, ...(motivo ? { motivo } : {}) }, signal }); },
    /** @param {string} id @param {{ signal?: AbortSignal }} [options] */
    history(id, { signal } = {}) { return request(`/api/v1/pedidos/${encodeURIComponent(id)}/historico`, { signal }); },
    /** @param {string} id @param {Record<string, unknown>} payload @param {{ signal?: AbortSignal }} [options] */
    convertOrcamento(id, payload, { signal } = {}) { return request(`/api/v1/orcamentos/${encodeURIComponent(id)}/converter-pedido`, { method: 'POST', body: payload, signal }); },
  };
  // Prepared CRM surface: explicit callers only; never adds Oportunidade to the pilot.
  const oportunidades = {
    /** @param {{limit?:number,offset?:number,search?:string,status?:string,clienteEmpresaId?:string,ativo?:boolean,signal?:AbortSignal}} [options] */
    list({limit=50,offset=0,search,status,clienteEmpresaId,ativo,signal}={}) {
      return request('/api/v1/oportunidades',{query:{limit,offset,search,status,clienteEmpresaId,ativo},signal,unwrap:false});
    },
    /** @param {string} id @param {{signal?:AbortSignal}} [options] */
    get(id,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}`,{signal}); },
    /** @param {string} id @param {{signal?:AbortSignal}} [options] */
    getByLegacy(id,{signal}={}) { return request(`/api/v1/oportunidades/legado/${encodeURIComponent(id)}`,{signal}); },
    /** @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    create(payload,{signal}={}) { return request('/api/v1/oportunidades',{method:'POST',body:payload,signal}); },
    /** @param {string} id @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    update(id,payload,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}`,{method:'PATCH',body:payload,signal}); },
    /** @param {string} id @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    deactivate(id,payload,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}`,{method:'DELETE',body:payload,signal}); },
    /** @param {string} id @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    restore(id,payload,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}/restaurar`,{method:'POST',body:payload,signal}); },
    /** @param {string} id @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    linkOrcamento(id,payload,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}/vincular-orcamento`,{method:'POST',body:payload,signal}); },
    /** @param {string} id @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    linkPedido(id,payload,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}/vincular-pedido`,{method:'POST',body:payload,signal}); },
    /** @param {string} id @param {Record<string,unknown>} payload @param {{signal?:AbortSignal}} [options] */
    convertOrcamentoToPedido(id,payload,{signal}={}) { return request(`/api/v1/oportunidades/${encodeURIComponent(id)}/converter-orcamento-pedido`,{method:'POST',body:payload,signal}); },
  };

  const clientes = {
    /** Read exact cohort inside the application; never exports the session.
     * @param {{identidades: Array<Record<string,string>>}} input
     * @param {{signal?: AbortSignal}} [options]
     */
    async conferirLegado(input, { signal } = {}) {
      const fail = (status, code) => createHttpError(status, { error: { code, message: code } }, undefined);
      const before = Object.freeze({ ...(getScope() || {}) });
      const matches = current => current.groupId === before.groupId && current.actorId === before.actorId
        && (current.empresaId || null) === null && current.token === before.token;
      if (typeof before.token !== 'string' || !before.token.trim()
        || typeof before.groupId !== 'string' || !before.groupId.trim()
        || typeof before.actorId !== 'string' || !before.actorId.trim() || before.empresaId) throw fail(401, 'AUTH_GROUP_REQUIRED');
      if (!input || Object.keys(input).some(k => k !== 'identidades') || !Array.isArray(input.identidades)
        || input.identidades.length < 1 || input.identidades.length > 100) throw fail(422, 'VALIDATION_ERROR');
      const body = JSON.parse(JSON.stringify(input));
      for (const item of body.identidades) {
        if (!item || typeof item !== 'object' || Array.isArray(item)
          || Object.keys(item).some(k => !['documento','sourceSystem','codigoLegado'].includes(k))
          || (!item.documento && !(item.sourceSystem && item.codigoLegado))
          || Boolean(item.sourceSystem) !== Boolean(item.codigoLegado)
          || Object.values(item).some(v => typeof v !== 'string' || !v || v !== v.trim() || v.length > 80)
          || (item.documento && (!/^[0-9.\/\- ]{1,32}$/.test(item.documento)
            || ![11,14].includes(item.documento.replace(/\D/g,'').length)))) throw fail(422,'VALIDATION_ERROR');
      }
      if (signal?.aborted) throw fail(409, 'CONTEXT_CHANGED');
      let result, failure;
      try { result = await request('/api/v1/clientes/conferencia-legado', { method:'POST', body, signal }, before); }
      catch (error) { failure = error; }
      if (signal?.aborted || !matches(getScope() || {})) throw fail(409, 'CONTEXT_CHANGED');
      if (failure) throw failure;
      if (!Array.isArray(result) || result.length !== body.identidades.length) throw fail(502,'INVALID_RESPONSE');
      return result.map((row, indice) => {
        if (row?.indice !== indice || Object.keys(row).some(k=>!['indice','documento','legado'].includes(k))) throw fail(502,'INVALID_RESPONSE');
        const match = value => {
          if (value === null) return null;
          if (!value || Object.keys(value).some(k=>!['id','codigo','ativo'].includes(k))
            || typeof value.id !== 'string' || typeof value.codigo !== 'string' || typeof value.ativo !== 'boolean') throw fail(502,'INVALID_RESPONSE');
          return { id:value.id, codigo:value.codigo, ativo:value.ativo };
        };
        return { indice, documento:match(row.documento), legado:match(row.legado) };
      });
    },
    /**
     * Read-model Central Cliente 360 (opt-in UI via VITE_ERP_HTTP_CLIENTE_360).
     * Paginação canônica por bloco: *_limit / *_offset (servidor já valida).
     * @param {string} id
     * @param {{
     *   crmLimit?: number, crmOffset?: number,
     *   orcamentosLimit?: number, orcamentosOffset?: number,
     *   pedidosLimit?: number, pedidosOffset?: number,
     *   empresasLimit?: number, empresasOffset?: number,
     *   locaisLimit?: number, locaisOffset?: number,
     *   obrasLimit?: number, obrasOffset?: number,
     *   signal?: AbortSignal
     * }} [options]
     */
    central360(id, {
      crmLimit = 10,
      crmOffset = 0,
      orcamentosLimit = 10,
      orcamentosOffset = 0,
      pedidosLimit = 10,
      pedidosOffset = 0,
      empresasLimit = 10,
      empresasOffset = 0,
      locaisLimit = 10,
      locaisOffset = 0,
      obrasLimit = 10,
      obrasOffset = 0,
      signal,
    } = {}) {
      return request(`/api/v1/clientes/${encodeURIComponent(id)}/central-360`, {
        query: {
          orcamentos_limit: orcamentosLimit,
          orcamentos_offset: orcamentosOffset,
          pedidos_limit: pedidosLimit,
          pedidos_offset: pedidosOffset,
          empresas_limit: empresasLimit,
          empresas_offset: empresasOffset,
          locais_limit: locaisLimit,
          locais_offset: locaisOffset,
          obras_limit: obrasLimit,
          obras_offset: obrasOffset,
          crm_limit: crmLimit,
          crm_offset: crmOffset,
        },
        signal,
        unwrap: false,
      });
    },
    /**
     * Sugestão de vínculo por documento no Grupo (sem mescla).
     * @param {{ documento?: string, signal?: AbortSignal }} [input]
     */
    sugestaoVinculo({ documento, signal } = {}) {
      const doc = String(documento ?? '').trim();
      if (!doc) {
        return Promise.resolve({
          data: { sugestao: false, motivo: 'documento_ausente', mescla: 'proibida' },
        });
      }
      return request('/api/v1/clientes/sugestao-vinculo', {
        query: { documento: doc.slice(0, 32) },
        signal,
        unwrap: false,
      });
    },
  };
  /** @type {Record<string, ReturnType<typeof createCrudEntity>>} */
  const entities = {};
  for (const name of ["Entrega","Romaneio","SeparacaoConferencia"]) entities[name]=entityRoutes[name];
  for (const name of HTTP_PILOT_ENTITIES) {
    entities[name] = entityRoutes[name] || entityRoutes.Marca;
  }
  // Rotas preparadas (Cliente etc.) ficam disponiveis para o piloto efetivo
  // resolvido em resolveHttpPilotEntities — sem forcar Produto na listagem.
  if (entityRoutes.Cliente) entities.Cliente = entityRoutes.Cliente;

  return {
    entities,
    bankStatements: createBankStatementApi({ getScope, request }),
    financialMovements: createFinancialMovementApi({ getScope, request }),
    /** @param {{purpose: string, prompt: string, response_json_schema?: unknown, group_id: string, empresa_id?: string | null, signal?: AbortSignal}} input */
    async invokeIaContextual(input) {
      const scope = getScope() || {};
      const token = typeof scope.token === 'string' ? scope.token.trim() : '';
      const groupId = String(scope.groupId || '');
      const empresaId = String(scope.empresaId || '');
      const actorId = String(scope.actorId || '');
      if (!token || !actorId || !groupId) throw createHttpError(401, { error: { code: 'AUTH_REQUIRED' } }, undefined);
      if (!input || input.group_id !== groupId || String(input.empresa_id || '') !== empresaId) {
        throw createHttpError(403, { error: { code: 'IA_SCOPE_MISMATCH' } }, undefined);
      }
      const snapshot = Object.freeze({ groupId, empresaId, actorId, token });
      const assertCurrent = () => {
        const current = getScope() || {};
        if (input.signal?.aborted || (typeof current.token === 'string' ? current.token.trim() : '') !== token
          || String(current.actorId || '') !== actorId || String(current.groupId || '') !== groupId
          || String(current.empresaId || '') !== empresaId) {
          throw createHttpError(409, { error: { code: 'IA_STALE_CONTEXT' } }, undefined);
        }
      };
      if (input.signal?.aborted) assertCurrent();
      try {
        const result = await request('/api/v1/ia/invocations', { method: 'POST',
          body: { purpose: input.purpose, prompt: input.prompt,
            ...(input.response_json_schema === undefined ? {} : { response_json_schema: input.response_json_schema }),
            group_id: groupId, empresa_id: empresaId || null }, signal: input.signal }, snapshot);
        assertCurrent();
        return result;
      } catch (error) {
        assertCurrent();
        const status = isHttpApiError(error) ? error.status : 503;
        const code = isHttpApiError(error) && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code) ? error.code : 'IA_PROVIDER_UNAVAILABLE';
        throw createHttpError(status, { error: { code } }, undefined);
      }
    },
    a1Certificates: {
      /** @param {{groupId: string, empresaId: string, actorId: string}} expected @param {{signal?: AbortSignal}} [options] */
      metadata(expected, options = {}) {
        return a1Operation(expected, scope => request('/api/v1/fiscal/certificados-a1', { signal: options.signal }, scope), options.signal);
      },
      /** @param {{groupId: string, empresaId: string, actorId: string}} expected
       * @param {{file: File, password: string, operationId: string, replaces?: {id: string, revision: string}}} input
       * @param {{signal?: AbortSignal}} [options] */
      upload(expected, input, options = {}) {
        return a1Operation(expected, async scope => {
          if (!(input.file instanceof File) || !/\.(pfx|p12)$/i.test(input.file.name)
            || input.file.size < 1 || input.file.size > 5000000
            || new TextEncoder().encode(input.password).byteLength > 4096
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId)) {
            throw Object.assign(new Error('Envio A1 invalido.'), { code: 'A1_UPLOAD_INVALID', status: 422 });
          }
          const form = new FormData();
          form.append('certificate', new Blob([input.file], { type: 'application/x-pkcs12' }), input.file.name);
          form.append('password', input.password);
          form.append('operationId', input.operationId);
          if (input.replaces) form.append('replaces', JSON.stringify(input.replaces));
          try {
            const result = await request('/api/v1/fiscal/certificados-a1', { method: 'POST', body: form, signal: options.signal }, scope);
            if (result === null) throw new Error('A1 upload response missing');
            return result;
          }
          finally { for (const key of ['certificate', 'password', 'operationId', 'replaces']) form.delete(key); }
        }, options.signal);
      },
    },
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
    comercialMasters,
    orcamentos,
    pedidos,
    expedicao,
    clientes,
    oportunidades,
    /** Acesso direto a rotas preparadas (ex.: Produto base) sem feature flag. */
    preparedEntities: entityRoutes,
    async health() {
      return request('/health');
    },
    async ready() {
      return request('/ready');
    },
  };

  // Storage selects a context, never authorizes it; the backend verifies Bearer/RBAC.
  /** @param {{groupId:string,empresaId:string,actorId:string}} expected
   * @param {(scope:Readonly<ReturnType<typeof getScope>>)=>Promise<unknown>} operation
   * @param {AbortSignal} [signal] */
  async function a1Operation(expected, operation, signal) {
    /** @param {number} status @param {string} [code] */
    const failure = (status, code = 'A1_OPERATION_FAILED') => Object.assign(
      new Error('Nao foi possivel concluir a operacao no cofre A1.'), { code, status });
    /** @param {unknown} error */
    const sanitized = error => failure(error instanceof Error && 'status' in error
      && typeof error.status === 'number' && Number.isInteger(error.status)
      && error.status >= 400 && error.status <= 599 ? error.status : 503);
    /** @type {ReturnType<typeof getScope>} */ let before;
    try { before = Object.freeze({ ...(getScope() || {}) }); }
    catch { throw failure(401, 'A1_AUTH_REQUIRED'); }
    const { groupId, empresaId, actorId } = expected;
    const token = before.token;
    const matches = scope => typeof scope.token === 'string' && scope.token.trim()
      && scope.groupId === groupId && scope.empresaId === empresaId && scope.actorId === actorId;
    if (!groupId || !empresaId || !actorId || !matches(before)) {
      throw failure(401, 'A1_AUTH_REQUIRED');
    }
    if (signal?.aborted) throw failure(409);
    /** @type {unknown} */ let result;
    /** @type {unknown} */ let error;
    let rejected = false;
    try { result = await operation(before); }
    catch (caught) { rejected = true; error = caught; }
    /** @type {ReturnType<typeof getScope>} */ let current;
    try { current = getScope() || {}; }
    catch { throw failure(409); }
    if (signal?.aborted || !matches(current) || current.token !== token) throw failure(409);
    if (rejected) throw sanitized(error);
    try { return parseA1CertificateMetadata(result); }
    catch (caught) { throw sanitized(caught); }
  }
}

export const httpApiClient = createHttpApiClient();
export const a1CertificateApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).a1Certificates;
export const bankStatementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).bankStatements;
export const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;

export const clienteConferenciaApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).clientes;
