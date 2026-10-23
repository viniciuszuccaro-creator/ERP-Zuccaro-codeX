import { serializeReportCsv } from './csv.js';
import { resolveGuardPermission, permissionNodeAllows, validateGuardContext } from '../entityGuardPolicy/entry.ts';
import { evaluateMfaScopeAccess } from '../totpVerificationPolicy/entry.ts';

// Authoritative backend ownership; caller-supplied module/role never selects a grant.
const OWNERS = {
  Cliente:['Cadastros','Pessoas'], Fornecedor:['Cadastros','Pessoas'], Representante:['Cadastros','Pessoas'],
  Transportadora:['Cadastros','Pessoas'], Colaborador:['Cadastros','Pessoas'], ContatoB2B:['Cadastros','Pessoas'],
  Produto:['Estoque','Produtos'], MovimentacaoEstoque:['Estoque','Movimentacoes'], Inventario:['Estoque','Inventario'],
  Pedido:['Comercial','pedido'], Orcamento:['Comercial','orcamento'], ClienteEmpresa:['Cadastros','Pessoas'],
  ContaReceber:['Financeiro','ContaReceber'], ContaPagar:['Financeiro','ContaPagar'],
  NotaFiscal:['Fiscal','NotaFiscal'], NFe:['Fiscal','NotaFiscal'], Oportunidade:['CRM','Oportunidade'],
  Empresa:['Cadastros','Organizacional'], GrupoEmpresarial:['Cadastros','Organizacional'],
  User:['Sistema','Controle de Acesso'], PerfilAcesso:['Sistema','Controle de Acesso'],
  ConfiguracaoSistema:['Sistema','Configuracoes'], UnidadeMedida:['Cadastros','UnidadeMedida'],
};
export const REPORT_FIELDS = {
  Pedido:['numero_pedido','cliente_nome','vendedor','valor_total','status','data_pedido'],
  Cliente:['nome','tipo','cidade','estado','status','limite_credito'],
  Produto:['codigo','descricao','grupo','estoque_atual','preco_venda','custo_aquisicao'],
  ContaReceber:['cliente','valor','data_vencimento','status','forma_recebimento'],
  ContaPagar:['fornecedor','valor','data_vencimento','status','categoria'],
  NotaFiscal:['numero','tipo','cliente_fornecedor','valor_total','status','data_emissao'],
  Oportunidade:['titulo','cliente_nome','etapa','valor_estimado','probabilidade','responsavel'],
};
export class EntityReadError extends Error {
  status: number;
  constructor(code = 'READ_FORBIDDEN', status = 403) { super(code); this.status = status; }
}
const fail = (code = 'READ_FORBIDDEN', status = 403): never => { throw new EntityReadError(code,status); };
const key = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const root = (object, name) => object?.[Object.keys(object || {}).find(item => key(item) === key(name)) || ''];
const normalizedPermissions = permissions => Object.fromEntries(Object.entries(permissions || {}).map(([name,node]) => [name,node]));
function allows(permissions, moduleName, section, action, strict = false) {
  const module = root(permissions,moduleName);
  const node = root(module,section);
  if (strict) return permissionNodeAllows(node,action);
  return resolveGuardPermission({ permissions:{ ...normalizedPermissions(permissions), [moduleName]:{ [section]:node } }, moduleName,section,action });
}
const secret = name => /password|senha|secret|token|private.?key|api.?key|certificado_a1|certificado_base64/i.test(name);
const sensitive = name => /custo|margem/i.test(name) ? 'custo' : /salario/i.test(name) ? 'salario' : /dados_bancarios|conta_bancaria|chave_pix|agencia_bancaria/i.test(name) ? 'dados-bancarios' : /credito/i.test(name) ? 'credito'
  : /comissao/i.test(name) ? 'comissao' : /(^nome($|_)|razao_social|full_name|cpf|cnpj|email|telefone|celular|whatsapp|endereco|^cep$|cidade|estado|cliente_nome|cliente_fornecedor|^cliente$|^fornecedor$|responsavel|vendedor)/i.test(name) ? 'dados-pessoais' : null;
