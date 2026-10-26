import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { z } from 'zod';
import { fixture } from './helpers/entityReadFixture.js';

const grants = () => ({ Cadastros:{ Pessoas:['visualizar'] },Comercial:{ pedido:['visualizar'],Representantes:['visualizar','exportar','dados-pessoais','comissao'] },
  Relatorios:{ Personalizado:['visualizar','exportar','dados-pessoais'] } });
const defer = () => { let resolve; const promise = new Promise(yes => { resolve=yes; }); return { promise,resolve }; };
function mount(component = 'DashboardRepresentantes', mode = 'remote') {
  const f = fixture(grants()), backend = f.handler('entityListSorted');
  const state=[],effects=[],scheduled=[],memos=[],queries=[],downloads=[],calls=[],messages=[];
  const profile = { permissoes:f.state.permissions };
  const actor = { user:f.state.user,isLoading:false };
  const context = { grupoAtual:{ id:'group-a' },empresaAtual:{ id:'company-a' } };
  let slot=0,tree,override;
  const react = {
    createElement:(type,props,...children) => ({ type,props:props||{},children:children.flat(Infinity) }),
    lazy: factory => ({ lazy:factory.toString() }),Suspense:'Suspense',
    useState(initial) { const i=slot++; if (!(i in state)) state[i]=typeof initial==='function'?initial():initial;
      return [state[i],value => { state[i]=typeof value==='function'?value(state[i]):value; }]; },
    useRef(initial) { const i=slot++; return state[i] ||= { current:initial }; },
    useMemo(fn,deps) { const i=slot++; if (!memos[i] || deps.some((v,j)=>!Object.is(v,memos[i].deps[j]))) memos[i]={ deps,value:fn() }; return memos[i].value; },
    useEffect(fn,deps) { const i=slot++; if (effects[i] && deps.every((v,j)=>Object.is(v,effects[i].deps[j]))) return;
      effects[i]?.cleanup?.(); scheduled.push(()=>{ effects[i]={ deps,cleanup:fn() }; }); },
  };
  const queryCache = new Map(),client = { cancelQueries:async()=>{},removeQueries:()=>{},invalidateQueries:async()=>{} };
  const ui = new Proxy({ __esModule:true,default:'UI' },{ get:(obj,key)=>obj[key]??key });
  const modules = {
    react:{ __esModule:true,default:react,...react },zod:{ z },
    '@tanstack/react-query':{ useQueryClient:()=>client,useMutation:()=>({}),useQuery:options => {
      queries.push(options); const key=JSON.stringify(options.queryKey);
      return { data:queryCache.get(key),isLoading:!queryCache.has(key) && options.enabled,isFetching:false,isError:false,refetch:async()=>{} };
    } },
    '@/api/base44Client':{ erpBackendMode:mode,base44:{ functions:{ invoke:async(name,payload)=>{
      calls.push({name,payload}); if (override) return override(); const result=await backend(payload);
      if (result.status!==200) throw new Error(result.body.error); return { data:result.body };
    } },entities:{ AuditLog:{ create:async()=>{} } } } },
    '@/components/ui/use-toast':{ useToast:()=>({ toast:message=>messages.push(message) }) },
    '@/api/erpHttpSession':{ readErpHttpSession:()=>({ token:'synthetic-session' }) },
    '@/components/lib/useContextoVisual':{ __esModule:true,default:()=>context },
    '@/components/lib/usePermissions':{ __esModule:true,default:()=>({ user:actor.user,perfilAcesso:profile,isLoading:false,hasPermission:()=>true }) },
    '@/components/lib/UserContext':{ useUser:()=>actor },
    sonner:{ toast:{ error:message=>messages.push(message) } },
  };
  const cache=new Map();
  function load(file) {
    file=path.resolve(file); if (cache.has(file)) return cache.get(file);
    const exports={};cache.set(file,exports);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{ compilerOptions:{ module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022 } }).outputText;
    const require=id=>{
      if (modules[id]) return modules[id];
      if (id==='./useSecureReport' || id==='@/components/relatorios/useSecureReport') return load('src/components/relatorios/useSecureReport.js');
      if (id.includes('entityGuardPolicy/entry')) return load('base44/functions/_lib/security/entityGuardPolicy/entry.ts');
      if (id.startsWith('@/components/') || id==='lucide-react' || id==='recharts') return ui;
      throw new Error(`Unexpected import ${id}`);
    };
    new Function('exports','require','URL','Blob','document','window','localStorage',code)(exports,require,
      { createObjectURL:()=> 'blob:synthetic',revokeObjectURL:()=>{} },Blob,
      { createElement:()=>({ click(){ downloads.push(this.download); } }) },
      { location:{ search:'?tab=personalizado' } },{ getItem:()=>null });
    return exports;
  }
  const file=component==='Relatorios'?'src/pages/Relatorios.jsx':`src/components/relatorios/${component}.jsx`;
  const implementation=load(file).default;
  function render() { slot=0;queries.length=0;tree=implementation();scheduled.splice(0).forEach(fn=>fn());return tree; }
  function walk(node) { return node && typeof node==='object'?[node,...(node.children||[]).flatMap(walk)]:[]; }
  const text=node=>typeof node==='string'||typeof node==='number'?String(node):(node?.children||[]).map(text).join('');
  const find=predicate=>{ const node=walk(tree).find(predicate);assert.ok(node,'existing rendered control');return node; };
  const button=label=>find(node=>node.type==='Button' && text(node).trim()===label);
  async function fetchReport() { const q=queries.find(q=>q.queryKey[0]==='secure-report');assert.ok(q?.enabled);const data=await q.queryFn();queryCache.set(JSON.stringify(q.queryKey),data);render();return data; }
  render();
  return { f,profile,actor,context,queries,calls,downloads,messages,render,fetchReport,button,find,text:()=>text(tree),
    hook:()=>load('src/components/relatorios/useSecureReport.js'),
    override:value=>{ override=value; },unmount:()=>effects.forEach(effect=>effect?.cleanup?.()) };
}

