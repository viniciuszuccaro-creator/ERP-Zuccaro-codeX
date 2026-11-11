import { authorizeEntityRead, readSecureReport, safeReadError, EntityReadError } from '../_lib/security/entityReadPolicy/entry.ts';
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
  Fornecedor: ['nome', 'razao_social', 'nome_fantasia', 'codigo', 'cpf_cnpj', 'cnpj', 'cpf'],
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

function normalizeSortField(entityName, requested) {
  if (!requested || typeof requested !== 'string') return DEFAULT_SORTS[entityName]?.field || 'updated_date';
  const r = requested.toLowerCase();
  if (['recentes', 'updated', 'updated_date'].includes(r)) return 'updated_date';
  if (['criacao', 'created_date'].includes(r)) return 'created_date';
  // Validação básica: só aceita identificadores simples
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(requested)) return DEFAULT_SORTS[entityName]?.field || 'updated_date';
  return requested;
}

async function listOne(base44, user, q, cache = new Map()) {
  const access = await authorizeEntityRead(base44,user,q,cache);
  const entityName = q?.entityName;
  if (!entityName) return { entityName, items: [] };

  const limit = Number(q?.limit ?? q?.pageSize ?? 100);
  const skip = Number(q?.skip ?? q?.offset ?? 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !Number.isSafeInteger(skip) || skip < 0 || skip > 100000) throw new EntityReadError('READ_INVALID_PAGE',400);

  const requestedSort = normalizeSortField(entityName, q?.sortField || q?.sortBy);
  const sortField = access.grant(requestedSort) ? requestedSort : 'id';
  const sortDir = ((q?.sortDirection || DEFAULT_SORTS[entityName]?.direction || 'desc') === 'asc') ? 'asc' : 'desc';
  const orderHint = `${sortDir === 'desc' ? '-' : ''}${sortField}`;

  // The authorization predicate is immutable; text search can only narrow it.
  let finalFilter = access.filter;
  const term = q?.search || q?.busca || null;
  if (term != null && (typeof term !== 'string' || term.length > 200)) throw new EntityReadError('READ_INVALID_SEARCH',400);
  if (term?.trim()) {
    const fields = (SEARCH_FIELDS[entityName] || SEARCH_FIELDS.default).filter(access.grant);
    if (!fields.length) throw new EntityReadError('READ_FORBIDDEN',403);
    const literal = term.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    finalFilter = { $and:[finalFilter,{ $or:fields.map(field => ({ [field]:{ $regex:literal,$options:'i' } })) }] };
  }

  const items = await base44.asServiceRole.entities[entityName].filter(finalFilter, orderHint, limit, skip) || [];
  return { entityName, items:items.map(access.project) };
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

    if (body?.report) return compressedJson(await readSecureReport(base44,user,body),req);
    const cache = new Map();
    // MODO LOTE: { queries: [...] }
    const queries = Array.isArray(body?.queries) ? body.queries : null;
    if (queries && queries.length > 0) {
      if (queries.length > 20) return Response.json({ error:'READ_INVALID_BATCH' },{ status:400 });
      for (const q of queries) await authorizeEntityRead(base44,user,q,cache);
      const results = [];
      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        try {
          results.push(await listOne(base44, user, q, cache));
        } catch (err) {
          results.push({ entityName: q?.entityName, items: [], error:err instanceof EntityReadError ? err.message : 'READ_UNAVAILABLE' });
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
      context: body?.context,
      search: body?.search || body?.busca
    });

    return compressedJson(single.items, req);

  } catch (err) {
    return safeReadError(err);
  }
});
