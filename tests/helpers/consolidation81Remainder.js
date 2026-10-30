import assert from 'node:assert/strict';
import crypto from 'node:crypto';
export const consolidation81Hunks={
  "src/api/base44Client.js": {
    "hash": "5f36584a17fce4cfe46b1298942caae2575dd7866e77ff0a20d9c8daa4e16b6b",
    "hunks": [
      [
        "} from './localAuthSessionPolicy.js';\nimport { createHttpApiClient } from './httpApiClient.js';\nimport { HTTP_CONTEXT_CHANGED } from './erpHttpSession.js';\nimport { runLocalEntityReadFunction, notifyEntityApiAccess } from './localEntityReadApi.js';\nimport {\n  countEntitiesTouchesHttpPilot,\n  runHttpPilotAwareCountEntities,",
        "} from './localAuthSessionPolicy.js';\nimport { createHttpApiClient } from './httpApiClient.js';\nimport { HTTP_CONTEXT_CHANGED } from './erpHttpSession.js';\nimport { runLocalEntityReadFunction } from './localEntityReadApi.js';\nimport {\n  countEntitiesTouchesHttpPilot,\n  runHttpPilotAwareCountEntities,"
      ],
      [
        "  const entities = new Proxy(localBase44.entities || {}, {\n    get(target, prop, receiver) {\n      if (typeof prop === 'string' && pilotSet.has(prop)) {\n        if (http.entities[prop]) return notifyEntityApiAccess(entities, prop, http.entities[prop], 'http');\n      }\n      const api = Reflect.get(target, prop, receiver);\n      return typeof prop === 'string' ? notifyEntityApiAccess(entities, prop, api) : api;\n    },\n  });\n",
        "  const entities = new Proxy(localBase44.entities || {}, {\n    get(target, prop, receiver) {\n      if (typeof prop === 'string' && pilotSet.has(prop)) {\n        if (http.entities[prop]) return http.entities[prop];\n      }\n      return Reflect.get(target, prop, receiver);\n    },\n  });\n"
      ]
    ]
  },
  "src/api/localEntityReadApi.js": {
    "hash": "3568b7616d06805265be268fc0071c048695b9e9f0f5226854b3bff3e28ee012",
    "hunks": [
      [
        "  };\n};\n\n/** Access observation is local instrumentation, never backend authorization.\n * @type {WeakMap<object, Set<(name:string, api:unknown)=>void>>} */\nconst entityApiObservers = new WeakMap();\n/** @type {WeakMap<object, Set<string>>} */\nconst observingEntityNames = new WeakMap();\n/** @type {WeakMap<object, Map<string, 'local'|'http'>>} */\nconst entityApiTransports = new WeakMap();\n\n/** HTTP owns its tenant headers and payload schema; a local stamper must not rewrite them.\n * @param {object} root @param {string} name */\nexport function isHttpEntityApiAccess(root, name) {\n  return entityApiTransports.get(root)?.get(name) === 'http';\n}\n\n/** @param {object} root @param {(name:string, api:unknown)=>void} observer */\nexport function observeEntityApiAccess(root, observer) {\n  let observers = entityApiObservers.get(root);\n  if (!observers) { observers = new Set(); entityApiObservers.set(root, observers); }\n  observers.add(observer);\n  let released = false;\n  return () => {\n    if (released) return;\n    released = true;\n    observers.delete(observer);\n    if (!observers.size) entityApiObservers.delete(root);\n  };\n}\n\n/** @template T @param {object} root @param {string} name @param {T} api\n * @param {'local'|'http'} [transport] @returns {T} */\nexport function notifyEntityApiAccess(root, name, api, transport = 'local') {\n  let transports = entityApiTransports.get(root);\n  if (!transports) { transports = new Map(); entityApiTransports.set(root, transports); }\n  transports.set(name, transport);\n  const observers = entityApiObservers.get(root);\n  if (!observers?.size) return api;\n  let active = observingEntityNames.get(root);\n  if (active?.has(name)) return api;\n  if (!active) { active = new Set(); observingEntityNames.set(root, active); }\n  active.add(name);\n  try {\n    for (const observer of [...observers]) observer(name, api);\n    return api;\n  } finally {\n    active.delete(name);\n    if (!active.size) observingEntityNames.delete(root);\n  }\n}\n\n/**\n * Mantem o carregamento tardio das entidades e a mesma instancia por nome.\n * @template T\n * @param {(entityName:string)=>T} createEntityApi\n * @returns {Record<string,T>}\n */\nexport const createLocalEntityProxy = (createEntityApi) => {\n const root = new Proxy({}, {\n  get(target, prop) {\n    if (typeof prop !== 'string') return undefined;\n    if (!target[prop]) target[prop] = createEntityApi(prop);\n    return notifyEntityApiAccess(root, prop, target[prop]);\n  },\n });\n return root;\n};\n",
        "  };\n};\n\n/**\n * Mantem o carregamento tardio das entidades e a mesma instancia por nome.\n * @template T\n * @param {(entityName: string) => T} createEntityApi\n * @returns {Record<string, T>}\n */\nexport const createLocalEntityProxy = (createEntityApi) => new Proxy({}, {\n  get(target, prop) {\n    if (typeof prop !== 'string') return undefined;\n    if (!target[prop]) target[prop] = createEntityApi(prop);\n    return target[prop];\n  },\n});\n"
      ]
    ]
  },
  "src/components/lib/GlobalContextStamp.jsx": {
    "hash": "7f0b3f715e65ef338919b232b9c880df8e843d0c23da224abb4b802f77792c67",
    "hunks": [
      [
        "import React, { useEffect } from \"react\";\nimport { base44 } from \"@/api/base44Client\";\nimport { useContextoVisual } from \"@/components/lib/useContextoVisual\";\nimport { observeEntityApiAccess, isHttpEntityApiAccess } from \"@/api/localEntityReadApi\";\n\n/**\n * GlobalContextStamp",
        "import React, { useEffect } from \"react\";\nimport { base44 } from \"@/api/base44Client\";\nimport { useContextoVisual } from \"@/components/lib/useContextoVisual\";\n\n/**\n * GlobalContextStamp"
      ],
      [
        "/** @type {WeakMap<object, {refs: Set<StampRef>, restore: () => void}>} */\nconst installedStamps = new WeakMap();\n\n/** Context stamping is not backend authorization. Existing local/HTTP proxies report lazy access.\n * @param {typeof base44.entities} root @param {StampRef} contextRef */\nexport function installContextStamp(root, contextRef) {\n  const installed = installedStamps.get(root);",
        "/** @type {WeakMap<object, {refs: Set<StampRef>, restore: () => void}>} */\nconst installedStamps = new WeakMap();\n\n/** Context stamping is not backend authorization. Only already-materialized APIs are wrapped.\n * @param {typeof base44.entities} root @param {StampRef} contextRef */\nexport function installContextStamp(root, contextRef) {\n  const installed = installedStamps.get(root);"
      ],
      [
        "  const refs = new Set([contextRef]);\n  /** @type {Array<() => void>} */\n  const restorers = [];\n  const patched = new WeakSet();\n  /** @type {undefined|(()=>void)} */\n  let stopObserving;\n  const restore = () => { stopObserving?.(); for (const undo of restorers.reverse()) undo(); };\n  const currentContext = () => {\n    const contexts = [...refs].map(ref => ref.current);\n    const current = contexts.at(-1);",
        "  const refs = new Set([contextRef]);\n  /** @type {Array<() => void>} */\n  const restorers = [];\n  const restore = () => { for (const undo of restorers.reverse()) undo(); };\n  const currentContext = () => {\n    const contexts = [...refs].map(ref => ref.current);\n    const current = contexts.at(-1);"
      ],
      [
        "    if (!filter?.group_id) throw new Error('Grupo obrigatorio para leitura contextual.');\n    return filter;\n  };\n  /** @param {string} name @param {unknown} candidate */\n  const patchApi = (name, candidate) => {\n      if (SKIP_ENTITY_PATCH.has(name) || isHttpEntityApiAccess(root, name)\n        || !candidate || typeof candidate !== 'object' || patched.has(candidate)) return;\n      // Only APIs shaped like this existing entity dictionary can be instrumented.\n      const api = root[name];\n      if (api !== candidate) throw new Error('API de entidade alterada durante instalacao.');\n      const start = restorers.length;\n      try {\n      const original = { create: api.create, bulkCreate: api.bulkCreate, update: api.update, filter: api.filter, list: api.list };\n      const create = original.create && ((dados) => original.create.call(api, stamp(dados)));\n      const bulkCreate = original.bulkCreate && ((lista) => {",
        "    if (!filter?.group_id) throw new Error('Grupo obrigatorio para leitura contextual.');\n    return filter;\n  };\n  try {\n    for (const name of Object.keys(root)) {\n      if (SKIP_ENTITY_PATCH.has(name)) continue;\n      const api = root[name];\n      if (!api || typeof api !== 'object') continue;\n      const original = { create: api.create, bulkCreate: api.bulkCreate, update: api.update, filter: api.filter, list: api.list };\n      const create = original.create && ((dados) => original.create.call(api, stamp(dados)));\n      const bulkCreate = original.bulkCreate && ((lista) => {"
      ],
      [
        "      if (update) { api.update = update; restorers.push(() => { if (api.update === update) api.update = original.update; }); }\n      if (filter) { api.filter = filter; restorers.push(() => { if (api.filter === filter) api.filter = original.filter; }); }\n      if (list) { api.list = list; restorers.push(() => { if (api.list === list) api.list = original.list; }); }\n      patched.add(candidate);\n      } catch {\n        for (const undo of restorers.splice(start).reverse()) undo();\n        throw new Error('Falha ao instalar carimbo multiempresa.');\n      }\n  };\n  try {\n    for (const name of Object.keys(root)) patchApi(name, root[name]);\n    stopObserving = observeEntityApiAccess(root, patchApi);\n  } catch {\n    restore();\n    throw new Error('Falha ao instalar carimbo multiempresa.');",
        "      if (update) { api.update = update; restorers.push(() => { if (api.update === update) api.update = original.update; }); }\n      if (filter) { api.filter = filter; restorers.push(() => { if (api.filter === filter) api.filter = original.filter; }); }\n      if (list) { api.list = list; restorers.push(() => { if (api.list === list) api.list = original.list; }); }\n    }\n  } catch {\n    restore();\n    throw new Error('Falha ao instalar carimbo multiempresa.');"
      ]
    ]
  }
};
export function consolidation81Remainder(file,text,verify=true){return exactSourceRemainder(file,text,consolidation81Hunks[file],verify); }
export function clienteConferenciaRemainder(file,text,verify=true){return exactSourceRemainder(file,text,clienteConferenciaHunks[file],verify); }
function exactSourceRemainder(file,text,entry,verify){
 if(!entry)return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before] of entry.hunks){assert.equal(source.split(after).length,2,file+': exact identity/checksum hunk');source=source.replace(after,before);}
 if(verify)assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.hash,file+': entire previous source');
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}

