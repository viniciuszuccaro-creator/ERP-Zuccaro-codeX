import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fornecedorHttpRemainder } from './fornecedorHttpRemainder.js';
export const consolidation81Hunks={
  "src/api/base44Client.js": {
    "hash": "5f36584a17fce4cfe46b1298942caae2575dd7866e77ff0a20d9c8daa4e16b6b",
    "hunks": [
      [
        // Achado 6694327032 / #591: HTTP não grava upsertConfig no store local.
        "        }\n        // Parecer 6694327032: em HTTP, upsertConfig não pode gravar no store local\n        // e fingir sucesso remoto. Modo local explícito permanece em resolveBase44Client.\n        if (name === 'upsertConfig') {\n          throw Object.assign(new Error('UPSERT_CONFIG_HTTP_UNAVAILABLE'), {\n            code: 'UPSERT_CONFIG_HTTP_UNAVAILABLE',\n            status: 503,\n          });\n        }\n        return localBase44.functions.invoke(name, payload);",
        "        }\n        return localBase44.functions.invoke(name, payload);"
      ],
      [
        "} from './localAuthSessionPolicy.js';\nimport { createHttpApiClient } from './httpApiClient.js';\nimport { HTTP_CONTEXT_CHANGED } from './erpHttpSession.js';\nimport { runLocalEntityReadFunction, notifyEntityApiAccess } from './localEntityReadApi.js';\nimport {\n  countEntitiesTouchesHttpPilot,\n  runHttpPilotAwareCountEntities,",
        "} from './localAuthSessionPolicy.js';\nimport { createHttpApiClient } from './httpApiClient.js';\nimport { HTTP_CONTEXT_CHANGED } from './erpHttpSession.js';\nimport { runLocalEntityReadFunction } from './localEntityReadApi.js';\nimport {\n  countEntitiesTouchesHttpPilot,\n  runHttpPilotAwareCountEntities,"
      ],
      [
        "  const entities = new Proxy(localBase44.entities || {}, {\n    get(target, prop, receiver) {\n      if (typeof prop === 'string' && pilotSet.has(prop)) {\n        if (http.entities[prop]) return notifyEntityApiAccess(entities, prop, http.entities[prop], 'http');\n      }\n      const api = Reflect.get(target, prop, receiver);\n      return typeof prop === 'string' ? notifyEntityApiAccess(entities, prop, api) : api;\n    },\n  });\n",
        "  const entities = new Proxy(localBase44.entities || {}, {\n    get(target, prop, receiver) {\n      if (typeof prop === 'string' && pilotSet.has(prop)) {\n        if (http.entities[prop]) return http.entities[prop];\n      }\n      return Reflect.get(target, prop, receiver);\n    },\n  });\n"
      ],
      [
        // #591: listagem Cliente via BFF (fonte local ≠ contagem API).
        "import {\n  HTTP_PILOT_ENTITIES,\n  isHttpClienteListEnabled,\n  isHttpExpedicaoEnabled as expedicaoFlag,\n  resolveErpApiBaseUrl,\n  resolveErpBackendMode,\n  resolveHttpPilotEntities,\n} from './runtimeBackend.js';",
        "import {\n  HTTP_PILOT_ENTITIES,\n  isHttpExpedicaoEnabled as expedicaoFlag,\n  resolveErpApiBaseUrl,\n  resolveErpBackendMode,\n  resolveHttpPilotEntities,\n} from './runtimeBackend.js';"
      ],
      [
        "export const isHttpCliente360Enabled = isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_CLIENTE_360 === 'true';\n/** Listagem Cliente via BFF (CLIENTE_360 ou CLIENTE). Sem flag: store local ≠ API. */\nexport { isHttpClienteListEnabled };\n/** @type {boolean} */\nexport const isHttpClienteListMode = isHttpClienteListEnabled(import.meta.env);\n",
        "export const isHttpCliente360Enabled = isHttpBackendMode && import.meta.env.VITE_ERP_HTTP_CLIENTE_360 === 'true';\n"
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
export function clienteConferenciaRemainder(file,text,verify=true){
 return clienteConferenciaHistoricalRemainder(file,clienteSelectedReferenceRemainder(file,text,verify),verify);
}
export function clienteSelectedReferenceRemainder(file,text,verify=true){return exactSourceRemainder(file,fornecedorHttpRemainder(file,text),clienteSelectedReferenceHunks[file],verify);}
export function clienteConferenciaHistoricalRemainder(file,text,verify=true){return exactSourceRemainder(file,text,clienteConferenciaHunks[file],verify);}
function exactSourceRemainder(file,text,entry,verify){
 if(!entry)return text;
 let source=text.replace(/\r\n/g,'\n');
 for(const [after,before] of entry.hunks){assert.equal(source.split(after).length,2,file+': exact identity/checksum hunk');source=source.replace(after,()=>before);}
 if(verify)assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.hash,file+': entire previous source');
 return text.includes('\r\n')?source.replace(/\n/g,'\r\n'):source;
}

export const clienteConferenciaHunks={
  "server/src/api/router.ts": {
    "hash": "073952b5b23b414dd4e6686000f8158c036cc1feb39bbdf311a46bce2e9b21a5",
    "hunks": [
      [
        "router.get('/api/v1/clientes', requireTenantScope, async (req, res, next) => {\n    try {\n      const operacao = parseProdutoOperation(req.query.operacao);\n      if (operacao) {\n        if (!operationalClienteQuery.safeParse(req.query).success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid operational customer selector');\n        res.setHeader('Cache-Control', 'no-store');\n      }\n      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;\n      const orderBy = orderByRaw === 'nome' || orderByRaw === 'codigo' ? orderByRaw : undefined;\n      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;\n      const orderDir = orderDirRaw === 'desc' || orderDirRaw === 'asc' ? orderDirRaw : undefined;\n      const page = await service.list(ctxFromReq(req), {\n        operacao,\n        ativo: parseAtivoQuery(req.query.ativo),\n        search: req.query.search ? String(req.query.search) : undefined,\n        codigo: req.query.codigo ? String(req.query.codigo) : undefined,\n        documento: req.query.documento ? String(req.query.documento) : undefined,\n        orderBy,\n        orderDir,\n        limit: req.query.limit ? Number(req.query.limit) : undefined,\n        offset: req.query.offset ? Number(req.query.offset) : undefined,\n      });\n      res.json(page);\n    } catch (error) {\n      next(error);\n    }\n  });\n\n",
        "router.get('/api/v1/clientes', requireTenantScope, async (req, res, next) => {\n    try {\n      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;\n      const orderBy = orderByRaw === 'nome' || orderByRaw === 'codigo' ? orderByRaw : undefined;\n      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;\n      const orderDir = orderDirRaw === 'desc' || orderDirRaw === 'asc' ? orderDirRaw : undefined;\n      const page = await service.list(ctxFromReq(req), {\n        ativo: parseAtivoQuery(req.query.ativo),\n        search: req.query.search ? String(req.query.search) : undefined,\n        codigo: req.query.codigo ? String(req.query.codigo) : undefined,\n        documento: req.query.documento ? String(req.query.documento) : undefined,\n        orderBy,\n        orderDir,\n        limit: req.query.limit ? Number(req.query.limit) : undefined,\n        offset: req.query.offset ? Number(req.query.offset) : undefined,\n      });\n      res.json(page);\n    } catch (error) {\n      next(error);\n    }\n  });\n\n"
      ],
      [
        "  const relationshipPath = '/api/v1/clientes/:clienteId/empresas';\n  const operationalClienteQuery = z.object({\n    operacao: z.literal('true'), ativo: z.literal('true').optional(),\n    search: z.string().trim().max(200).optional(),\n    order_by: z.enum(['codigo','nome']).optional(), order_dir: z.enum(['asc','desc']).optional(),\n    limit: z.string().regex(/^[1-9]\\d{0,2}$/).transform(Number).refine(n => n <= 200).optional(),\n    offset: z.string().regex(/^(0|[1-9]\\d*)$/).transform(Number).refine(Number.isSafeInteger).optional(),\n  }).strict();",
        "  const relationshipPath = '/api/v1/clientes/:clienteId/empresas';"
      ],
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
  "server/src/services/clienteService.ts": {
    "hash": "87be7feaf5b33181ca9c3f4aa0dcfc3f2261a52280d399f7e951b56a6c9ce00d",
    "hunks": [
      [
        "export type ClienteListOptions = {\n  operacao?: boolean;\n  ativo?: boolean;",
        "export type ClienteListOptions = {\n  ativo?: boolean;"
      ],
      [
        "    if (options.operacao) {\n      if (!ctx.empresaId) throw new AppError(422, 'CLIENTE_OPERATIONAL_SCOPE_REQUIRED', 'Active company scope required');\n      if (options.ativo === false || (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 200))\n        || (options.offset !== undefined && (!Number.isSafeInteger(options.offset) || options.offset < 0))\n        || (options.search !== undefined && (options.search.length > 200 || options.search !== options.search.trim()))) {\n        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid operational customer selector');\n      }\n      await this.tenantGuard.assertEmpresaInGroup(ctx.groupId, ctx.empresaId);\n    }\n    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);\n    const offset = Math.max(options.offset ?? 0, 0);",
        "    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);\n    const offset = Math.max(options.offset ?? 0, 0);"
      ],
      [
        "      groupId: ctx.groupId,\n      empresaId: ctx.empresaId,\n      operacao: options.operacao,\n      ativo,\n      search: options.search,",
        "      groupId: ctx.groupId,\n      empresaId: ctx.empresaId,\n      ativo,\n      search: options.search,"
      ],
      [
        "    if (options.operacao) await this.assertPermission(ctx, 'visualizar');\n    return {\n      data: page.rows,\n      meta: {",
        "    return {\n      data: page.rows,\n      meta: {"
      ],
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
      ],
      [
        "import { perfilPolicyRemainder, perfilViewerRemainder } from './helpers/perfilGateRemainder.js';\nimport { scopeListCacheRemainder } from './helpers/scopeListCacheRemainder.js';\n",
        "import { perfilPolicyRemainder, perfilViewerRemainder } from './helpers/perfilGateRemainder.js';\n"
      ],
      [
        "const path = 'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', source = clienteNavigationRemainder(perfilViewerRemainder(scopeListCacheRemainder(read(path)))), ast = tree(path, source);",
        "const path = 'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', source = clienteNavigationRemainder(perfilViewerRemainder(read(path))), ast = tree(path, source);"
      ],
      [
        "      if (name === 'GrupoEmpresarial') {\n        // Delta autorizado: Empresa via filterInContext (sem list unscoped).\n        for (const [before, after] of [\n          ['import { base44 } from \"@/api/base44Client\";\\n', ''],\n          [\n            '  const { empresaAtual, grupoAtual } = useContextoVisual();\\n',\n            '  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();\\n',\n          ],\n          [\n            '  const { data: empresas = [] } = useQuery({\\n    queryKey: [\"empresas\", groupId || \"sem-grupo\"],\\n    queryFn: () => base44.entities.Empresa.list(),\\n  });\\n',\n            \"  // Escopo multiempresa: Empresa via filterInContext (group_id). Sem list unscoped.\\n  // enabled exige contexto; erro ≠ zero KPI fabricado.\\n  const { data: empresas = [], isError: isErrorEmpresas } = useQuery({\\n    queryKey: [\\\"empresas\\\", groupId || \\\"sem-grupo\\\"],\\n    queryFn: () => filterInContext('Empresa', groupId ? { group_id: groupId } : {}, 'razao_social', 500),\\n    enabled: contextoValido,\\n  });\\n\",\n          ],\n          [\n            '            {empresasDoGrupo.length === 0 && (\\n              <p className=\"text-sm text-slate-500 text-center py-4\">\\n                Nenhuma empresa cadastrada\\n              </p>\\n            )}\\n',\n            \"            {empresasDoGrupo.length === 0 && (\\n              <p className=\\\"text-sm text-slate-500 text-center py-4\\\">\\n                {isErrorEmpresas\\n                  ? 'Contagem de empresas indisponível (erro de carga ≠ zero).'\\n                  : 'Nenhuma empresa cadastrada'}\\n              </p>\\n            )}\\n\",\n          ],\n        ]) {\n          assert.equal(expected.split(before).length, 2, `GrupoEmpresarial expected hunk missing: ${before.slice(0, 60)}`);\n          expected = expected.replace(before, after);\n        }\n      }\n",
        ""
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
  },
  "src/api/httpApiClient.js": {
    "hash": "c0350d35d527c4af546efc459f7b8566377537a5c2870b1a274480be0c56b4c1",
    "hunks": [
      ["    /**\n     * Lista canônica de locais do cliente (BFF `/clientes/:id/locais`).\n     * Leitura para Completo/Cadastros — sem storage paralelo; escrita MASTER continua fail-closed.\n     * @param {string} clienteId\n     * @param {{ limit?: number, offset?: number, ativo?: boolean, signal?: AbortSignal }} [options]\n     */\n    async listLocais(clienteId, { limit = 50, offset = 0, ativo, signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) {\n        const err = /** @type {Error & { status: number, code: string }} */ (\n          new Error('clienteId obrigatório para listLocais')\n        );\n        err.status = 422;\n        err.code = 'VALIDATION_ERROR';\n        throw err;\n      }\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        query: {\n          limit,\n          offset,\n          ...(ativo === undefined ? {} : { ativo: ativo ? 'true' : 'false' }),\n          order_by: 'nome',\n        },\n        signal,\n        unwrap: false,\n      });\n      const rows = page && typeof page === 'object' && Array.isArray(/** @type {{ data?: unknown }} */ (page).data)\n        ? /** @type {{ data: unknown[] }} */ (page).data\n        : [];\n      return rows;\n    },\n    /**\n     * Cria local canônico (POST `/clientes/:id/locais`) — sem storage paralelo.\n     * @param {string} clienteId\n     * @param {Record<string, unknown>} body\n     * @param {{ signal?: AbortSignal }} [options]\n     */\n    async createLocal(clienteId, body, { signal } = {}) {\n      const id = String(clienteId ?? '').trim();\n      if (!id) {\n        const err = /** @type {Error & { status: number, code: string }} */ (\n          new Error('clienteId obrigatório para createLocal')\n        );\n        err.status = 422;\n        err.code = 'VALIDATION_ERROR';\n        throw err;\n      }\n      const page = await request(`/api/v1/clientes/${encodeURIComponent(id)}/locais`, {\n        method: 'POST',\n        body,\n        signal,\n        unwrap: false,\n      });\n      return page && typeof page === 'object' && 'data' in /** @type {object} */ (page)\n        ? /** @type {{ data: unknown }} */ (page).data\n        : page;\n    },\n    /**\n     * Atualiza local canônico (PATCH `/clientes/:id/locais/:localId`).\n     * @param {string} clienteId\n     * @param {string} localId\n     * @param {Record<string, unknown>} body\n     * @param {{ signal?: AbortSignal }} [options]\n     */\n    async updateLocal(clienteId, localId, body, { signal } = {}) {\n      const cid = String(clienteId ?? '').trim();\n      const lid = String(localId ?? '').trim();\n      if (!cid || !lid) {\n        const err = /** @type {Error & { status: number, code: string }} */ (\n          new Error('clienteId/localId obrigatórios para updateLocal')\n        );\n        err.status = 422;\n        err.code = 'VALIDATION_ERROR';\n        throw err;\n      }\n      const page = await request(\n        `/api/v1/clientes/${encodeURIComponent(cid)}/locais/${encodeURIComponent(lid)}`,\n        { method: 'PATCH', body, signal, unwrap: false },\n      );\n      return page && typeof page === 'object' && 'data' in /** @type {object} */ (page)\n        ? /** @type {{ data: unknown }} */ (page).data\n        : page;\n    },\n    /**\n     * Soft-delete local canônico (DELETE `/clientes/:id/locais/:localId`).\n     * @param {string} clienteId\n     * @param {string} localId\n     * @param {{ signal?: AbortSignal }} [options]\n     */\n    async softDeleteLocal(clienteId, localId, { signal } = {}) {\n      const cid = String(clienteId ?? '').trim();\n      const lid = String(localId ?? '').trim();\n      if (!cid || !lid) {\n        const err = /** @type {Error & { status: number, code: string }} */ (\n          new Error('clienteId/localId obrigatórios para softDeleteLocal')\n        );\n        err.status = 422;\n        err.code = 'VALIDATION_ERROR';\n        throw err;\n      }\n      const page = await request(\n        `/api/v1/clientes/${encodeURIComponent(cid)}/locais/${encodeURIComponent(lid)}`,\n        { method: 'DELETE', signal, unwrap: false },\n      );\n      return page && typeof page === 'object' && 'data' in /** @type {object} */ (page)\n        ? /** @type {{ data: unknown }} */ (page).data\n        : page;\n    },\n    /**\n     * Substitui finalidades do local (PUT `.../finalidades`).\n     * @param {string} clienteId\n     * @param {string} localId\n     * @param {unknown} finalidades\n     * @param {{ signal?: AbortSignal }} [options]\n     */\n    async setFinalidades(clienteId, localId, finalidades, { signal } = {}) {\n      const cid = String(clienteId ?? '').trim();\n      const lid = String(localId ?? '').trim();\n      if (!cid || !lid) {\n        const err = /** @type {Error & { status: number, code: string }} */ (\n          new Error('clienteId/localId obrigatórios para setFinalidades')\n        );\n        err.status = 422;\n        err.code = 'VALIDATION_ERROR';\n        throw err;\n      }\n      const page = await request(\n        `/api/v1/clientes/${encodeURIComponent(cid)}/locais/${encodeURIComponent(lid)}/finalidades`,\n        { method: 'PUT', body: { finalidades }, signal, unwrap: false },\n      );\n      return page && typeof page === 'object' && 'data' in /** @type {object} */ (page)\n        ? /** @type {{ data: unknown }} */ (page).data\n        : page;\n    },\n",""],
      [
        "  const comercialMasters = {\n    /** @param {{clienteSearch?:string,produtoSearch?:string,signal?:AbortSignal}} [options] */\n    async list({ clienteSearch = '', produtoSearch = '', signal } = {}) {\n      const before = Object.freeze({ ...(getScope() || {}) });\n      const matches = current => current.token === before.token && current.groupId === before.groupId\n        && current.empresaId === before.empresaId && current.actorId === before.actorId;\n      const failure = (status, code) => createHttpError(status, { error: { code } }, undefined);\n      if (!before.token || !before.groupId || !before.empresaId || !before.actorId) throw failure(401, 'AUTH_COMPANY_REQUIRED');\n      if ([clienteSearch, produtoSearch].some(value => typeof value !== 'string' || value.length > 200 || value !== value.trim())) {\n        throw failure(422, 'VALIDATION_ERROR');\n      }\n      if (signal?.aborted) throw failure(409, 'CONTEXT_CHANGED');\n      let pages, caught;\n      try {\n        pages = await Promise.all([\n          request('/api/v1/clientes', { query: { operacao: true, ativo: true, search: clienteSearch, limit: 50, offset: 0, order_by: 'codigo' }, signal, unwrap: false }, before),\n          request('/api/v1/produtos', { query: { operacao: true, ativo: true, search: produtoSearch, limit: 50, offset: 0 }, signal, unwrap: false }, before),\n          request('/api/v1/condicoes-pagamento', { query: { ativo: true, limit: 200, offset: 0 }, signal, unwrap: false }, before),\n          request('/api/v1/unidades-medida', { query: { ativo: true, limit: 200 }, signal, unwrap: false }, before),\n          request('/api/v1/tabelas-preco', { query: { ativo: true, limit: 200, offset: 0 }, signal, unwrap: false }, before),\n        ]);\n      } catch (error) { caught = error; }\n      if (signal?.aborted || !matches(getScope() || {})) throw failure(409, 'CONTEXT_CHANGED');\n      if (caught) throw caught;\n      if (!pages) throw failure(502, 'COMERCIAL_MASTERS_INVALID');\n      return { clientes: pages[0], produtos: pages[1], condicoes: pages[2], unidades: pages[3], tabelas: pages[4] };\n    },\n  };\n\n  const orcamentos = {\n",
        "  const orcamentos = {\n"
      ],
      [
        "    comercialMasters,\n    orcamentos,\n    pedidos,\n    expedicao,",
        "    orcamentos,\n    pedidos,\n    expedicao,"
      ],
      [
        "import { toClienteMasterHttpPayload, hydrateClienteHttpRowForUi } from './clienteHttpPayload.js';\n",
        "import { toClienteMasterHttpPayload } from './clienteHttpPayload.js';\n"
      ],
      [
        "    Cliente: (() => {\n      const base = createCrudEntity('/api/v1/clientes', {\n        searchKeys: ['search', 'nome', 'razao_social', 'nome_fantasia', 'documento', 'cnpj', 'codigo'],\n        // NÃO usar \"status\" aqui: filtros multiempresa / colunas status:\"Ativo\"\n        // quebravam parseAtivoQuery → ativo=false → grade vazia com API n>0.\n        ativoKeys: ['ativo', 'ativa'],\n      });\n      return {\n        ...base,\n        async get(id) {\n          return hydrateClienteHttpRowForUi(await base.get(id));\n        },\n        async list(orderBy, limit = 100) {\n          const rows = await base.list(orderBy, limit);\n          return Array.isArray(rows) ? rows.map(hydrateClienteHttpRowForUi) : rows;\n        },\n        async filter(query = {}, orderBy, limit = 100, skip = 0) {\n          const rows = await base.filter(query, orderBy, limit, skip);\n          return Array.isArray(rows) ? rows.map(hydrateClienteHttpRowForUi) : rows;\n        },\n        async create(data) {\n          return hydrateClienteHttpRowForUi(await base.create(toClienteMasterHttpPayload(data)));\n        },\n        async update(id, data) {\n          return hydrateClienteHttpRowForUi(await base.update(id, toClienteMasterHttpPayload(data)));\n        },\n      };\n    })(),\n",
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
  }
};

export const clienteSelectedReferenceHunks={
  "server/src/api/router.ts": {
    "hash": "3eef1ca66fa0b15aa06f55d5c05f6b7c90ea886a858895fc2150f930549e0db5",
    "hunks": [
      [
        "  const relationshipPath = '/api/v1/clientes/:clienteId/empresas';\n  const operationalClienteQuery = z.object({\n    operacao: z.literal('true'), ativo: z.literal('true').optional(),\n    cliente_empresa_id: z.string().uuid().optional(),\n    search: z.string().trim().max(200).optional(),\n    order_by: z.enum(['codigo','nome']).optional(), order_dir: z.enum(['asc','desc']).optional(),\n    limit: z.string().regex(/^[1-9]\\d{0,2}$/).transform(Number).refine(n => n <= 200).optional(),\n",
        "  const relationshipPath = '/api/v1/clientes/:clienteId/empresas';\n  const operationalClienteQuery = z.object({\n    operacao: z.literal('true'), ativo: z.literal('true').optional(),\n    search: z.string().trim().max(200).optional(),\n    order_by: z.enum(['codigo','nome']).optional(), order_dir: z.enum(['asc','desc']).optional(),\n    limit: z.string().regex(/^[1-9]\\d{0,2}$/).transform(Number).refine(n => n <= 200).optional(),\n"
      ],
      [
        "      const orderDir = orderDirRaw === 'desc' || orderDirRaw === 'asc' ? orderDirRaw : undefined;\n      const page = await service.list(ctxFromReq(req), {\n        operacao,\n        clienteEmpresaId: typeof req.query.cliente_empresa_id === 'string' ? req.query.cliente_empresa_id : undefined,\n        ativo: parseAtivoQuery(req.query.ativo),\n        search: req.query.search ? String(req.query.search) : undefined,\n        codigo: req.query.codigo ? String(req.query.codigo) : undefined,\n",
        "      const orderDir = orderDirRaw === 'desc' || orderDirRaw === 'asc' ? orderDirRaw : undefined;\n      const page = await service.list(ctxFromReq(req), {\n        operacao,\n        ativo: parseAtivoQuery(req.query.ativo),\n        search: req.query.search ? String(req.query.search) : undefined,\n        codigo: req.query.codigo ? String(req.query.codigo) : undefined,\n"
      ]
    ]
  },
  "server/src/services/clienteService.ts": {
    "hash": "2c711fb1d47d5ba53e2c0e0099ec75d816a3746bcc583b77df6d0d0d0517578f",
    "hunks": [
      [
        "import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';\nimport {\n  CLIENTE_FORBIDDEN_FIELDS,\n  clienteOperacaoLinkSchema,\n  clienteCreateSchema,\n  clienteUpdateSchema,\n  type Cliente,\n",
        "import type { ClienteRepository } from '../repositories/inMemoryClienteRepository.js';\nimport {\n  CLIENTE_FORBIDDEN_FIELDS,\n  clienteCreateSchema,\n  clienteUpdateSchema,\n  type Cliente,\n"
      ],
      [
        "\nexport type ClienteListOptions = {\n  operacao?: boolean;\n  clienteEmpresaId?: string;\n  ativo?: boolean;\n  search?: string;\n  codigo?: string;\n",
        "\nexport type ClienteListOptions = {\n  operacao?: boolean;\n  ativo?: boolean;\n  search?: string;\n  codigo?: string;\n"
      ],
      [
        "  async list(ctx: RequestContext, options: ClienteListOptions = {}) {\n    this.assertScope(ctx);\n    await this.assertPermission(ctx, 'visualizar');\n    if (options.clienteEmpresaId !== undefined && (!options.operacao\n      || !clienteOperacaoLinkSchema.shape.id.safeParse(options.clienteEmpresaId).success\n      || Boolean(options.search || options.codigo || options.documento)\n      || (options.offset ?? 0) !== 0)) {\n      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid exact operational customer selector');\n    }\n    if (options.operacao) {\n      if (!ctx.empresaId) throw new AppError(422, 'CLIENTE_OPERATIONAL_SCOPE_REQUIRED', 'Active company scope required');\n      if (options.ativo === false || (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 200))\n",
        "  async list(ctx: RequestContext, options: ClienteListOptions = {}) {\n    this.assertScope(ctx);\n    await this.assertPermission(ctx, 'visualizar');\n    if (options.operacao) {\n      if (!ctx.empresaId) throw new AppError(422, 'CLIENTE_OPERATIONAL_SCOPE_REQUIRED', 'Active company scope required');\n      if (options.ativo === false || (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 200))\n"
      ],
      [
        "      groupId: ctx.groupId,\n      empresaId: ctx.empresaId,\n      operacao: options.operacao,\n      clienteEmpresaId: options.clienteEmpresaId,\n      ativo,\n      search: options.search,\n      codigo: options.codigo,\n",
        "      groupId: ctx.groupId,\n      empresaId: ctx.empresaId,\n      operacao: options.operacao,\n      ativo,\n      search: options.search,\n      codigo: options.codigo,\n"
      ]
    ]
  },
  "server/src/repositories/inMemoryClienteRepository.ts": {
    "hash": "cb2811d0bcb37f4f5f114955d4de9ff5766fdddfe3e3a92aca1a55bda9fc0db5",
    "hunks": [
      [
        "    celular: data.celular ?? null,\n    contatos: Array.isArray(data.contatos) ? data.contatos : [],\n    status: data.status ?? 'Ativo',\n",
        "    celular: data.celular ?? null,\n    status: data.status ?? 'Ativo',\n"
      ],
      [
        "\nexport type ClienteListFilter = Scope & ListOptions & {\n  operacao?: boolean;\n  clienteEmpresaId?: string;\n  offset?: number;\n  codigo?: string;\n  documento?: string;\n",
        "\nexport type ClienteListFilter = Scope & ListOptions & {\n  operacao?: boolean;\n  offset?: number;\n  codigo?: string;\n  documento?: string;\n"
      ],
      [
        "  }\n\n  async listPage(filter: ClienteListFilter): Promise<{ rows: ClienteListItem[]; total: number }> {\n    if (filter.clienteEmpresaId && !filter.operacao) {\n      throw new AppError(422, 'VALIDATION_ERROR', 'Exact relationship requires operational scope');\n    }\n    let all: ClienteListItem[] = [...this.rows.values()].filter((r) => this.matches(filter, r));\n    if (filter.operacao) {\n      if (!filter.empresaId || filter.ativo === false) throw new AppError(422, 'CLIENTE_OPERATIONAL_SCOPE_REQUIRED', 'Active company scope required');\n      all = all.flatMap(row => {\n        const links = [...this.empresaLinks.values()].filter(link => link.group_id === filter.groupId\n          && link.empresa_id === filter.empresaId && link.cliente_id === row.id && link.elegivel_operacao);\n        if (filter.clienteEmpresaId && !links.some(link => link.id === filter.clienteEmpresaId)) return [];\n        if (links.length > 1) throw new AppError(409, 'CLIENTE_OPERATIONAL_LINK_AMBIGUOUS', 'Ambiguous operational customer link');\n        return links.length === 1 ? [{ ...row, empresa_operacao: clienteOperacaoLinkSchema.parse(links[0]) }] : [];\n      });\n",
        "  }\n\n  async listPage(filter: ClienteListFilter): Promise<{ rows: ClienteListItem[]; total: number }> {\n    let all: ClienteListItem[] = [...this.rows.values()].filter((r) => this.matches(filter, r));\n    if (filter.operacao) {\n      if (!filter.empresaId || filter.ativo === false) throw new AppError(422, 'CLIENTE_OPERATIONAL_SCOPE_REQUIRED', 'Active company scope required');\n      all = all.flatMap(row => {\n        const links = [...this.empresaLinks.values()].filter(link => link.group_id === filter.groupId\n          && link.empresa_id === filter.empresaId && link.cliente_id === row.id && link.elegivel_operacao);\n        if (links.length > 1) throw new AppError(409, 'CLIENTE_OPERATIONAL_LINK_AMBIGUOUS', 'Ambiguous operational customer link');\n        return links.length === 1 ? [{ ...row, empresa_operacao: clienteOperacaoLinkSchema.parse(links[0]) }] : [];\n      });\n"
      ]
    ]
  },
  "server/src/repositories/postgresClienteRepository.ts": {
    "hash": "f0b68691a479dc10758c2680ff4e2c0a40b0142ffcdaa02af19a1a9e038ab348",
    "hunks": [
      [
        "function mapContatos(value: unknown): ClienteContatoItem[] {\n  if (value == null) return [];\n  if (typeof value === 'string') {\n    try {\n      const parsed = JSON.parse(value) as unknown;\n      return Array.isArray(parsed) ? parsed as ClienteContatoItem[] : [];\n    } catch {\n      return [];\n    }\n  }\n  return Array.isArray(value) ? value as ClienteContatoItem[] : [];\n}\n\n",
        ""
      ],
      [
        "    celular: row.celular == null ? null : String(row.celular),\n    contatos: mapContatos(row.contatos),\n    status: String(row.status ?? 'Ativo'),\n",
        "    celular: row.celular == null ? null : String(row.celular),\n    status: String(row.status ?? 'Ativo'),\n"
      ],
      [
        "      const insert = await client.query(\n        `INSERT INTO clientes (\n          group_id, empresa_id, codigo, tipo, documento, documento_normalizado,\n          nome, razao_social, nome_fantasia, nome_social,\n          inscricao_estadual, inscricao_municipal, email, telefone, celular, contatos,\n          status, origem, codigo_legado, legacy_id, source_system, migration_batch,\n          observacoes, ativo, created_by, updated_by\n        ) VALUES (\n          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25,$25\n        ) RETURNING *`,\n        [\n          scope.groupId,\n          empresaId,\n          codigo,\n          data.tipo,\n          raw ? String(raw).trim() : docNorm,\n          docNorm,\n          data.nome ?? null,\n          data.razao_social ?? null,\n          data.nome_fantasia ?? null,\n          data.nome_social ?? null,\n          data.inscricao_estadual ?? null,\n          data.inscricao_municipal ?? null,\n          data.email ?? null,\n          data.telefone ?? null,\n          data.celular ?? null,\n          JSON.stringify(data.contatos ?? []),\n          data.status ?? 'Ativo',\n          data.origem ?? 'ERP',\n          data.codigo_legado ?? null,\n          data.legacy_id ?? null,\n          data.source_system ?? null,\n          data.migration_batch ?? null,\n          data.observacoes ?? null,\n          data.ativo ?? true,\n          actorId ?? null,\n        ],\n      );",
        "      const insert = await client.query(\n        `INSERT INTO clientes (\n          group_id, empresa_id, codigo, tipo, documento, documento_normalizado,\n          nome, razao_social, nome_fantasia, nome_social,\n          inscricao_estadual, inscricao_municipal, email, telefone, celular,\n          status, origem, codigo_legado, legacy_id, source_system, migration_batch,\n          observacoes, ativo, created_by, updated_by\n        ) VALUES (\n          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24\n        ) RETURNING *`,\n        [\n          scope.groupId,\n          empresaId,\n          codigo,\n          data.tipo,\n          raw ? String(raw).trim() : docNorm,\n          docNorm,\n          data.nome ?? null,\n          data.razao_social ?? null,\n          data.nome_fantasia ?? null,\n          data.nome_social ?? null,\n          data.inscricao_estadual ?? null,\n          data.inscricao_municipal ?? null,\n          data.email ?? null,\n          data.telefone ?? null,\n          data.celular ?? null,\n          data.status ?? 'Ativo',\n          data.origem ?? 'ERP',\n          data.codigo_legado ?? null,\n          data.legacy_id ?? null,\n          data.source_system ?? null,\n          data.migration_batch ?? null,\n          data.observacoes ?? null,\n          data.ativo ?? true,\n          actorId ?? null,\n        ],\n      );"
      ],
      [
        "      celular: data.celular === undefined ? current.celular : data.celular,\n      contatos: data.contatos === undefined ? current.contatos : data.contatos,\n      status: data.status ?? current.status,\n",
        "      celular: data.celular === undefined ? current.celular : data.celular,\n      status: data.status ?? current.status,\n"
      ],
      [
        "    const result = await executor.query(\n      `UPDATE clientes SET\n        empresa_id=$1, tipo=$2, documento=$3, documento_normalizado=$4,\n        nome=$5, razao_social=$6, nome_fantasia=$7, nome_social=$8,\n        inscricao_estadual=$9, inscricao_municipal=$10, email=$11, telefone=$12, celular=$13,\n        contatos=$14::jsonb, status=$15, origem=$16, codigo_legado=$17, legacy_id=$18, source_system=$19,\n        migration_batch=$20, observacoes=$21, ativo=$22\n       WHERE group_id=$23 AND id=$24\n       RETURNING *`,\n      [\n        next.empresa_id, next.tipo, next.documento, next.documento_normalizado,\n        next.nome, next.razao_social, next.nome_fantasia, next.nome_social,\n        next.inscricao_estadual, next.inscricao_municipal, next.email, next.telefone, next.celular,\n        JSON.stringify(next.contatos ?? []),\n        next.status, next.origem, next.codigo_legado, next.legacy_id, next.source_system,\n        next.migration_batch, next.observacoes, next.ativo,\n        scope.groupId, id,\n      ],\n    );",
        "    const result = await executor.query(\n      `UPDATE clientes SET\n        empresa_id=$1, tipo=$2, documento=$3, documento_normalizado=$4,\n        nome=$5, razao_social=$6, nome_fantasia=$7, nome_social=$8,\n        inscricao_estadual=$9, inscricao_municipal=$10, email=$11, telefone=$12, celular=$13,\n        status=$14, origem=$15, codigo_legado=$16, legacy_id=$17, source_system=$18,\n        migration_batch=$19, observacoes=$20, ativo=$21\n       WHERE group_id=$22 AND id=$23\n       RETURNING *`,\n      [\n        next.empresa_id, next.tipo, next.documento, next.documento_normalizado,\n        next.nome, next.razao_social, next.nome_fantasia, next.nome_social,\n        next.inscricao_estadual, next.inscricao_municipal, next.email, next.telefone, next.celular,\n        next.status, next.origem, next.codigo_legado, next.legacy_id, next.source_system,\n        next.migration_batch, next.observacoes, next.ativo,\n        scope.groupId, id,\n      ],\n    );"
      ],
      [
        "  async listPage(filter: ClienteListFilter, executor?: DbQueryExecutor,\n    exportOptions?: { ids?: readonly string[]; exactEmpresa: true }): Promise<{ rows: ClienteListItem[]; total: number }> {\n    if (exportOptions && !executor) throw new Error('CLIENTE_EXPORT_TRANSACTION_REQUIRED');\n    if (filter.clienteEmpresaId && !filter.operacao) {\n      throw new AppError(422, 'VALIDATION_ERROR', 'Exact relationship requires operational scope');\n    }\n    const query = executor ?? this.db;\n    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);\n    const offset = Math.max(filter.offset ?? 0, 0);\n",
        "  async listPage(filter: ClienteListFilter, executor?: DbQueryExecutor,\n    exportOptions?: { ids?: readonly string[]; exactEmpresa: true }): Promise<{ rows: ClienteListItem[]; total: number }> {\n    if (exportOptions && !executor) throw new Error('CLIENTE_EXPORT_TRANSACTION_REQUIRED');\n    const query = executor ?? this.db;\n    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);\n    const offset = Math.max(filter.offset ?? 0, 0);\n"
      ],
      [
        "      params.push(filter.empresaId);\n      operationalLinksSql = `ce.group_id=clientes.group_id AND ce.cliente_id=clientes.id AND ce.empresa_id=$${params.length}\n        AND ce.ativo=true AND ce.situacao_comercial='ATIVO' AND ce.habilitado_operacao=true AND ce.bloqueado=false`;\n      if (filter.clienteEmpresaId) {\n        params.push(filter.clienteEmpresaId);\n        where.push(`EXISTS (SELECT 1 FROM cliente_empresas ce WHERE ${operationalLinksSql} AND ce.id=$${params.length}::uuid)`);\n      }\n      where.push(`EXISTS (SELECT 1 FROM cliente_empresas ce WHERE ${operationalLinksSql})`);\n    }\n    const whereSql = where.join(' AND ');\n",
        "      params.push(filter.empresaId);\n      operationalLinksSql = `ce.group_id=clientes.group_id AND ce.cliente_id=clientes.id AND ce.empresa_id=$${params.length}\n        AND ce.ativo=true AND ce.situacao_comercial='ATIVO' AND ce.habilitado_operacao=true AND ce.bloqueado=false`;\n      where.push(`EXISTS (SELECT 1 FROM cliente_empresas ce WHERE ${operationalLinksSql})`);\n    }\n    const whereSql = where.join(' AND ');\n"
      ],
      [
        "import { clienteOperacaoLinksSchema } from './clienteTypes.js';\nimport { foldSearchText, sqlFoldAccentExpr } from '../domain/searchTextNormalize.js';\nimport type { ClienteContatoItem } from './clienteTypes.js';\n\n",
        "import { clienteOperacaoLinksSchema } from './clienteTypes.js';\n\n"
      ],
      [
        "    if (filter.search) {\n      const q = `%${foldSearchText(filter.search)}%`;\n      const docQ = normalizeDocumento(filter.search);\n      params.push(q);\n      const searchIdx = params.length;\n      const foldedMatch = (\n        `${sqlFoldAccentExpr(\"coalesce(nome,'')\")} LIKE $${searchIdx}`\n        + ` OR ${sqlFoldAccentExpr(\"coalesce(razao_social,'')\")} LIKE $${searchIdx}`\n        + ` OR ${sqlFoldAccentExpr(\"coalesce(nome_fantasia,'')\")} LIKE $${searchIdx}`\n        + ` OR ${sqlFoldAccentExpr(\"coalesce(email,'')\")} LIKE $${searchIdx}`\n        + ` OR ${sqlFoldAccentExpr(\"coalesce(telefone,'')\")} LIKE $${searchIdx}`\n        + ` OR ${sqlFoldAccentExpr(\"coalesce(celular,'')\")} LIKE $${searchIdx}`\n        + ` OR ${sqlFoldAccentExpr('codigo')} LIKE $${searchIdx}`\n      );\n      if (docQ) {\n        params.push(`%${docQ}%`);\n        where.push(`(\n          ${foldedMatch}\n          OR documento_normalizado LIKE $${params.length}\n        )`);\n      } else {\n        where.push(`(\n          ${foldedMatch}\n        )`);\n      }\n    }\n",
        "    if (filter.search) {\n      const q = `%${filter.search.toLowerCase()}%`;\n      const docQ = normalizeDocumento(filter.search);\n      params.push(q);\n      const searchIdx = params.length;\n      if (docQ) {\n        params.push(`%${docQ}%`);\n        where.push(`(\n          lower(coalesce(nome,'')) LIKE $${searchIdx}\n          OR lower(coalesce(razao_social,'')) LIKE $${searchIdx}\n          OR lower(coalesce(nome_fantasia,'')) LIKE $${searchIdx}\n          OR lower(coalesce(email,'')) LIKE $${searchIdx}\n          OR lower(coalesce(telefone,'')) LIKE $${searchIdx}\n          OR lower(coalesce(celular,'')) LIKE $${searchIdx}\n          OR lower(codigo) LIKE $${searchIdx}\n          OR documento_normalizado LIKE $${params.length}\n        )`);\n      } else {\n        where.push(`(\n          lower(coalesce(nome,'')) LIKE $${searchIdx}\n          OR lower(coalesce(razao_social,'')) LIKE $${searchIdx}\n          OR lower(coalesce(nome_fantasia,'')) LIKE $${searchIdx}\n          OR lower(coalesce(email,'')) LIKE $${searchIdx}\n          OR lower(coalesce(telefone,'')) LIKE $${searchIdx}\n          OR lower(coalesce(celular,'')) LIKE $${searchIdx}\n          OR lower(codigo) LIKE $${searchIdx}\n        )`);\n      }\n    }\n"
      ]
    ]
  },
  "src/api/httpApiClient.js": {
    "hash": "c4d8e6c5eb1cae7f37d111656d3f48c9a7f1ba50421a0d4a0be6d4a38afa75df",
    "hunks": [
      [
        "    /**\n     * Lookup leve de vínculo operacional (somente /clientes).\n     * Evita fan-out N×5 do list() completo na hidratação de labels por linha.\n     * @param {{clienteEmpresaId?:string,signal?:AbortSignal}} [options]\n     */\n    async resolveClienteEmpresa({ clienteEmpresaId, signal } = {}) {\n      const before = Object.freeze({ ...(getScope() || {}) });\n      const matches = current => current.token === before.token && current.groupId === before.groupId\n        && current.empresaId === before.empresaId && current.actorId === before.actorId;\n      const failure = (status, code) => createHttpError(status, { error: { code } }, undefined);\n      if (!before.token || !before.groupId || !before.empresaId || !before.actorId) throw failure(401, 'AUTH_COMPANY_REQUIRED');\n      if (typeof clienteEmpresaId !== 'string'\n        || clienteEmpresaId.length !== 36 || clienteEmpresaId !== clienteEmpresaId.trim()) {\n        throw failure(422, 'VALIDATION_ERROR');\n      }\n      if (signal?.aborted) throw failure(409, 'CONTEXT_CHANGED');\n      let page, caught;\n      try {\n        page = await request('/api/v1/clientes', {\n          query: {\n            operacao: true, ativo: true, cliente_empresa_id: clienteEmpresaId,\n            search: '', limit: 1, offset: 0, order_by: 'codigo',\n          },\n          signal, unwrap: false,\n        }, before);\n      } catch (error) { caught = error; }\n      if (signal?.aborted || !matches(getScope() || {})) throw failure(409, 'CONTEXT_CHANGED');\n      if (caught) throw caught;\n      if (!page) throw failure(502, 'COMERCIAL_MASTERS_INVALID');\n      return { clientes: page };\n    },\n",
        ""
      ],
      [
        "    /** @param {{ limit?: number, offset?: number, search?: string, status?: string, clienteEmpresaId?: string, clienteId?: string, tipoOperacao?: string, signal?: AbortSignal }} [options] */\n    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, clienteId, tipoOperacao, signal } = {}) {\n      return request('/api/v1/pedidos', { query: { limit, offset, search, status, clienteEmpresaId, clienteId, tipoOperacao }, signal, unwrap: false });\n    },\n",
        "    /** @param {{ limit?: number, offset?: number, search?: string, status?: string, clienteEmpresaId?: string, tipoOperacao?: string, signal?: AbortSignal }} [options] */\n    list({ limit = 50, offset = 0, search, status, clienteEmpresaId, tipoOperacao, signal } = {}) {\n      return request('/api/v1/pedidos', { query: { limit, offset, search, status, clienteEmpresaId, tipoOperacao }, signal, unwrap: false });\n    },\n"
      ],
      [
        "  };\n\n  const comercialMasters = {\n    /** @param {{clienteSearch?:string,produtoSearch?:string,clienteEmpresaId?:string,signal?:AbortSignal}} [options] */\n    async list({ clienteSearch = '', produtoSearch = '', clienteEmpresaId, signal } = {}) {\n      const before = Object.freeze({ ...(getScope() || {}) });\n      const matches = current => current.token === before.token && current.groupId === before.groupId\n        && current.empresaId === before.empresaId && current.actorId === before.actorId;\n",
        "  };\n\n  const comercialMasters = {\n    /** @param {{clienteSearch?:string,produtoSearch?:string,signal?:AbortSignal}} [options] */\n    async list({ clienteSearch = '', produtoSearch = '', signal } = {}) {\n      const before = Object.freeze({ ...(getScope() || {}) });\n      const matches = current => current.token === before.token && current.groupId === before.groupId\n        && current.empresaId === before.empresaId && current.actorId === before.actorId;\n"
      ],
      [
        "        throw failure(422, 'VALIDATION_ERROR');\n      }\n      if (signal?.aborted) throw failure(409, 'CONTEXT_CHANGED');\n      if (clienteEmpresaId !== undefined && (typeof clienteEmpresaId !== 'string'\n        || clienteEmpresaId.length !== 36 || clienteEmpresaId !== clienteEmpresaId.trim() || clienteSearch)) {\n        throw failure(422, 'VALIDATION_ERROR');\n      }\n      let pages, caught;\n      try {\n        pages = await Promise.all([\n          request('/api/v1/clientes', { query: { operacao: true, ativo: true, cliente_empresa_id: clienteEmpresaId, search: clienteSearch, limit: clienteEmpresaId ? 1 : 50, offset: 0, order_by: 'codigo' }, signal, unwrap: false }, before),\n          request('/api/v1/produtos', { query: { operacao: true, ativo: true, search: produtoSearch, limit: 50, offset: 0 }, signal, unwrap: false }, before),\n          request('/api/v1/condicoes-pagamento', { query: { ativo: true, limit: 200, offset: 0 }, signal, unwrap: false }, before),\n          request('/api/v1/unidades-medida', { query: { ativo: true, limit: 200 }, signal, unwrap: false }, before),\n",
        "        throw failure(422, 'VALIDATION_ERROR');\n      }\n      if (signal?.aborted) throw failure(409, 'CONTEXT_CHANGED');\n      let pages, caught;\n      try {\n        pages = await Promise.all([\n          request('/api/v1/clientes', { query: { operacao: true, ativo: true, search: clienteSearch, limit: 50, offset: 0, order_by: 'codigo' }, signal, unwrap: false }, before),\n          request('/api/v1/produtos', { query: { operacao: true, ativo: true, search: produtoSearch, limit: 50, offset: 0 }, signal, unwrap: false }, before),\n          request('/api/v1/condicoes-pagamento', { query: { ativo: true, limit: 200, offset: 0 }, signal, unwrap: false }, before),\n          request('/api/v1/unidades-medida', { query: { ativo: true, limit: 200 }, signal, unwrap: false }, before),\n"
      ]
    ]
  }
};