test('348 real Representatives component reads authorized aggregate and exports audited complete CSV',async()=>{
  const h=mount();assert.ok(!h.text().includes('Total em Vendas'));
  await h.fetchReport();assert.ok(h.text().includes('Total em Vendas'));assert.ok(h.text().includes('=SUM(1)'));
  await h.button('Exportar').props.onClick();assert.equal(h.downloads.length,1);assert.equal(h.f.state.audits.length,1);
  assert.equal(h.calls.at(-1).payload.report.action,'exportar');assert.equal(h.f.state.audits[0].dados_novos.coverage,'complete');
});
test('348 real custom component generates selected report, navigates server pages, exports ALL filtered rows',async()=>{
  const h=mount('RelatorioPersonalizado');
  h.f.state.rows.Pedido=Array.from({length:55},(_,i)=>({...h.f.state.rows.Pedido[0],id:`order-${i}`}));
  h.button('Gerar Relatório').props.onClick();h.render();await h.fetchReport();
  assert.ok(h.text().includes('50 registro(s) nesta página'));assert.equal(h.button('Próxima').props.disabled,false);
  h.button('Próxima').props.onClick();h.render();await h.fetchReport();assert.ok(h.text().includes('5 registro(s) nesta página'));
  assert.equal(h.calls.at(-1).payload.skip,50);await h.button('CSV').props.onClick();
  assert.equal(h.downloads.length,1);assert.equal(h.f.state.audits.at(-1).dados_novos.quantidade,55);
});
test('348 report routes restore initial tab before legacy queries and mount existing component',()=>{
  const h=mount('Relatorios');assert.ok(h.queries.filter(q=>q.queryKey[0]!=='perfil-acesso').every(q=>!q.enabled));
  h.find(node=>node.type?.lazy?.includes('RelatorioPersonalizado'));
});
test('348 exact report grant required even when broad frontend permission returns true',()=>{
  const h=mount();h.profile.permissoes={ '*':['visualizar','exportar'] };h.render();
  assert.equal(h.queries.find(q=>q.queryKey[0]==='secure-report').enabled,false);assert.equal(h.button('Exportar').props.disabled,true);assert.equal(h.calls.length,0);
});
test('348 unsupported environment never falls back to local entity reads',()=>{
  const h=mount('DashboardRepresentantes','http');assert.equal(h.queries[0].enabled,false);assert.equal(h.calls.length,0);assert.ok(h.text().includes('não está disponível'));
});
test('348 stale query and export callbacks cannot run after context changes',async()=>{
  const h=mount();const captured=h.queries[0].queryFn;await h.fetchReport();const exportOld=h.button('Exportar').props.onClick;
  h.context.empresaAtual={id:'company-b'};h.render();await assert.rejects(captured(),/SCOPE_CHANGED/);await exportOld();assert.equal(h.downloads.length,0);assert.equal(h.calls.length,1);
});
test('348 pending export double click, unmount, and audit failure produce no unauthorized download',async()=>{
  const h=mount();await h.fetchReport();const pending=defer();h.override(()=>pending.promise);
  const action=h.button('Exportar').props.onClick;const first=action();await action();assert.equal(h.calls.length,2);
  h.unmount();pending.resolve({ data:{} });await first;assert.equal(h.downloads.length,0);
  const other=mount();await other.fetchReport();other.f.state.auditFailure=true;await other.button('Exportar').props.onClick();assert.equal(other.downloads.length,0);assert.equal(other.messages.length,1);
});
test('348 response parser rejects scope and coverage substitution',()=>{
  const h=mount();const {parseSecureReportPage}=h.hook();const scope={groupId:'g',empresaId:'a'};
  const base={ contract:'secure-report-v1',data:[],fields:[],meta:{offset:0,limit:1,hasMore:false,total:0,coverage:'complete'},scope:{...scope,scopeType:'empresa'} };
  assert.equal(parseSecureReportPage(base,scope).data.length,0);
  assert.throws(()=>parseSecureReportPage({...base,scope:{...base.scope,empresaId:'b'}},scope),/SCOPE_CHANGED/);
  assert.throws(()=>parseSecureReportPage({...base,meta:{...base.meta,total:500}},scope),/COVERAGE/);
});
test('348 revocation clears rendered data and disables old export without credential-bearing cache keys',async()=>{
  const h=mount();await h.fetchReport();const old=h.button('Exportar').props.onClick;
  assert.ok(h.text().includes('=SUM(1)'));h.profile.permissoes.Comercial.Representantes=[];h.render();
  assert.ok(!h.text().includes('=SUM(1)'));await old();assert.equal(h.downloads.length,0);
  assert.ok(!JSON.stringify(h.queries.map(q=>q.queryKey)).includes('synthetic-session'));
});
test('348 permission projection change partitions cache even when the user and scope do not change',async()=>{
  const h=mount();await h.fetchReport();const prior=JSON.stringify(h.queries[0].queryKey);
  h.profile.permissoes.Comercial.Representantes=['visualizar','exportar'];h.render();
  assert.notEqual(JSON.stringify(h.queries[0].queryKey),prior);assert.ok(!h.text().includes('=SUM(1)'));
});
test('353 Relatorios matriz: trigger RBAC recupera TabsContent órfão sem tela paralela',()=>{
  const source=fs.readFileSync('src/pages/Relatorios.jsx','utf8');
  assert.match(source,/value=\"matriz\"[\s\S]*?data-permission=\"Relatorios\.visualizar\"/);
  assert.match(source,/data-action=\"Relatorios\.abrir_matriz\"/);
  assert.match(source,/activeTab === 'matriz' && canViewRelatorios && !permissionsLoading/);
  assert.match(source,/secureTab = \["representantes","personalizado","matriz","exportacao"\]/);
  assert.match(source,/MatrizAdequacaoFase3/);
  assert.ok(!source.includes('EmpresaOnboarding'),'não restaurar onboarding permissivo');
});
test('353 Relatorios exportacao: grant/deny no trigger e conteúdo (não só data-permission)',()=>{
  const source=fs.readFileSync('src/pages/Relatorios.jsx','utf8');
  assert.match(source,/canExportRelatorios && !permissionsLoading/);
  assert.match(source,/data-action=\"Relatorios\.abrir_exportacao\"/);
  assert.match(source,/activeTab === 'exportacao' && canExportRelatorios && !permissionsLoading/);
  assert.match(source,/GeradorRelatorios/);
  // Representantes/Personalizado já falham fechados via hasReportGrant (grant+conteúdo).
  assert.match(source,/hasReportGrant\(perfilAcesso,'Comercial','Representantes','visualizar'\)/);
  assert.match(source,/hasReportGrant\(perfilAcesso,'Relatorios','Personalizado','visualizar'\)/);
});