export const clienteConferenciaHunks={
  "server/src/api/router.ts": {
    "hash": "073952b5b23b414dd4e6686000f8158c036cc1feb39bbdf311a46bce2e9b21a5",
    "hunks": [
      [
        "    } catch (error) {\n      next(error);\n    }\n  });\n\n  router.post('/api/v1/clientes/conferencia-legado', requireTenantScope, async (req, res, next) => {\n    try {\n      if (req.authVerified !== true) throw new AppError(401, 'AUTH_REQUIRED', 'Verified Supabase session required');\n      res.set('cache-control', 'no-store');\n      res.json({ data: await service.conferirLegado(ctxFromReq(req), req.body) });\n    } catch (error) { next(error); }\n  });\n\n  router.get('/api/v1/clientes/sugestao-vinculo', requireTenantScope, async (req, res, next) => {\n",
        "    } catch (error) {\n      next(error);\n    }\n  });\n\n  router.get('/api/v1/clientes/sugestao-vinculo', requireTenantScope, async (req, res, next) => {\n"
      ],
      [
        "        clienteEmpresaId: typeof req.query.clienteEmpresaId === 'string' ? req.query.clienteEmpresaId : undefined,\n        clienteId: typeof req.query.clienteId === 'string'\n          ? req.query.clienteId\n          : (typeof req.query.cliente_id === 'string' ? req.query.cliente_id : undefined),\n        tipoOperacao: typeof req.query.tipoOperacao === 'string' ? req.query.tipoOperacao : undefined,\n",
        "        clienteEmpresaId: typeof req.query.clienteEmpresaId === 'string' ? req.query.clienteEmpresaId : undefined,\n        tipoOperacao: typeof req.query.tipoOperacao === 'string' ? req.query.tipoOperacao : undefined,\n"
      ]
    ]
  },
  "src/api/httpApiClient.js": {
    "hash": "c0350d35d527c4af546efc459f7b8566377537a5c2870b1a274480be0c56b4c1",
    "hunks": [
      [
        "    /** @param {{ limit?: number, offset?: number, search?: string, status?: string, clienteEmpresaId?: string, clienteId?: string, tipoOperacao?: string, signal?: AbortSignal }} [options] */\n    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, clienteId, tipoOperacao, signal } = {}) {\n      return request('/api/v1/pedidos', { query: { limit, offset, search, status, clienteEmpresaId, clienteId, tipoOperacao }, signal, unwrap: false });\n    },\n",
        "    /** @param {{ limit?: number, offset?: number, search?: string, status?: string, clienteEmpresaId?: string, tipoOperacao?: string, signal?: AbortSignal }} [options] */\n    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, tipoOperacao, signal } = {}) {\n      return request('/api/v1/pedidos', { query: { limit, offset, search, status, clienteEmpresaId, tipoOperacao }, signal, unwrap: false });\n    },\n"
      ],
      [
        "import { toClienteMasterHttpPayload, withHydratedContatos } from './clienteHttpPayload.js';\n",
        "import { toClienteMasterHttpPayload } from './clienteHttpPayload.js';\n"
      ],
      [
        "    Cliente: (() => {\n      const base = createCrudEntity('/api/v1/clientes', {\n        searchKeys: ['search', 'nome', 'razao_social', 'nome_fantasia', 'documento', 'cnpj', 'codigo'],\n        // NÃO usar \"status\" aqui: filtros multiempresa / colunas status:\"Ativo\"\n        // quebravam parseAtivoQuery → ativo=false → grade vazia com API n>0.\n        ativoKeys: ['ativo', 'ativa'],\n      });\n      return {\n        ...base,\n        async get(id) {\n          return withHydratedContatos(await base.get(id));\n        },\n        async list(orderBy, limit = 100) {\n          const rows = await base.list(orderBy, limit);\n          return Array.isArray(rows) ? rows.map(withHydratedContatos) : rows;\n        },\n        async filter(query = {}, orderBy, limit = 100, skip = 0) {\n          const rows = await base.filter(query, orderBy, limit, skip);\n          return Array.isArray(rows) ? rows.map(withHydratedContatos) : rows;\n        },\n        async create(data) {\n          return withHydratedContatos(await base.create(toClienteMasterHttpPayload(data)));\n        },\n        async update(id, data) {\n          return withHydratedContatos(await base.update(id, toClienteMasterHttpPayload(data)));\n        },\n      };\n    })(),\n",
        "    Cliente: (() => {\n      const base = createCrudEntity('/api/v1/clientes', {\n        searchKeys: ['search', 'nome', 'razao_social', 'nome_fantasia', 'documento', 'cnpj', 'codigo'],\n        // NÃO usar \"status\" aqui: filtros multiempresa / colunas status:\"Ativo\"\n        // quebravam parseAtivoQuery → ativo=false → grade vazia com API n>0.\n        ativoKeys: ['ativo', 'ativa'],\n      });\n      return {\n        ...base,\n        async create(data) {\n          return base.create(toClienteMasterHttpPayload(data));\n        },\n        async update(id, data) {\n          return base.update(id, toClienteMasterHttpPayload(data));\n        },\n      };\n    })(),\n"
      ],
      [
        "          if (['1', 'true', 'yes', 'ativo', 'ativa', 'active'].includes(raw)) ativoQuery = true;\n          else if (['0', 'false', 'no', 'inativo', 'inativa', 'inactive'].includes(raw)) ativoQuery = false;\n        }\n        const exact = {};\n        if (basePath === '/api/v1/clientes') {\n          for (const key of ['documento','codigo']) {\n            if (!Object.prototype.hasOwnProperty.call(query,key)) continue;\n            const value = query[key];\n            if (typeof value !== 'string' || !value || value !== value.trim() || value.length > (key === 'documento' ? 32 : 80)\n              || (key === 'documento' && (!/^[0-9.\\/\\- ]+$/.test(value) || ![11,14].includes(value.replace(/\\D/g,'').length)))) {\n              throw createHttpError(422,{error:{code:'VALIDATION_ERROR',message:'Explicit exact selector required'}}, undefined);\n            }\n            exact[key] = value;\n          }\n        }\n        return request(basePath, {\n          query: { limit, offset, search, ativo: ativoQuery, ...exact, ...normalizeOrderByQuery(orderBy) },\n          unwrap,\n        });\n    }\n",
        "          if (['1', 'true', 'yes', 'ativo', 'ativa', 'active'].includes(raw)) ativoQuery = true;\n          else if (['0', 'false', 'no', 'inativo', 'inativa', 'inactive'].includes(raw)) ativoQuery = false;\n        }\n        return request(basePath, {\n          query: { limit, offset, search, ativo: ativoQuery, ...normalizeOrderByQuery(orderBy) },\n          unwrap,\n        });\n    }\n"
      ],
      [
        "  };\n\n  const clientes = {\n    /** Read exact cohort inside the application; never exports the session.\n     * @param {{identidades: Array<Record<string,string>>}} input\n     * @param {{signal?: AbortSignal}} [options]\n     */\n    async conferirLegado(input, { signal } = {}) {\n      const fail = (status, code) => createHttpError(status, { error: { code, message: code } }, undefined);\n      const before = Object.freeze({ ...(getScope() || {}) });\n      const matches = current => current.groupId === before.groupId && current.actorId === before.actorId\n        && (current.empresaId || null) === null && current.token === before.token;\n      if (typeof before.token !== 'string' || !before.token.trim()\n        || typeof before.groupId !== 'string' || !before.groupId.trim()\n        || typeof before.actorId !== 'string' || !before.actorId.trim() || before.empresaId) throw fail(401, 'AUTH_GROUP_REQUIRED');\n      if (!input || Object.keys(input).some(k => k !== 'identidades') || !Array.isArray(input.identidades)\n        || input.identidades.length < 1 || input.identidades.length > 100) throw fail(422, 'VALIDATION_ERROR');\n      const body = JSON.parse(JSON.stringify(input));\n      for (const item of body.identidades) {\n        if (!item || typeof item !== 'object' || Array.isArray(item)\n          || Object.keys(item).some(k => !['documento','sourceSystem','codigoLegado'].includes(k))\n          || (!item.documento && !(item.sourceSystem && item.codigoLegado))\n          || Boolean(item.sourceSystem) !== Boolean(item.codigoLegado)\n          || Object.values(item).some(v => typeof v !== 'string' || !v || v !== v.trim() || v.length > 80)\n          || (item.documento && (!/^[0-9.\\/\\- ]{1,32}$/.test(item.documento)\n            || ![11,14].includes(item.documento.replace(/\\D/g,'').length)))) throw fail(422,'VALIDATION_ERROR');\n      }\n      if (signal?.aborted) throw fail(409, 'CONTEXT_CHANGED');\n      let result, failure;\n      try { result = await request('/api/v1/clientes/conferencia-legado', { method:'POST', body, signal }, before); }\n      catch (error) { failure = error; }\n      if (signal?.aborted || !matches(getScope() || {})) throw fail(409, 'CONTEXT_CHANGED');\n      if (failure) throw failure;\n      if (!Array.isArray(result) || result.length !== body.identidades.length) throw fail(502,'INVALID_RESPONSE');\n      return result.map((row, indice) => {\n        if (row?.indice !== indice || Object.keys(row).some(k=>!['indice','documento','legado'].includes(k))) throw fail(502,'INVALID_RESPONSE');\n        const match = value => {\n          if (value === null) return null;\n          if (!value || Object.keys(value).some(k=>!['id','codigo','ativo'].includes(k))\n            || typeof value.id !== 'string' || typeof value.codigo !== 'string' || typeof value.ativo !== 'boolean') throw fail(502,'INVALID_RESPONSE');\n          return { id:value.id, codigo:value.codigo, ativo:value.ativo };\n        };\n        return { indice, documento:match(row.documento), legado:match(row.legado) };\n      });\n    },\n    /**\n     * Read-model Central Cliente 360 (opt-in UI via VITE_ERP_HTTP_CLIENTE_360).\n     * Paginação canônica por bloco: *_limit / *_offset (servidor já valida).\n",
        "  };\n\n  const clientes = {\n    /**\n     * Read-model Central Cliente 360 (opt-in UI via VITE_ERP_HTTP_CLIENTE_360).\n     * Paginação canônica por bloco: *_limit / *_offset (servidor já valida).\n"
      ],
      [
        "export const a1CertificateApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).a1Certificates;\nexport const bankStatementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).bankStatements;\nexport const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\n\nexport const clienteConferenciaApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).clientes;\n",
        "export const a1CertificateApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).a1Certificates;\nexport const bankStatementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).bankStatements;\nexport const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\n"
      ]
    ]
  },
  "server/src/services/clienteService.ts": {
    "hash": "87be7feaf5b33181ca9c3f4aa0dcfc3f2261a52280d399f7e951b56a6c9ce00d",
    "hunks": [
      [
        "import { conferirClientesLegado } from './clienteConferencia.js';\nimport type { DbQueryExecutor } from '../db/client.js';\nimport type { AuditRepository, RequestContext } from '../audit/types.js';\nimport { sanitizeClienteAudit } from '../audit/clienteAuditSnapshot.js';\n",
        "import type { DbQueryExecutor } from '../db/client.js';\nimport type { AuditRepository, RequestContext } from '../audit/types.js';\nimport { sanitizeClienteAudit } from '../audit/clienteAuditSnapshot.js';\n"
      ],
      [
        "      tabelaPrecoRepo,\n      condicaoPagamentoRepo,\n    );\n  }\n\n  conferirLegado(ctx: RequestContext, input: unknown) {\n    return conferirClientesLegado(this.repo, this.rbacGuard, ctx, input);\n  }\n\n  async list(ctx: RequestContext, options: ClienteListOptions = {}) {\n",
        "      tabelaPrecoRepo,\n      condicaoPagamentoRepo,\n    );\n  }\n\n  async list(ctx: RequestContext, options: ClienteListOptions = {}) {\n"
      ]
    ]
  },
  "tests/cursor-identidade-consolidacao.test.js": {
    "hash": "53ed9f426d401e667420af481766664c1eed030fcaa592b351f875833368bd40",
    "hunks": [
      [
        "const markup = (component, props) => renderToStaticMarkup(React.createElement(component, props));\n\n/** Keep-both #439: aplica chrome sky+windowMode ao golden ID-only (handlers/RBAC intactos). */\nfunction applyCentroOperacaoSkyChrome(golden) {\n  let out = golden;\n  const swaps = [\n    [\n      'data-action=\"editar-nome-centro-operacao\" data-sensitive />',\n      'data-action=\"editar-nome-centro-operacao\" data-sensitive className=\"border-sky-100\" />',\n    ],\n    [\n      'data-action=\"selecionar-tipo-centro-operacao\" data-sensitive><SelectValue />',\n      'data-action=\"selecionar-tipo-centro-operacao\" data-sensitive className=\"border-sky-100\"><SelectValue />',\n    ],\n    [\n      'data-action=\"selecionar-responsavel-centro-operacao\" data-sensitive><SelectValue placeholder=\"Selecione o responsavel\" />',\n      'data-action=\"selecionar-responsavel-centro-operacao\" data-sensitive className=\"border-sky-100\"><SelectValue placeholder=\"Selecione o responsavel\" />',\n    ],\n    [\n      '<Card className=\"border-green-200 bg-green-50\"><CardContent className=\"p-3\"><div className=\"flex items-center gap-2\"><MapPin className=\"w-4 h-4 text-green-600\" />',\n      '<Card className=\"border-sky-200 bg-sky-50\"><CardContent className=\"p-3\"><div className=\"flex items-center gap-2\"><MapPin className=\"w-4 h-4 text-sky-600\" />',\n    ],\n    [\n      '<div className=\"flex items-center space-x-2 p-3 border rounded-lg\">',\n      '<div className=\"flex items-center space-x-2 p-3 border border-sky-100 rounded-lg\">',\n    ],\n    [\n      'data-action=\"editar-observacoes-centro-operacao\" data-sensitive />',\n      'data-action=\"editar-observacoes-centro-operacao\" data-sensitive className=\"border-sky-100\" />',\n    ],\n    [\n      '<div className=\"flex justify-end gap-3 pt-4 border-t\">\\n        <Button type=\"submit\" disabled={isSubmitting || !contextoValido || !podeSalvar} className=\"bg-blue-600 hover:bg-blue-700\"',\n      '<div className=\"flex justify-end gap-3 pt-4 border-t border-sky-100\">\\n        <Button type=\"submit\" disabled={isSubmitting || !contextoValido || !podeSalvar} className=\"bg-sky-600 hover:bg-sky-700\"',\n    ],\n    [\n      \"{isSubmitting ? 'Salvando...' : (dadosIniciais ? 'Salvar' : 'Criar Centro')}\",\n      \"{isSubmitting ? 'Salvando...' : (dadosIniciais?.id ? 'Salvar' : 'Criar Centro')}\",\n    ],\n  ];\n  for (const [before, after] of swaps) {\n    assert.equal(out.split(before).length, 2, `CentroOperacao sky swap missing: ${before.slice(0, 48)}`);\n    out = out.replace(before, after);\n  }\n  const oldReturn = `  return (\n    <form onSubmit={handleSubmit} className=\"space-y-4\">`;\n  const newReturn = `  const form = (\n    <form onSubmit={handleSubmit} className=\"space-y-4\">`;\n  assert.equal(out.split(oldReturn).length, 2);\n  out = out.replace(oldReturn, newReturn);\n  const oldClose = `    </form>\n  );\n}`;\n  const newClose = `    </form>\n  );\n\n  if (windowMode) {\n    return (\n      <div className=\"w-full h-full overflow-auto bg-white p-6\">\n        <div className=\"max-w-4xl mx-auto\">\n          <div className=\"flex items-center gap-3 mb-6 pb-4 border-b bg-gradient-to-r from-sky-50 to-sky-100 -mx-6 px-6 py-4\">\n            <h2 className=\"text-2xl font-bold text-slate-900\">\n              {dadosIniciais?.id ? 'Editar Centro de Operação' : 'Novo Centro de Operação'}\n            </h2>\n          </div>\n          {dadosIniciais?.id ? (\n            <p className=\"text-xs text-slate-500 mb-4\">\n              ID técnico: <span className=\"font-mono\">{String(dadosIniciais.id)}</span>\n            </p>\n          ) : null}\n          {form}\n        </div>\n      </div>\n    );\n  }\n\n  return form;\n}`;\n  assert.equal(out.split(oldClose).length, 2);\n  out = out.replace(oldClose, newClose);\n  return out;\n}\n\n",
        "const markup = (component, props) => renderToStaticMarkup(React.createElement(component, props));\n\n"
      ],
      [
        "      if (name === 'CentroOperacao') {\n        // #439 sky windowMode — deltas documentados (não pin cego). Golden e36231b3 + chrome.\n        expected = applyCentroOperacaoSkyChrome(expected);\n      }\n",
        ""
      ],
      [
        "// Coorte ID-only restante (golden e36231b3). Operador/Condicao/MoedaIndice/ContatoB2B\n// graduaram para useCadastroReopenOnIdentity — cobertos no teste seguinte.\nconst forms = ['CadastroFiscal', 'CentroOperacao', 'GrupoEmpresarial', 'Usuario',\n  'ConfiguracaoBoletos', 'Webhook'];\nconst graduatedReopen = {\n  OperadorCaixa: 'operadorBoundId',\n  CondicaoComercial: 'condicaoBoundId',\n  MoedaIndice: 'moedaBoundId',\n  ContatoB2B: 'contatoBoundId',\n};\n",
        "const forms = ['CadastroFiscal', 'ContatoB2B', 'CentroOperacao', 'GrupoEmpresarial', 'Usuario', 'OperadorCaixa',\n  'MoedaIndice', 'CondicaoComercial', 'ConfiguracaoBoletos', 'Webhook'];\n"
      ],
      [
        "test('remaining ID-only additions retain every existing handler context permission and field', () => {",
        "test('ten ID-only additions retain every existing handler context permission and field', () => {"
      ],
      [
        "const reopened = ['CadastroFiscal', 'CentroOperacao', 'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'].includes(name);",
        "const reopened = ['CadastroFiscal', 'CentroOperacao', 'ContatoB2B', 'GrupoEmpresarial', 'Usuario', 'ConfiguracaoBoletos', 'Webhook'].includes(name);"
      ],
      [
        "\n\ntest('OperadorCaixa CondicaoComercial MoedaIndice e ContatoB2B graduaram ID-only → reopen canônico com boundId', () => {\n  for (const [name, boundId] of Object.entries(graduatedReopen)) {\n    assert.equal(Object.hasOwn(MASTER_CODE_SPECS, name), false, `Master code contract must not be hidden: ${name}`);\n    const path = `src/components/cadastros/${name}Form.jsx`;\n    const source = read(path);\n    const ast = tree(path, source);\n    assert.match(source, /useCadastroReopenOnIdentity/);\n    assert.match(source, new RegExp(boundId));\n    assert.doesNotMatch(source, /prevUpdatedRef/);\n    assert.doesNotMatch(source, /useCadastroRecordState/);\n    let fields = 0;\n    const visit = (node) => {\n      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'CadastroCodigoRegistroField') {\n        const attrs = node.attributes.properties;\n        assert.ok(attrs.some(a => a.name?.getText(ast) === 'idOnly' && !a.initializer));\n        assert.equal(attrs.find(a => a.name?.getText(ast) === 'entityId').initializer.expression.getText(ast), boundId);\n        assert.equal(attrs.find(a => a.name?.getText(ast) === 'hasId').initializer.expression.getText(ast), `Boolean(${boundId})`);\n        fields++;\n      }\n      ts.forEachChild(node, visit);\n    };\n    visit(ast);\n    assert.equal(fields, 1, name);\n  }\n});\n",
        "\n"
      ],
      [
        "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n",
        "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n"
      ],
      [
        "\ntest('operational routes and sensitive infrastructure remain unchanged by this cohort', () => {\n  for (const path of ['server/src/app.ts', 'server/src/api/router.ts',\n    'src/api/localCadastroMasterPolicy.js']) assert.equal(clienteConferenciaRemainder(path, read(path)), head(path));\n  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));\n  const path = 'src/components/cadastros/cadastroEditLoadPolicy.js';\n  const annotation = ' * @param {{entityName?: string, expectedId?: string | number,\\n'\n",
        "\ntest('operational routes and sensitive infrastructure remain unchanged by this cohort', () => {\n  for (const path of ['server/src/app.ts', 'server/src/api/router.ts',\n    'src/api/localCadastroMasterPolicy.js']) assert.equal(read(path), head(path));\n  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));\n  const path = 'src/components/cadastros/cadastroEditLoadPolicy.js';\n  const annotation = ' * @param {{entityName?: string, expectedId?: string | number,\\n'\n"
      ]
    ]
  },
  "tests/financial-movement-http-client.test.js": {
    "hash": "4fb977deb5c015f6cf295e723f04a66e82ed9baed8d06218ece00ba264fbab1c",
    "hunks": [
      [
        "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n",
        "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n"
      ],
      [
        " [\"  return execute;\\n}\\n\\n/** @param {{getScope:()=>BankScope,request:(path:string,options:BankRequestOptions,scope:Readonly<BankScope>)=>Promise<unknown>}} deps */\\nexport function createBankStatementApi(deps) {\\n  const { request } = deps;\\n  const execute = createBankRequestExecutor(deps);\\n\",'']];\n for(const [after,before] of changes){assert.equal(bank.split(after).length,2);bank=bank.replace(after,before);}\n assert.equal(hash(bank),'145bf54405c26705b0e6f93bd93a391051cba7dbc4c97d13f6de59ba4b0c5131');\n let http=clienteConferenciaRemainder('src/api/httpApiClient.js',read('src/api/httpApiClient.js'));\n for(const addition of [\"import { createFinancialMovementApi } from './financialMovementHttp.js';\\n\",'    financialMovements: createFinancialMovementApi({ getScope, request }),\\n',\"export const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\\n\"]){assert.equal(http.split(addition).length,2);http=http.replace(addition,'');}\n assert.equal(hash(http),'6552582391e26c892325ac16955df5d76426e9321565cad61d12361cb9398449');\n});\n",
        " [\"  return execute;\\n}\\n\\n/** @param {{getScope:()=>BankScope,request:(path:string,options:BankRequestOptions,scope:Readonly<BankScope>)=>Promise<unknown>}} deps */\\nexport function createBankStatementApi(deps) {\\n  const { request } = deps;\\n  const execute = createBankRequestExecutor(deps);\\n\",'']];\n for(const [after,before] of changes){assert.equal(bank.split(after).length,2);bank=bank.replace(after,before);}\n assert.equal(hash(bank),'145bf54405c26705b0e6f93bd93a391051cba7dbc4c97d13f6de59ba4b0c5131');\n let http=read('src/api/httpApiClient.js');\n for(const addition of [\"import { createFinancialMovementApi } from './financialMovementHttp.js';\\n\",'    financialMovements: createFinancialMovementApi({ getScope, request }),\\n',\"export const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\\n\"]){assert.equal(http.split(addition).length,2);http=http.replace(addition,'');}\n assert.equal(hash(http),'6552582391e26c892325ac16955df5d76426e9321565cad61d12361cb9398449');\n});\n"
      ]
    ]
  },
  "tests/guard-ofx-a1-consolidacao.test.js": {
    "hash": "3674813403e8f2b9c83acd86bd96a0a7b293d47bfea5dff047b1154da3bf6219",
    "hunks": [
      [
        "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n",
        "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n"
      ],
      [
        "});\n\ntest('operational app router and Cursor recovery remain unchanged', () => {\n  for (const path of ['server/src/app.ts', 'server/src/api/router.ts']) assert.equal(clienteConferenciaRemainder(path, read(path)), head(path));\n  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));\n});\n\n",
        "});\n\ntest('operational app router and Cursor recovery remain unchanged', () => {\n  for (const path of ['server/src/app.ts', 'server/src/api/router.ts']) assert.equal(read(path), head(path));\n  assert.equal(httpMirrorAnnotationRemainder(read('src/api/localBase44Client.js')), head('src/api/localBase44Client.js'));\n});\n\n"
      ]
    ]
  },
  "tests/guard-session-http-ia-consolidacao.test.js": {
    "hash": "7cbeee84073a38653fd28786438bbcb87450af172da5ec3436e4dba87e98e938",
    "hunks": [
      [
        "import { execFileSync } from 'node:child_process';\nimport ts from 'typescript';\nimport { httpMirrorAnnotationRemainder } from './helpers/httpMirrorAnnotationRemainder.js';\nimport {consolidation81Remainder, clienteConferenciaRemainder} from './helpers/consolidation81Remainder.js';\nimport { createHttpApiClient, isHttpApiError, readHttpErrorBodyCode } from '../src/api/httpApiClient.js';\nimport { validarSugestoesProdutosIA, validarRespostaFiscalIA } from '../src/components/lib/iaResponsePolicy.js';\nimport { validarAnaliseAtendimentoIA, validarIntentAtendimentoIA } from '../src/components/lib/atendimentoIaResponsePolicy.js';\n",
        "import { execFileSync } from 'node:child_process';\nimport ts from 'typescript';\nimport { httpMirrorAnnotationRemainder } from './helpers/httpMirrorAnnotationRemainder.js';\nimport {consolidation81Remainder} from './helpers/consolidation81Remainder.js';\nimport { createHttpApiClient, isHttpApiError, readHttpErrorBodyCode } from '../src/api/httpApiClient.js';\nimport { validarSugestoesProdutosIA, validarRespostaFiscalIA } from '../src/components/lib/iaResponsePolicy.js';\nimport { validarAnaliseAtendimentoIA, validarIntentAtendimentoIA } from '../src/components/lib/atendimentoIaResponsePolicy.js';\n"
      ],
      [
        "  const path = 'src/api/httpApiClient.js';\n  for (const name of ['expedicao', 'oportunidades', 'clientes', 'entityRoutes', 'pedidos', 'orcamentos']) {\n    const emit = text => ts.transpileModule(`const ${text};`, { compilerOptions: { target: ts.ScriptTarget.ESNext, removeComments: true } }).outputText;\n    assert.equal(emit(declaration(clienteConferenciaRemainder(path,read(path)), name)), emit(declaration(head(path), name)));\n  }\n  const facade = 'src/api/base44Client.js';\n  for (const name of ['isHttpExpedicaoEnabled', 'isHttpExpedicaoMode']) {\n",
        "  const path = 'src/api/httpApiClient.js';\n  for (const name of ['expedicao', 'oportunidades', 'clientes', 'entityRoutes', 'pedidos', 'orcamentos']) {\n    const emit = text => ts.transpileModule(`const ${text};`, { compilerOptions: { target: ts.ScriptTarget.ESNext, removeComments: true } }).outputText;\n    assert.equal(emit(declaration(read(path), name)), emit(declaration(head(path), name)));\n  }\n  const facade = 'src/api/base44Client.js';\n  for (const name of ['isHttpExpedicaoEnabled', 'isHttpExpedicaoMode']) {\n"
      ],
      [
        "});\n\ntest('operational router app and migration executor remain unchanged', () => {\n  for (const path of ['server/src/app.ts', 'server/src/api/router.ts']) assert.equal(clienteConferenciaRemainder(path, read(path)), head(path));\n  assert.ok(!read('server/src/api/router.ts').includes('mountIaContextualRoutes'));\n});\n\n",
        "});\n\ntest('operational router app and migration executor remain unchanged', () => {\n  for (const path of ['server/src/app.ts', 'server/src/api/router.ts']) assert.equal(read(path), head(path));\n  assert.ok(!read('server/src/api/router.ts').includes('mountIaContextualRoutes'));\n});\n\n"
      ]
    ]
  },
  "tests/legado-importador-consolidacao.test.js": {
    "hash": "a43fbcd76f833dbf498bd96e4d26060d18b50fea9cd553af0b9a19524c996a3f",
    "hunks": [
      [
        "import { clienteConferenciaRemainder } from './helpers/consolidation81Remainder.js';\nimport assert from 'node:assert/strict';\nimport test from 'node:test';\nimport fs from 'node:fs';\n",
        "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport fs from 'node:fs';\n"
      ],
      [
        "    await assert.rejects(persistirEnderecoClienteGrupoLegado(source,{transaction}),/LEGACY_ADDRESS_SCOPE_INVALID/);\n  }\n  assert.equal(permissionCalls,0);\n  assert.equal(clienteConferenciaRemainder('server/src/api/router.ts',fs.readFileSync('server/src/api/router.ts','utf8')),readHead('server/src/api/router.ts'));\n  assert.equal(execFileSync('git',['diff',\"e36231b3a7e546aa9fd2529abb8d5edb61d8189c\",'--','server/migrations','server/src/app.ts'],{encoding:'utf8'}),'');\n});\n",
        "    await assert.rejects(persistirEnderecoClienteGrupoLegado(source,{transaction}),/LEGACY_ADDRESS_SCOPE_INVALID/);\n  }\n  assert.equal(permissionCalls,0);\n  assert.equal(execFileSync('git',['diff',\"e36231b3a7e546aa9fd2529abb8d5edb61d8189c\",'--','server/migrations','server/src/app.ts','server/src/api/router.ts'],{encoding:'utf8'}),'');\n});\n"
      ]
    ]
  },
  "server/tests/bulk-consolidacao.test.ts": {
    "hash": "910dd442f00405b6c40b36c76093abeb79869bc15f32a5e3df72b95cdc4b4885",
    "hunks": [
      [
        "import { clienteConferenciaRemainder } from '../../tests/helpers/consolidation81Remainder.js';\nimport test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\n",
        "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\n"
      ],
      [
        "  const path = 'src/services/clienteService.ts';\n  const original = execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:server/${path}`], { encoding: 'utf8' });\n  const parse = (source: string) => ts.createSourceFile(path, source.replaceAll('\\r\\n', '\\n'), ts.ScriptTarget.Latest, true);\n  const before = parse(original), after = parse(clienteConferenciaRemainder('server/'+path, fs.readFileSync(path, 'utf8')));\n  const members = (file: ts.SourceFile) => {\n    const declaration = file.statements.find(ts.isClassDeclaration);\n    assert(declaration);\n",
        "  const path = 'src/services/clienteService.ts';\n  const original = execFileSync('git', ['show', `e36231b3a7e546aa9fd2529abb8d5edb61d8189c:server/${path}`], { encoding: 'utf8' });\n  const parse = (source: string) => ts.createSourceFile(path, source.replaceAll('\\r\\n', '\\n'), ts.ScriptTarget.Latest, true);\n  const before = parse(original), after = parse(fs.readFileSync(path, 'utf8'));\n  const members = (file: ts.SourceFile) => {\n    const declaration = file.statements.find(ts.isClassDeclaration);\n    assert(declaration);\n"
      ]
    ]
  }
};