const reportOwner = (kind): [string,string] => kind === 'representantes' ? ['Comercial','Representantes'] : ['Relatorios','Personalizado'];
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
function checkFilter(filter, depth = 0) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter) || depth > 8) fail('READ_INVALID_FILTER',400);
  for (const [name,value] of Object.entries(filter)) {
    if (['__proto__','prototype','constructor'].includes(name) || name.length > 100 || name.startsWith('$') && !['$and','$or','$in','$nin','$eq','$ne','$gt','$gte','$lt','$lte','$exists','$regex','$options'].includes(name)) fail('READ_INVALID_FILTER',400);
    if (Array.isArray(value)) {
      if (value.length > 100) fail('READ_INVALID_FILTER',400);
      for (const item of value) if (item && typeof item === 'object') checkFilter(item,depth+1);
    } else if (value && typeof value === 'object') checkFilter(value,depth+1);
    else if (typeof value === 'string' && value.length > 300) fail('READ_INVALID_FILTER',400);
  }
}
export async function authorizeEntityRead(base44, user, query: Record<string,any> = {}, cache = new Map()) {
  const entity = query.entityName;
  if (!user?.id || user.disabled === true) fail('READ_UNAUTHORIZED',401);
  if (!/^[A-Z][A-Za-z0-9]{0,79}$/.test(entity || '')) fail('READ_INVALID_ENTITY',400);
  const filter = query.filter ?? {}; checkFilter(filter);
  if (!user.perfil_acesso_id) fail();
  let profile = cache.get('profile');
  if (!profile) {
    profile = await base44.asServiceRole.entities.PerfilAcesso.get(user.perfil_acesso_id);
    if (!profile || profile.ativo === false) fail(); cache.set('profile',profile);
  }
  const permissions = profile.permissoes;
  const [moduleName,section] = OWNERS[entity] || ['Cadastros',entity];
  if (!allows(permissions,moduleName,section,'visualizar')) fail();
  const report = query.report;
  if (report && !['personalizado','representantes'].includes(report.kind)) fail('REPORT_INVALID_KIND',400);
  if (report) {
    const [mod,part] = reportOwner(report.kind);
    if (!allows(permissions,mod,part,'visualizar',true)) fail();
    if (report.action && !['visualizar','exportar'].includes(report.action)) fail('REPORT_INVALID_ACTION',400);
    if (report.action === 'exportar' && !allows(permissions,mod,part,'exportar',true)) fail();
  }
  const requestedGroup = filter.group_id || filter.grupo_id;
  const requestedCompany = filter.empresa_id || filter.empresa_dona_id || filter.empresa_alocada_id;
  if (requestedGroup && typeof requestedGroup !== 'string' || requestedCompany && typeof requestedCompany !== 'string') fail('READ_INVALID_SCOPE',400);
  const input = query.context || { groupId:requestedGroup || user.grupo_atual_id || user.grupo_padrao_id,
    empresaId:requestedCompany || (!requestedGroup ? user.empresa_atual_id || user.empresa_padrao_id : null) };
  const context = validateGuardContext(input);
  if (!context.valid || !validId(context.groupId) || context.empresaId && !validId(context.empresaId)) fail('READ_INVALID_SCOPE',400);
  const scopeKey = JSON.stringify([context.groupId,context.empresaId]);
  let scope = cache.get(scopeKey);
  if (!scope) {
    const groups = await base44.asServiceRole.entities.GrupoEmpresarial.filter({ id:context.groupId },undefined,1);
    const companies = context.empresaId ? await base44.asServiceRole.entities.Empresa.filter({ id:context.empresaId },undefined,1) : [];
    if (!evaluateMfaScopeAccess(context,{ user,groups,companies }).allowed) fail();
    const companyIds = context.empresaId ? [context.empresaId] : user.pode_ver_todas_empresas === true ? null :
      [...new Set([user.empresa_atual_id,user.empresa_padrao_id,...(user.empresas_vinculadas || []).filter(link => link?.ativo !== false).map(link => typeof link === 'string' ? link : link.empresa_id || link.company_id || link.id)].filter(Boolean))];
    scope = { companyIds }; cache.set(scopeKey,scope);
  }
  // Reject explicit claims even when nested; mandatory server predicate remains an AND.
  function claims(value, field = '') {
    if (Array.isArray(value)) { value.forEach(item => claims(item,field)); return; }
    if (value && typeof value === 'object') { Object.entries(value).forEach(([name,item]) => claims(item,name.startsWith('$') ? field : name)); return; }
    if (value == null) return;
    if (['group_id','grupo_id'].includes(field) && value !== context.groupId) fail();
    if (['empresa_id','empresa_dona_id','empresa_alocada_id'].includes(field) && scope.companyIds && !scope.companyIds.includes(value)) fail();
  }
  claims(filter);
  const ctxField = entity === 'Fornecedor' || entity === 'Transportadora' ? 'empresa_dona_id' : entity === 'Colaborador' ? 'empresa_alocada_id' : 'empresa_id';
  const groupFilter = { $or:[{ group_id:context.groupId },{ grupo_id:context.groupId }] };
  let mandatory: object = groupFilter;
  if (entity === 'GrupoEmpresarial') mandatory = { id:context.groupId };
  else if (entity === 'Empresa') mandatory = { $and:[groupFilter,...(scope.companyIds ? [{ id:{ $in:scope.companyIds } }] : [])] };
  else if (scope.companyIds) mandatory = { $and:[groupFilter,{ $or:[{ [ctxField]:{ $in:scope.companyIds } },{ [ctxField]:null, compartilhado_grupo:true },...(['Cliente','Fornecedor','Transportadora','Colaborador','Produto'].includes(entity) ? [{ empresas_compartilhadas_ids:{ $in:scope.companyIds } }] : [])] }] };
  const [grantModule,grantSection] = report ? reportOwner(report.kind) : [moduleName,section];
  const grant = name => !secret(name) && (!sensitive(name) || allows(permissions,grantModule,grantSection,sensitive(name),true));
  function validateSelection(value) {
    if (Array.isArray(value)) { value.forEach(validateSelection); return; }
    if (!value || typeof value !== 'object') return;
    for (const [name,item] of Object.entries(value)) {
      if (!name.startsWith('$') && !grant(name)) fail();
      validateSelection(item);
    }
  }
  validateSelection(filter);
  function project(value) {
    if (Array.isArray(value)) return value.map(project);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([name]) => grant(name)).map(([name,item]) => [name,project(item)]));
  }
  return { context, filter:{ $and:[filter,mandatory] }, grant, project, permissions };
}
export const safeReadError = error => Response.json({ error:error instanceof EntityReadError ? error.message : 'READ_UNAVAILABLE' },{ status:error instanceof EntityReadError ? error.status : 503 });

