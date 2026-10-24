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
export function consolidation81Remainder(file,text,verify=true){
 const entry=consolidation81Hunks[file];if(!entry)return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before] of entry.hunks){assert.equal(source.split(after).length,2,file+': exact identity/checksum hunk');source=source.replace(after,before);}
 if(verify)assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.hash,file+': entire previous source');
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}
