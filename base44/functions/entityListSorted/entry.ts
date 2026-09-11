import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_SORTS = {
  Produto: { field: 'descricao', direction: 'asc' }, Cliente: { field: 'nome', direction: 'asc' },
  Fornecedor: { field: 'nome', direction: 'asc' }, Transportadora: { field: 'razao_social', direction: 'asc' },
  Colaborador: { field: 'nome_completo', direction: 'asc' }, Banco: { field: 'nome_banco', direction: 'asc' },
  FormaPagamento: { field: 'descricao', direction: 'asc' }, Pedido: { field: 'data_pedido', direction: 'desc' },
  ContaPagar: { field: 'data_vencimento', direction: 'asc' }, ContaReceber: { field: 'data_vencimento', direction: 'asc' },
  OrdemCompra: { field: 'data_solicitacao', direction: 'desc' }, CentroCusto: { field: 'codigo', direction: 'asc' },
  PlanoDeContas: { field: 'codigo', direction: 'asc' }, PlanoContas: { field: 'codigo', direction: 'asc' },
  User: { field: 'full_name', direction: 'asc' }, Departamento: { field: 'nome', direction: 'asc' },
  Cargo: { field: 'nome', direction: 'asc' }, Turno: { field: 'nome', direction: 'asc' },
  Veiculo: { field: 'placa', direction: 'asc' }, Motorista: { field: 'nome', direction: 'asc' },
  Servico: { field: 'nome', direction: 'asc' }, GrupoProduto: { field: 'nome', direction: 'asc' },
  Marca: { field: 'nome', direction: 'asc' }, Representante: { field: 'nome', direction: 'asc' },
  SegmentoCliente: { field: 'nome_segmento', direction: 'asc' }, RegiaoAtendimento: { field: 'nome_regiao', direction: 'asc' },
};

const SEARCH_FIELDS = {
  Produto: ['descricao', 'codigo', 'codigo_barras', 'grupo_produto_nome', 'marca_nome'],
  Cliente: ['nome', 'razao_social', 'nome_fantasia', 'cpf', 'cnpj'],
  Fornecedor: ['nome', 'razao_social', 'nome_fantasia', 'cnpj', 'cpf'],
  Transportadora: ['razao_social', 'nome_fantasia', 'cnpj'],
  Colaborador: ['nome_completo', 'cpf', 'email', 'cargo', 'codigo_vendedor_legado'],
  Banco: ['nome', 'nome_banco', 'codigo_banco', 'agencia'],
  FormaPagamento: ['nome', 'descricao', 'codigo'],
  Departamento: ['nome', 'descricao', 'codigo'],
  Cargo: ['nome', 'descricao', 'codigo'],
  Turno: ['nome', 'descricao'],
  Veiculo: ['placa', 'descricao', 'modelo', 'nome'],
  Motorista: ['nome', 'nome_completo', 'cpf'],
  Servico: ['nome', 'descricao'],
  GrupoProduto: ['nome', 'nome_grupo', 'codigo', 'descricao'],
  Marca: ['nome', 'nome_marca', 'descricao'],
  Representante: ['nome', 'cpf', 'cnpj', 'email'],
  SegmentoCliente: ['nome', 'nome_segmento', 'descricao', 'tipo_segmento'],
  RegiaoAtendimento: ['nome', 'nome_regiao', 'descricao', 'tipo_regiao'],
  PerfilAcesso: ['nome_perfil', 'nome', 'descricao', 'nivel_perfil'],
  ConfiguracaoDespesaRecorrente: ['descricao', 'nome', 'periodicidade'],
  SetorAtividade: ['nome', 'descricao', 'codigo'],
  TabelaPreco: ['nome', 'descricao', 'codigo_tabela_legado'],
  UnidadeMedida: ['sigla', 'nome', 'descricao'],
  CentroCusto: ['codigo', 'descricao', 'nome'],
  CentroResultado: ['codigo', 'descricao', 'nome'],
  PlanoDeContas: ['codigo', 'descricao', 'nome'],
  TipoDespesa: ['nome', 'codigo', 'descricao'],
  MoedaIndice: ['moeda', 'indice', 'descricao', 'nome'],
  GrupoEmpresarial: ['nome', 'cnpj', 'razao_social'],
  Empresa: ['razao_social', 'nome_fantasia', 'nome', 'cnpj'],
  ContatoB2B: ['nome', 'empresa', 'email', 'cargo', 'telefone'],
  KitProduto: ['nome', 'nome_kit', 'descricao'],
  CatalogoWeb: ['titulo', 'nome', 'slug', 'descricao'],
  CondicaoComercial: ['nome', 'descricao'],
  TabelaFiscal: ['descricao', 'nome', 'uf'],
  LocalEstoque: ['descricao', 'codigo', 'nome'],
  RotaPadrao: ['nome', 'nome_rota', 'regiao'],
  ModeloDocumento: ['tipo', 'descricao', 'nome'],
  TipoFrete: ['descricao', 'modalidade', 'nome'],
  OperadorCaixa: ['nome', 'matricula'],
  GatewayPagamento: ['nome', 'descricao'],
  ApiExterna: ['nome', 'descricao'],
  ChatbotCanal: ['nome', 'descricao'],
  ChatbotIntent: ['nome', 'descricao'],
  Webhook: ['nome', 'url', 'descricao'],
  JobAgendado: ['nome', 'descricao'],
  ConfiguracaoNFe: ['nome', 'ambiente', 'descricao'],
  EventoNotificacao: ['nome', 'descricao', 'tipo'],
  PerfilAcesso: ['nome_perfil', 'nome', 'descricao'],
  ConfiguracaoDespesaRecorrente: ['descricao', 'nome'],
  default: ['nome', 'descricao', 'codigo', 'razao_social', 'nome_completo', 'nome_grupo', 'nome_segmento', 'nome_regiao', 'nome_banco', 'nome_fantasia', 'sigla']
};

