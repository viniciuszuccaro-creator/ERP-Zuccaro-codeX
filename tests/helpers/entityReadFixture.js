import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const matches = (row, filter = {}) => Object.entries(filter).every(([key, value]) => {
  if (key === '$and') return value.every(part => matches(row, part));
  if (key === '$or') return value.some(part => matches(row, part));
  if (value && typeof value === 'object') return Object.entries(value).every(([op, wanted]) =>
    op === '$in' ? (Array.isArray(row[key]) ? row[key].some(item=>wanted.includes(item)) : wanted.includes(row[key])) : op === '$gte' ? row[key] >= wanted : op === '$lte' ? row[key] <= wanted : false);
  return row[key] === value || (value === null && row[key] == null);
});
export function fixture(permissions = {}) {
  const state = { user: { id: 'actor-a', perfil_acesso_id: 'profile-a', grupo_atual_id: 'group-a', empresa_atual_id: 'company-a',
    grupos_vinculados: [{ grupo_id: 'group-a', ativo: true }], empresas_vinculadas: [{ empresa_id: 'company-a', ativo: true }] },
    permissions, auditFailure: false, reads: [], audits: [], rows: {
      Representante: [{ id: 'rep-a', nome: '=SUM(1)', tipo_representante: 'Parceiro', percentual_comissao: 10, group_id: 'group-a', empresa_id: 'company-a' }],
      Cliente: [{ id: 'client-a', nome: '=SUM(1)', indicador_id: 'rep-a', limite_credito: 500, group_id: 'group-a', empresa_id: 'company-a' },
        { id: 'client-b', nome: 'Sintético B', group_id: 'group-a', empresa_id: 'company-b' }],
      Pedido: [{ id: 'order-a', indicador_id: 'rep-a', valor_total: '100.00', status: 'Aprovado', data_pedido: '2026-10-10', group_id: 'group-a', empresa_id: 'company-a' }],
    } };
  const metadata = {
    PerfilAcesso: { get: async () => ({ id: 'profile-a', permissoes: state.permissions }) },
    GrupoEmpresarial: { filter: async f => f.id === 'group-a' ? [{ id: 'group-a' }] : [] },
    Empresa: { filter: async f => ['company-a','company-b'].filter(id => !f.id || f.id === id).map(id => ({ id, group_id: 'group-a' })) },
    AuditLog: { create: async value => { if (state.auditFailure) throw new Error('private audit error'); state.audits.push(value); return { id: 'audit-a' }; } },
  };
  const entities = new Proxy(metadata, { get: (obj, name) => obj[name] || {
    filter: async (filter, order, limit, skip = 0) => { state.reads.push({ name, filter, limit, skip });
      return (state.rows[name] || []).filter(row => matches(row, filter)).slice(skip, skip + limit); },
    get: async id => { state.reads.push({ name, id }); return (state.rows[name] || []).find(row => row.id === id); },
  } });
  const sdk = { createClientFromRequest: () => ({ auth: { me: async () => { state.authCalls=(state.authCalls||0)+1; return state.onAuth ? state.onAuth(state.authCalls) : state.user; } }, asServiceRole: { entities } }) };
  function handler(name) {
    let serve; const cache = new Map();
    function load(file) {
      file = path.resolve(file); if (cache.has(file)) return cache.get(file);
      const exports = {}; cache.set(file, exports);
      const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      new Function('exports','require','Deno',code)(exports, id => {
        if (id.startsWith('npm:@base44/sdk')) return sdk;
        let target = path.resolve(path.dirname(file), id);
        if (!fs.existsSync(target)) target = target.replace(/\.js$/, '.ts');
        return load(target);
      }, { serve: fn => { serve = fn; } });
      return exports;
    }
    load(`base44/functions/${name}/entry.ts`);
    return async body => { const res = await serve(new Request('http://fixture.invalid', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) }));
      return { status: res.status, body: await res.json() }; };
  }
  return { state, handler };
}
