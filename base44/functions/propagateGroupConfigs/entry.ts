import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const reportPropagationFailure = (operation, error, context = {}) => {
  console.error(`[propagateGroupConfigs] ${operation}`, { error: error?.message || String(error), ...context });
};

const summarizeResults = (results) => results.map(({ entity, created, updated, skipped, total_source, direction }) => ({
  entity, created, updated, skipped, total_source, direction,
}));

// Admin-only function to propagate configurations/data between group and companies
// Body formats supported:
// 1) Direct call: { group_id, empresa_id?, direction?: 'grupo_to_empresas'|'empresa_to_grupo', entidades?: string[], strategy?: 'skip'|'merge'|'override' }
// 2) Entity automation payload: { event, data, old_data, args? }
// Defaults: direction=grupo_to_empresas, entidades=['PlanoDeContas','CentroCusto'], strategy='merge'
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const raw = await req.json().catch(() => ({}));
    // Suporta dois modos:
    // 1) Chamada por usuário autenticado (admin) — requer role=admin
    // 2) Chamada por automação agendada (sem auth) — permitida via service role
    let user = null;
    try { user = await base44.auth.me(); } catch (error) { reportPropagationFailure('autenticacao', error); }
    const internalToken = raw?.internal_token || req.headers.get('x-internal-token') || null;
    const expectedToken = Deno.env.get('DEPLOY_AUDIT_TOKEN') || null;
    const trustedInternal = Boolean(internalToken && expectedToken && internalToken === expectedToken);
    if (!user && !trustedInternal) {
      return Response.json({ error: 'Forbidden: internal automation token required' }, { status: 403 });
    }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const event = raw?.event || null;
    const data = raw?.data || null;

    const input = event ? {
      group_id: data?.group_id ?? raw?.group_id ?? null,
      empresa_id: data?.empresa_id ?? raw?.empresa_id ?? null,
      direction: raw?.direction,
      entidades: raw?.entidades,
      strategy: raw?.strategy,
      empresas_ids: raw?.empresas_ids
    } : raw;

    // Resolve contexto
    let { group_id: groupId, empresa_id: empresaId, direction, entidades, strategy, empresas_ids } = input || {};
    direction = direction || (empresaId && !groupId ? 'empresa_to_grupo' : 'grupo_to_empresas');
    entidades = Array.isArray(entidades) && entidades.length ? entidades : [
      // Financeiro & Fiscal
      'PlanoDeContas', 'CentroCusto', 'CentroResultado', 'TipoDespesa', 'MoedaIndice',
      'FormaPagamento', 'CondicaoComercial', 'TabelaFiscal', 'Banco',
      // Produtos & Serviços
      'GrupoProduto', 'Marca', 'SetorAtividade', 'UnidadeMedida',
      // Logística
      'TipoFrete', 'LocalEstoque', 'RotaPadrao',
      // Estrutura Organizacional
      'Cargo', 'Departamento', 'Turno',
    ];
    strategy = strategy || 'merge'; // 'skip' | 'merge' | 'override'

    if (!groupId && empresaId) {
      const emp = await base44.asServiceRole.entities.Empresa.filter({ id: empresaId }, undefined, 1).then(r => r?.[0]).catch(() => null);
      groupId = emp?.group_id || null;
    }
    if (!groupId) return Response.json({ error: 'group_id obrigatório (ou empresa_id que pertença a um grupo)' }, { status: 400 });

    const empresas = await base44.asServiceRole.entities.Empresa.filter({ group_id: groupId }, undefined, 500);
    const empresasDoGrupo = new Map((empresas || []).map((empresa) => [empresa.id, empresa]));
    const requestedEmpresaIds = Array.isArray(empresas_ids) && empresas_ids.length ? empresas_ids : null;
    const idsForaDoGrupo = (requestedEmpresaIds || []).filter((id) => !empresasDoGrupo.has(id));
    if (idsForaDoGrupo.length) {
      return Response.json({ error: 'Empresa fora do grupo informado', empresas_ids: idsForaDoGrupo }, { status: 403 });
    }
    if (empresaId && !empresasDoGrupo.has(empresaId)) {
      return Response.json({ error: 'empresa_id fora do grupo informado' }, { status: 403 });
    }
    const targetEmpresas = requestedEmpresaIds ? requestedEmpresaIds.map((id) => empresasDoGrupo.get(id)) : empresas;

    // Helpers
    const keyFieldsByEntity = (en) => {
      if (en === 'Cliente') return ['cnpj', 'cpf', 'nome', 'razao_social'];
      if (en === 'Fornecedor') return ['cnpj', 'cpf', 'nome', 'razao_social'];
      if (en === 'TabelaPreco' || en === 'PlanoDeContas' || en === 'CentroCusto') return ['codigo', 'descricao', 'nome', 'titulo'];
      return ['codigo', 'descricao', 'nome', 'titulo'];
    };

    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = Array.isArray(obj) ? [] : {};
      for (const [k, v] of Object.entries(obj)) {
        if (['id','created_date','updated_date','created_by'].includes(k)) continue;
        out[k] = (v && typeof v === 'object') ? sanitize(v) : (typeof v === 'string' ? v.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,'').replace(/javascript:\s*/gi,'') : v);
      }
      return out;
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const processChunks = async (arr, size, handler) => {
      for (let i = 0; i < arr.length; i += size) {
        const slice = arr.slice(i, i + size);
        await handler(slice, i / size);
        if (i + size < arr.length) await sleep(250); // backoff anti rate-limit
      }
    };

    const copyGroupToEmpresas = async (entityName) => {
      const baseRegs = await base44.asServiceRole.entities[entityName].filter({ group_id: groupId }, undefined, 5000);
      const keys = keyFieldsByEntity(entityName);
      let created = 0, updated = 0, skipped = 0;
      await processChunks(targetEmpresas, 1, async (empSlice) => {
        for (const emp of empSlice) {
          await processChunks(baseRegs, 100, async (chunk) => {
            for (const r of chunk) {
              const payload = sanitize({ ...r, group_id: undefined, empresa_id: emp.id });
              const keyField = keys.find(k => r?.[k]);
              const filtro = { empresa_id: emp.id };
              if (keyField) filtro[keyField] = r[keyField];
              const existing = await base44.asServiceRole.entities[entityName].filter(filtro, undefined, 1).then(x=>x?.[0]).catch(()=>null);
              if (existing) {
                if (strategy === 'override') {
                  await base44.asServiceRole.entities[entityName].update(existing.id, payload);
                  updated++;
                } else if (strategy === 'merge') {
                  const patch = {};
                  for (const [k, v] of Object.entries(payload)) if (existing[k] == null) patch[k] = v;
                  if (Object.keys(patch).length) { await base44.asServiceRole.entities[entityName].update(existing.id, patch); updated++; } else { skipped++; }
                } else { skipped++; }
              } else {
                await base44.asServiceRole.entities[entityName].create(payload);
                created++;
              }
            }
          });
        }
      });
      return { entity: entityName, created, updated, skipped, total_source: baseRegs.length, direction: 'grupo_to_empresas' };
    };

    const copyEmpresaToGroup = async (entityName, empresaOrigemId) => {
      const baseRegs = await base44.asServiceRole.entities[entityName].filter({ empresa_id: empresaOrigemId }, undefined, 5000);
      const keys = keyFieldsByEntity(entityName);
      let created = 0, updated = 0, skipped = 0;
      for (const r of baseRegs) {
        const payload = sanitize({ ...r, empresa_id: undefined, group_id: groupId });
        const keyField = keys.find(k => r?.[k]);
        const filtro = { group_id: groupId };
        if (keyField) filtro[keyField] = r[keyField];
        const existing = await base44.asServiceRole.entities[entityName].filter(filtro, undefined, 1).then(x=>x?.[0]).catch(()=>null);
        if (existing) {
          if (strategy === 'override') {
            await base44.asServiceRole.entities[entityName].update(existing.id, payload); updated++;
          } else if (strategy === 'merge') {
            const patch = {};
            for (const [k, v] of Object.entries(payload)) if (existing[k] == null) patch[k] = v;
            if (Object.keys(patch).length) { await base44.asServiceRole.entities[entityName].update(existing.id, patch); updated++; } else { skipped++; }
          } else { skipped++; }
        } else {
          await base44.asServiceRole.entities[entityName].create(payload); created++;
        }
      }
      return { entity: entityName, created, updated, skipped, total_source: baseRegs.length, direction: 'empresa_to_grupo' };
    };

    const results = [];
    if (direction === 'grupo_to_empresas') {
      for (const en of entidades) if (base44.asServiceRole.entities?.[en]) results.push(await copyGroupToEmpresas(en));
    } else if (direction === 'empresa_to_grupo') {
      const ids = Array.isArray(empresas_ids) && empresas_ids.length ? empresas_ids : (empresaId ? [empresaId] : []);
      if (!ids.length) return Response.json({ error: 'empresa_id ou empresas_ids obrigatório para empresa_to_grupo' }, { status: 400 });
      for (const eid of ids) {
        if (!empresasDoGrupo.has(eid)) return Response.json({ error: 'Empresa de origem fora do grupo informado' }, { status: 403 });
        for (const en of entidades) if (base44.asServiceRole.entities?.[en]) results.push(await copyEmpresaToGroup(en, eid));
      }
    }

    // Audit
    try { await base44.asServiceRole.entities.AuditLog.create({
      usuario: user ? (user.full_name || user.email || 'Admin') : 'Sistema Agendado',
      usuario_id: user?.id || null,
      acao: 'Execução', modulo: 'Sistema', tipo_auditoria: 'sistema', entidade: 'PropagacaoGrupo',
      descricao: `Propagação ${direction} (${entidades.join(', ')})`, dados_novos: { group_id: groupId, empresa_id: empresaId || null, direction, strategy, resultados: summarizeResults(results) },
      data_hora: new Date().toISOString()
    }); } catch {}

    return Response.json({ ok: true, group_id: groupId, empresa_id: empresaId || null, direction, strategy, results });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