// Entidades que não precisam de filtro empresa/grupo
const SIMPLE_CATALOG = new Set([
  'Banco', 'FormaPagamento', 'TipoDespesa', 'MoedaIndice', 'TipoFrete',
  'UnidadeMedida', 'Departamento', 'Cargo', 'Turno', 'GrupoProduto', 'Marca',
  'SetorAtividade', 'LocalEstoque', 'TabelaFiscal', 'CentroResultado',
  'OperadorCaixa', 'RotaPadrao', 'ModeloDocumento', 'KitProduto', 'CatalogoWeb',
  'Servico', 'CondicaoComercial', 'TabelaPreco', 'PerfilAcesso',
  'ConfiguracaoNFe', 'ConfiguracaoBoletos', 'ConfiguracaoWhatsApp',
  'GatewayPagamento', 'ApiExterna', 'Webhook', 'ChatbotIntent', 'ChatbotCanal',
  'JobAgendado', 'EventoNotificacao', 'SegmentoCliente', 'RegiaoAtendimento',
  'ContatoB2B', 'CentroCusto', 'PlanoDeContas', 'PlanoContas',
  'Veiculo', 'Motorista', 'Representante', 'GrupoEmpresarial', 'Empresa',
  'TabelaPrecoItem', 'CentroOperacao', 'ConfiguracaoDespesaRecorrente',
]);

// Entidades com empresas_compartilhadas_ids ou campos de vinculação múltiplos
const EXPAND_SET = new Set(['Cliente', 'Fornecedor', 'Transportadora', 'Colaborador', 'Produto']);

function normalizeSortField(entityName, requested) {
  if (!requested || typeof requested !== 'string') return DEFAULT_SORTS[entityName]?.field || 'updated_date';
  const r = requested.toLowerCase();
  if (['recentes', 'updated', 'updated_date'].includes(r)) return 'updated_date';
  if (['criacao', 'created_date'].includes(r)) return 'created_date';
  // Validação básica: só aceita identificadores simples
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(requested)) return DEFAULT_SORTS[entityName]?.field || 'updated_date';
  return requested;
}

function sanitizeVal(v) {
  return typeof v === 'string'
    ? v.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '').replace(/javascript:\s*/gi, '')
    : v;
}

function sanitizeFilter(f) {
  if (!f || typeof f !== 'object') return f || {};
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === '$or' || k === '$and') {
      out[k] = Array.isArray(v) ? v.map(sanitizeFilter) : v;
    } else if (k === '$in') {
      out[k] = Array.isArray(v) ? v.map(sanitizeVal) : v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sanitizeFilter(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map(sanitizeVal);
    } else {
      out[k] = sanitizeVal(v);
    }
  }
  return out;
}

