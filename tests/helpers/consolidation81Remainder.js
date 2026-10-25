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
      ]
    ]
  },
  "src/api/httpApiClient.js": {
    "hash": "c0350d35d527c4af546efc459f7b8566377537a5c2870b1a274480be0c56b4c1",
    "hunks": [
      [
        "          if (['1', 'true', 'yes', 'ativo', 'ativa', 'active'].includes(raw)) ativoQuery = true;\n          else if (['0', 'false', 'no', 'inativo', 'inativa', 'inactive'].includes(raw)) ativoQuery = false;\n        }\n        const exact = {};\n        if (basePath === '/api/v1/clientes') {\n          for (const key of ['documento','codigo']) {\n            if (!Object.prototype.hasOwnProperty.call(query,key)) continue;\n            const value = query[key];\n            if (typeof value !== 'string' || !value || value !== value.trim() || value.length > (key === 'documento' ? 32 : 80)\n              || (key === 'documento' && (!/^[0-9.\\/\\- ]+$/.test(value) || ![11,14].includes(value.replace(/\\D/g,'').length)))) {\n              throw createHttpError(422,{error:{code:'VALIDATION_ERROR',message:'Explicit exact selector required'}}, undefined);\n            }\n            exact[key] = value;\n          }\n        }\n        return request(basePath, {\n          query: { limit, offset, search, ativo: ativoQuery, ...exact, ...normalizeOrderByQuery(orderBy) },\n          unwrap,\n        });\n    }\n",
        "          if (['1', 'true', 'yes', 'ativo', 'ativa', 'active'].includes(raw)) ativoQuery = true;\n          else if (['0', 'false', 'no', 'inativo', 'inativa', 'inactive'].includes(raw)) ativoQuery = false;\n        }\n        return request(basePath, {\n          query: { limit, offset, search, ativo: ativoQuery, ...normalizeOrderByQuery(orderBy) },\n          unwrap,\n        });\n    }\n"
      ],
      [
        "  };\n\n  const clientes = {\n    /** Read exact cohort inside the application; never exports the session.\n     * @param {{identidades: Array<Record<string,string>>}} input\n     * @param {{signal?: AbortSignal}} [options]\n     */\n    async conferirLegado(input, { signal } = {}) {\n      const fail = (status, code) => createHttpError(status, { error: { code, message: code } }, undefined);\n      const before = Object.freeze({ ...(getScope() || {}) });\n      const matches = current => current.groupId === before.groupId && current.actorId === before.actorId\n        && (current.empresaId || null) === null && current.token === before.token;\n      if (!before.token || !before.groupId || !before.actorId || before.empresaId) throw fail(401, 'AUTH_GROUP_REQUIRED');\n      if (!input || Object.keys(input).some(k => k !== 'identidades') || !Array.isArray(input.identidades)\n        || input.identidades.length < 1 || input.identidades.length > 100) throw fail(422, 'VALIDATION_ERROR');\n      const body = JSON.parse(JSON.stringify(input));\n      for (const item of body.identidades) {\n        if (!item || typeof item !== 'object' || Array.isArray(item)\n          || Object.keys(item).some(k => !['documento','sourceSystem','codigoLegado'].includes(k))\n          || (!item.documento && !(item.sourceSystem && item.codigoLegado))\n          || Boolean(item.sourceSystem) !== Boolean(item.codigoLegado)\n          || Object.values(item).some(v => typeof v !== 'string' || !v || v !== v.trim() || v.length > 80)\n          || (item.documento && (!/^[0-9.\\/\\- ]{1,32}$/.test(item.documento)\n            || ![11,14].includes(item.documento.replace(/\\D/g,'').length)))) throw fail(422,'VALIDATION_ERROR');\n      }\n      if (signal?.aborted) throw fail(409, 'CONTEXT_CHANGED');\n      let result, failure;\n      try { result = await request('/api/v1/clientes/conferencia-legado', { method:'POST', body, signal }, before); }\n      catch (error) { failure = error; }\n      if (signal?.aborted || !matches(getScope() || {})) throw fail(409, 'CONTEXT_CHANGED');\n      if (failure) throw failure;\n      if (!Array.isArray(result) || result.length !== body.identidades.length) throw fail(502,'INVALID_RESPONSE');\n      return result.map((row, indice) => {\n        if (row?.indice !== indice || Object.keys(row).some(k=>!['indice','documento','legado'].includes(k))) throw fail(502,'INVALID_RESPONSE');\n        const match = value => {\n          if (value === null) return null;\n          if (!value || Object.keys(value).some(k=>!['id','codigo','ativo'].includes(k))\n            || typeof value.id !== 'string' || typeof value.codigo !== 'string' || typeof value.ativo !== 'boolean') throw fail(502,'INVALID_RESPONSE');\n          return { id:value.id, codigo:value.codigo, ativo:value.ativo };\n        };\n        return { indice, documento:match(row.documento), legado:match(row.legado) };\n      });\n    },\n    /**\n     * Read-model Central Cliente 360 (opt-in UI via VITE_ERP_HTTP_CLIENTE_360).\n     * Paginação canônica por bloco: *_limit / *_offset (servidor já valida).\n",
        "  };\n\n  const clientes = {\n    /**\n     * Read-model Central Cliente 360 (opt-in UI via VITE_ERP_HTTP_CLIENTE_360).\n     * Paginação canônica por bloco: *_limit / *_offset (servidor já valida).\n"
      ],
      [
        "export const a1CertificateApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).a1Certificates;\nexport const bankStatementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).bankStatements;\nexport const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\n\nexport const clienteConferenciaApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).clientes;\n",
        "export const a1CertificateApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).a1Certificates;\nexport const bankStatementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).bankStatements;\nexport const financialMovementApi = createHttpApiClient({ getScope: () => readErpHttpSession() || {} }).financialMovements;\n"
      ]
    ]
  }
};