const boundedInteger = (value, fallback, max) => {
  const number = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > max) fail('READ_INVALID_PAGE',400);
  return number;
};
export async function readSecureReport(base44, user, query) {
  const report = query.report;
  const cache = new Map();
  if (report.kind === 'personalizado' && !REPORT_FIELDS[query.entityName] || report.kind === 'representantes' && query.entityName !== 'Representante') fail('REPORT_INVALID_ENTITY',400);
  const entities = report.kind === 'representantes' ? ['Representante','Cliente','Pedido'] : [query.entityName];
  const access = {};
  for (const entityName of entities) access[entityName] = await authorizeEntityRead(base44,user,{ ...query,entityName },cache);
  const primary = access[query.entityName];
  const requested = report.fields;
  if (requested !== undefined && (!Array.isArray(requested) || requested.length > 30 || requested.some(field => !REPORT_FIELDS[query.entityName]?.includes(field) || !primary.grant(field)))) fail();
  const limit = Math.max(1,boundedInteger(query.limit,50,200));
  const offset = boundedInteger(query.skip,0,100000);
  let fields, data, meta, capabilities;
  if (report.kind === 'personalizado') {
    fields = requested?.length ? requested : REPORT_FIELDS[query.entityName].filter(primary.grant);
    let rows = [];
    if (report.action === 'exportar') {
      // Export every filtered row, with a hard safety bound; never export a partial total.
      for (let skip=0;skip<=5000;skip+=200) {
        const batch = await base44.asServiceRole.entities[query.entityName].filter(primary.filter,'id',200,skip);
        if (!Array.isArray(batch) || batch.length > 200) fail('REPORT_INVALID_PAGE',503);
        rows.push(...batch);
        if (rows.length > 5000) fail('REPORT_SCOPE_TOO_LARGE',409);
        if (batch.length < 200) break;
      }
      meta = { offset:0,limit:rows.length,hasMore:false,total:rows.length,coverage:'complete' };
    } else {
      rows = await base44.asServiceRole.entities[query.entityName].filter(primary.filter,'id',limit+1,offset);
      if (!Array.isArray(rows) || rows.length > limit+1) fail('REPORT_INVALID_PAGE',503);
      meta = { offset,limit,hasMore:rows.length>limit,total:null,coverage:'page' };
      rows = rows.slice(0,limit);
    }
    data = rows.map(row => Object.fromEntries(['id','group_id','empresa_id',...fields].map(field =>
      [field,field === 'group_id' ? row.group_id || row.grupo_id : row[field] ?? null])));
  } else {
    const period = report.periodo || 'mes';
    if (!['mes','trimestre','ano','todos'].includes(period)) fail('REPORT_INVALID_PERIOD',400);
    const start = new Date();
    if (period === 'mes') start.setDate(1);
    if (period === 'trimestre') { start.setMonth(Math.floor(start.getMonth()/3)*3,1); }
    if (period === 'ano') start.setMonth(0,1);
    const loaded: Record<string,any[]> = {};
    for (const entity of entities) {
      const extra = entity === 'Pedido' && period !== 'todos' ? { data_pedido:{ $gte:start.toISOString().slice(0,10) } } : {};
      const rows = await base44.asServiceRole.entities[entity].filter({ $and:[access[entity].filter,extra] },'id',500,0);
      if (!Array.isArray(rows) || rows.length >= 500) fail('REPORT_SCOPE_TOO_LARGE',409);
      loaded[entity] = rows;
    }
    capabilities = { comissao:primary.grant('comissao'), dadosPessoais:primary.grant('nome') };
    const finite = value => { const number = Number(value || 0); if (!Number.isFinite(number) || Math.abs(number) > 1e9) fail('REPORT_INVALID_AMOUNT',409); return number; };
    data = loaded.Representante.filter(rep => !report.tipo || report.tipo === 'todos' || rep.tipo_representante === report.tipo).map(rep => {
      const orders = loaded.Pedido.filter(order => order.indicador_id === rep.id && !['Cancelado','CANCELADO'].includes(order.status));
      const vendas = orders.reduce((sum,order) => sum + Math.round(finite(order.valor_total)*100),0)/100;
      return { id:rep.id, group_id:rep.group_id || rep.grupo_id, empresa_id:rep.empresa_id || null,
        nome:capabilities.dadosPessoais ? rep.nome || rep.id : rep.id, tipo:rep.tipo_representante || 'Outro',
        clientes:loaded.Cliente.filter(client => client.indicador_id === rep.id).length, pedidos:orders.length, vendas,
        ...(capabilities.comissao ? { comissao:orders.reduce((sum,order) => sum + Math.round(finite(order.valor_total)*finite(rep.percentual_comissao) + finite(rep.valor_fixo_comissao)*100),0)/100 } : {}) };
    });
    fields = ['nome','tipo','clientes','pedidos','vendas',...(capabilities.comissao ? ['comissao'] : [])];
    meta = { offset:0,limit:data.length,hasMore:false,total:data.length,coverage:'complete' };
  }
  const result = { contract:'secure-report-v1',data,fields,meta,capabilities,scope:primary.context };
  if (report.action === 'exportar') {
    // Recheck grants immediately before auditing/releasing bytes. No success on audit failure.
    const freshUser = await base44.auth.me();
    if (freshUser?.id !== user.id) fail('READ_UNAUTHORIZED',401);
    const freshCache = new Map();
    for (const entityName of entities) {
      const fresh = await authorizeEntityRead(base44,freshUser,{ ...query,entityName },freshCache);
      if (entityName === query.entityName && (report.kind === 'personalizado'
        ? fields.some(field => !fresh.grant(field))
        : capabilities.comissao && !fresh.grant('comissao') || capabilities.dadosPessoais && !fresh.grant('nome'))) fail();
    }
    await base44.asServiceRole.entities.AuditLog.create({ acao:'Exportacao',modulo:'Relatorios',entidade:query.entityName,
      usuario_id:user.id,group_id:primary.context.groupId,empresa_id:primary.context.empresaId,
      descricao:'Exportacao de relatorio autorizado',sucesso:true,tipo_auditoria:'sensivel',data_hora:new Date().toISOString(),
      dados_novos:{ kind:report.kind,fields,offset:meta.offset,limit:meta.limit,quantidade:data.length,coverage:meta.coverage } });
    return { ...result,csv:serializeReportCsv(data,[...fields,'group_id','empresa_id']) };
  }
  return result;
}