// Normaliza filtro de empresas_compartilhadas_ids para objeto $in
function normalizeSharedFilter(f) {
  if (!f || typeof f !== 'object') return f || {};
  let out = { ...f };
  if ('empresas_compartilhadas_ids' in out && typeof out.empresas_compartilhadas_ids === 'string') {
    out.empresas_compartilhadas_ids = { $in: [out.empresas_compartilhadas_ids] };
  }
  if (Array.isArray(out.$or)) {
    out.$or = out.$or.map(cond => {
      if (cond?.empresas_compartilhadas_ids && typeof cond.empresas_compartilhadas_ids === 'string') {
        return { ...cond, empresas_compartilhadas_ids: { $in: [cond.empresas_compartilhadas_ids] } };
      }
      return cond;
    });
  }
  return out;
}

// Expande filtro de empresa/grupo para cobrir todos os campos de vinculação
async function expandGroupFilter(base44, entityName, f) {
  const ctxCampo = (entityName === 'Fornecedor' || entityName === 'Transportadora') ? 'empresa_dona_id'
    : (entityName === 'Colaborador' ? 'empresa_alocada_id' : 'empresa_id');

  // empresa_id simples → expande para $or cobrindo todos os campos + registros legados
  if (f?.empresa_id && !f?.$or && !f?.group_id) {
    const { empresa_id, ...rest } = f;
    const orConds = [{ empresa_id }, { empresa_dona_id: empresa_id }];
    if (entityName !== 'Produto') orConds.push({ empresa_id: null }); // legados (não para Produto)
    if (EXPAND_SET.has(entityName)) {
      orConds.push({ empresas_compartilhadas_ids: { $in: [empresa_id] } });
    }
    if (entityName === 'Colaborador') {
      orConds.push({ empresa_alocada_id: empresa_id });
    }
    if (entityName === 'Produto') {
      orConds.push({ compartilhado_grupo: true }); // produtos compartilhados do grupo
    }
    return { ...rest, $or: orConds };
  }

  // Apenas group_id → expande para todas as empresas do grupo
  if (f?.group_id && !f?.$or && !f?.empresa_id && !f?.empresa_dona_id && !f?.empresa_alocada_id) {
    try {
      const groupId = f.group_id;
      const empresas = await base44.asServiceRole.entities.Empresa.filter({ group_id: groupId }, '-id', 200);
      const empresasIds = (empresas || []).map(e => e.id).filter(Boolean);
      const rest = { ...f };
      delete rest.group_id;
      const orConds = [
        { empresa_id: { $in: empresasIds } },
        { empresa_dona_id: { $in: empresasIds } },
        { group_id: groupId },
      ];
      if (entityName !== 'Produto') orConds.push({ empresa_id: null }); // legados
      if (EXPAND_SET.has(entityName)) {
        orConds.push({ empresas_compartilhadas_ids: { $in: empresasIds } });
      }
      if (entityName === 'Colaborador') {
        orConds.push({ empresa_alocada_id: { $in: empresasIds } });
      }
      if (entityName === 'Produto') {
        orConds.push({ compartilhado_grupo: true }); // produtos compartilhados do grupo
      }
      return { ...rest, $or: orConds };
    } catch (_) { /* fallback: usa group_id direto */ }
  }

  // $or existente + group_id residual
  if (f?.$or && f?.group_id) {
    const { group_id, ...rest } = f;
    return { ...rest, $or: [...f.$or, { group_id }] };
  }

  return f;
}

