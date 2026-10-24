import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { observeEntityApiAccess, isHttpEntityApiAccess } from "@/api/localEntityReadApi";

/**
 * GlobalContextStamp
 * - Carimba automaticamente group_id/empresa_id em create/update/bulkCreate quando ausentes
 * - Injeta filtro de contexto em filter() quando não informado
 * - Gravacoes sem contexto falham; leituras de bootstrap preservam o contrato existente
 * - Nao altera UI e nao renderiza nada
 */

const SKIP_ENTITY_PATCH = new Set([
  'User',
  'SessaoUsuario',
  'AuditLog',
  'PerfilAcesso',
  'GrupoEmpresarial',
]);

/** @typedef {Pick<ReturnType<typeof useContextoVisual>, 'getFiltroContexto' | 'carimbarContexto' | 'contextoValido'>} StampContext */
/** @typedef {React.MutableRefObject<StampContext>} StampRef */
/** @type {WeakMap<object, {refs: Set<StampRef>, restore: () => void}>} */
const installedStamps = new WeakMap();

/** Context stamping is not backend authorization. Existing local/HTTP proxies report lazy access.
 * @param {typeof base44.entities} root @param {StampRef} contextRef */
export function installContextStamp(root, contextRef) {
  const installed = installedStamps.get(root);
  if (installed) {
    installed.refs.add(contextRef);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      installed.refs.delete(contextRef);
      if (!installed.refs.size) { installed.restore(); installedStamps.delete(root); }
    };
  }
  const refs = new Set([contextRef]);
  /** @type {Array<() => void>} */
  const restorers = [];
  const patched = new WeakSet();
  /** @type {undefined|(()=>void)} */
  let stopObserving;
  const restore = () => { stopObserving?.(); for (const undo of restorers.reverse()) undo(); };
  const currentContext = () => {
    const contexts = [...refs].map(ref => ref.current);
    const current = contexts.at(-1);
    if (!current) throw new Error('Contexto multiempresa indisponivel.');
    const filters = contexts.map(ctx => ctx.contextoValido ? ctx.getFiltroContexto('empresa_id', true) : null);
    const fingerprint = value => JSON.stringify(value && Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    if (filters.some(filter => fingerprint(filter) !== fingerprint(filters.at(-1)))) {
      throw new Error('Contextos multiempresa concorrentes divergentes.');
    }
    return current;
  };
  const stamp = dados => {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('Registro de gravacao invalido.');
    const context = currentContext();
    if (!context.contextoValido || typeof context.carimbarContexto !== 'function') {
      throw new Error('Contexto multiempresa obrigatorio para gravacao.');
    }
    const expected = context.getFiltroContexto('empresa_id', true);
    if (!expected?.group_id) throw new Error('Grupo obrigatorio para gravacao.');
    for (const key of ['group_id', 'empresa_id']) {
      if (expected[key] && dados?.[key] && dados[key] !== expected[key]) throw new Error('Gravacao fora do contexto atual.');
    }
    if (dados?.grupo_id && dados.grupo_id !== expected.group_id) throw new Error('Gravacao fora do grupo atual.');
    const result = context.carimbarContexto(dados);
    if (!result || typeof result !== 'object' || result.group_id !== expected.group_id
      || (expected.empresa_id && result.empresa_id !== expected.empresa_id)) {
      throw new Error('Carimbo multiempresa invalido.');
    }
    return result;
  };
  const readFilter = () => {
    const context = currentContext();
    if (!context.contextoValido) return {};
    const filter = context.getFiltroContexto('empresa_id', true);
    if (!filter?.group_id) throw new Error('Grupo obrigatorio para leitura contextual.');
    return filter;
  };
  /** @param {string} name @param {unknown} candidate */
  const patchApi = (name, candidate) => {
      if (SKIP_ENTITY_PATCH.has(name) || isHttpEntityApiAccess(root, name)
        || !candidate || typeof candidate !== 'object' || patched.has(candidate)) return;
      // Only APIs shaped like this existing entity dictionary can be instrumented.
      const api = root[name];
      if (api !== candidate) throw new Error('API de entidade alterada durante instalacao.');
      const start = restorers.length;
      try {
      const original = { create: api.create, bulkCreate: api.bulkCreate, update: api.update, filter: api.filter, list: api.list };
      const create = original.create && ((dados) => original.create.call(api, stamp(dados)));
      const bulkCreate = original.bulkCreate && ((lista) => {
        if (!Array.isArray(lista)) throw new Error('Lote de gravacao invalido.');
        const stamped = lista.map(stamp);
        return original.bulkCreate.call(api, stamped);
      });
      const update = original.update && ((id, dados) => original.update.call(api, id, stamp(dados)));
      const filter = original.filter && ((criterios = {}, ...options) => original.filter.call(api, { ...criterios, ...readFilter() }, ...options));
      const list = original.list && ((...options) => {
        const scope = readFilter();
        return original.filter && scope.group_id ? original.filter.call(api, scope, ...options) : original.list.call(api, ...options);
      });
      if (create) { api.create = create; restorers.push(() => { if (api.create === create) api.create = original.create; }); }
      if (bulkCreate) { api.bulkCreate = bulkCreate; restorers.push(() => { if (api.bulkCreate === bulkCreate) api.bulkCreate = original.bulkCreate; }); }
      if (update) { api.update = update; restorers.push(() => { if (api.update === update) api.update = original.update; }); }
      if (filter) { api.filter = filter; restorers.push(() => { if (api.filter === filter) api.filter = original.filter; }); }
      if (list) { api.list = list; restorers.push(() => { if (api.list === list) api.list = original.list; }); }
      patched.add(candidate);
      } catch {
        for (const undo of restorers.splice(start).reverse()) undo();
        throw new Error('Falha ao instalar carimbo multiempresa.');
      }
  };
  try {
    for (const name of Object.keys(root)) patchApi(name, root[name]);
    stopObserving = observeEntityApiAccess(root, patchApi);
  } catch {
    restore();
    throw new Error('Falha ao instalar carimbo multiempresa.');
  }
  installedStamps.set(root, { refs, restore });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refs.delete(contextRef);
    if (!refs.size) { restore(); installedStamps.delete(root); }
  };
}

export default function GlobalContextStamp() {
  const { getFiltroContexto, carimbarContexto, contextoValido } = useContextoVisual();
  const contextRef = React.useRef({ getFiltroContexto, carimbarContexto, contextoValido });

  contextRef.current = { getFiltroContexto, carimbarContexto, contextoValido };

  useEffect(() => {
    if (!base44?.entities) return;
    return installContextStamp(base44.entities, contextRef);
  }, []);

  return null;
}