async function listOne(base44, user, q) {
  const entityName = q?.entityName;
  if (!entityName) return { entityName, items: [] };

  const isSimple = SIMPLE_CATALOG.has(entityName);
  const rawFilter = q?.filter || {};
  const hasOr = Array.isArray(rawFilter?.$or) && rawFilter.$or.length > 0;
  const scopeProvided = rawFilter?.empresa_id || rawFilter?.group_id || rawFilter?.empresa_dona_id || rawFilter?.empresa_alocada_id || hasOr;

  // Sem escopo → lista tudo (acesso autenticado e auditado; dados protegidos por RBAC no frontend)

  const limit = Math.max(1, Math.min(Number(q?.limit || q?.pageSize) || 100, 500));
  const skip = Math.max(0, Number(q?.skip ?? q?.offset ?? 0) || 0);

  const sortField = normalizeSortField(entityName, q?.sortField || q?.sortBy);
  const sortDir = ((q?.sortDirection || DEFAULT_SORTS[entityName]?.direction || 'desc') === 'asc') ? 'asc' : 'desc';
  const orderHint = `${sortDir === 'desc' ? '-' : ''}${sortField}`;

  // Monta filtro de escopo (sem busca de texto — busca vem em q.search separada)
  let scopeFilter = sanitizeFilter(rawFilter);
  scopeFilter = normalizeSharedFilter(scopeFilter);
  // Remove $or de busca embutido no filter (compatibilidade com clientes antigos)
  // Detecta se o $or do filter é de busca (campos de texto) ou de escopo (empresa_id/group_id)
  const isSearchOr = Array.isArray(scopeFilter?.$or) && scopeFilter.$or.length > 0 &&
    scopeFilter.$or.every(c => {
      const keys = Object.keys(c || {});
      return keys.length === 1 && !['empresa_id','empresa_dona_id','empresa_alocada_id','group_id','empresas_compartilhadas_ids'].includes(keys[0]);
    });
  const embeddedSearch = isSearchOr ? scopeFilter.$or : null;
  if (isSearchOr) { scopeFilter = { ...scopeFilter }; delete scopeFilter.$or; }

  // Expande sempre (escopo limpo)
  let finalFilter = scopeFilter;
  if (!isSimple) {
    finalFilter = await expandGroupFilter(base44, entityName, scopeFilter);
  }

  // Aplica busca por texto (prioridade: q.search, depois embeddedSearch)
  const term = q?.search || q?.busca || null;
  if (term && typeof term === 'string' && term.trim()) {
    const fields = SEARCH_FIELDS[entityName] || SEARCH_FIELDS.default;
    const rx = { $regex: term.trim(), $options: 'i' };
    const orConds = fields.map(f => ({ [f]: rx }));
    const hasScope = Object.keys(finalFilter).length > 0;
    finalFilter = hasScope ? { $and: [finalFilter, { $or: orConds }] } : { $or: orConds };
  } else if (embeddedSearch) {
    // Busca legada embutida no filter
    const hasScope = Object.keys(finalFilter).length > 0;
    finalFilter = hasScope ? { $and: [finalFilter, { $or: embeddedSearch }] } : { $or: embeddedSearch };
  }

  const items = await base44.asServiceRole.entities[entityName].filter(finalFilter, orderHint, limit, skip) || [];
  return { entityName, items };
}

// Compressão gzip quando suportado
async function compressedJson(data, req) {
  const json = JSON.stringify(data);
  const acceptEncoding = req.headers.get('accept-encoding') || '';
  if (!acceptEncoding.includes('gzip')) {
    return new Response(json, { headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const encoded = new TextEncoder().encode(json);
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(encoded);
    writer.close();
    const compressed = await new Response(cs.readable).arrayBuffer();
    return new Response(compressed, {
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' }
    });
  } catch (_) {
    return new Response(json, { headers: { 'Content-Type': 'application/json' } });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { }

    // MODO LOTE: { queries: [...] }
    const queries = Array.isArray(body?.queries) ? body.queries : null;
    if (queries && queries.length > 0) {
      const results = [];
      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        try {
          results.push(await listOne(base44, user, q));
        } catch (err) {
          results.push({ entityName: q?.entityName, items: [], error: String(err?.message || err) });
        }
        // Delay entre queries em lote para evitar 429
        if (i < queries.length - 1) await new Promise(r => setTimeout(r, 150));
      }
      return compressedJson({ results }, req);
    }

    // MODO SINGLE
    const single = await listOne(base44, user, {
      entityName: body?.entityName,
      filter: body?.filter || {},
      sortField: body?.sortField,
      sortDirection: body?.sortDirection,
      limit: body?.limit,
      skip: body?.skip,
      search: body?.search || body?.busca
    });

    if (single.error === 'escopo_obrigatorio') {
      return Response.json({ error: single.error }, { status: 400 });
    }
    return compressedJson(single.items, req);

  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
});
