import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {assertPortalTituloDoCliente} from '../src/components/lib/portalClientePolicy.js';
import {consolidation84Hunks,consolidation84Remainder} from './helpers/consolidation84Remainder.js';
const docs='src/components/portal/DocumentosCliente.jsx',boletos='src/components/portal/BoletosList.jsx';
const title={id:'synthetic-title',cliente_id:'synthetic-client',pix_copia_cola:'synthetic-existing-pix'};
function callback(file,name,previous=false){
 let text=fs.readFileSync(file,'utf8');if(previous)text=consolidation84Remainder(file,text);
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let result;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)result=node.initializer.getText(ast);if(name==='fatura'&&ts.isJsxAttribute(node)&&node.name.getText(ast)==='onClick'&&node.initializer?.getText(ast).includes('conta.url_fatura'))result=node.initializer.expression.getText(ast);ts.forEachChild(node,visit);};visit(ast);assert.ok(result,name);return result;
}
const bind=(source,deps)=>new Function(...Object.keys(deps),`return (${source});`)(...Object.values(deps));
function fixture(){const events=[];return {events,deps:{assertPortalTituloDoCliente,clienteId:title.cliente_id,cliente:{id:title.cliente_id},isSafeHttpUrl:value=>typeof value==='string'&&value.startsWith('https://synthetic.invalid/'),window:{open:(...args)=>events.push(['open',...args])},navigator:{clipboard:{writeText:async value=>events.push(['clipboard',value])}},toast:{success:()=>events.push(['success']),error:()=>events.push(['error']),message:()=>events.push(['line'])},emitirSegundaVia:{mutate:()=>events.push(['mutate']),mutateAsync:async()=>{events.push(['mutateAsync']);return title;}}}};}
for(const file of [docs,boletos])test(file+': full stage83 source retained outside exact action hunks',()=>{
 const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');consolidation84Remainder(file,source);assert.throws(()=>consolidation84Remainder(file,source+'\n// unrelated'));
 for(const [after] of consolidation84Hunks[file].hunks){assert.throws(()=>consolidation84Remainder(file,source.replace(after,'')));assert.throws(()=>consolidation84Remainder(file,source+after));}
});
test('counterproof: previous direct boleto callback opened a foreign title',()=>{
 const foreign={...title,cliente_id:'synthetic-other',url_boleto_pdf:'https://synthetic.invalid/boleto.pdf'};
 const old=fixture();bind(callback(docs,'handleVisualizarBoleto',true),old.deps)(foreign);assert.equal(old.events[0][0],'open');
 const current=fixture();bind(callback(docs,'handleVisualizarBoleto'),current.deps)(foreign);assert.deepEqual(current.events,[['error']]);
});
for(const [file,name] of [[docs,'handleVisualizarBoleto'],[docs,'handleCopiarPix'],[boletos,'copiarPix']])test(name+': ownership and primitive identity precede every effect',async()=>{
 for(const patch of [{cliente_id:'other'},{cliente_id:[title.cliente_id]},{id:null}]){const f=fixture();await bind(callback(file,name),f.deps)({...title,...patch});assert.deepEqual(f.events,[['error']]);}
 const f=fixture();f.deps.clienteId=null;f.deps.cliente=null;await bind(callback(file,name),f.deps)(title);assert.deepEqual(f.events,[['error']]);
});
test('existing PIX is copied verbatim; malformed artifacts never reach clipboard',async()=>{
 for(const [file,name] of [[docs,'handleCopiarPix'],[boletos,'copiarPix']]){
  const f=fixture();await bind(callback(file,name),f.deps)(title);assert.deepEqual(f.events,[['clipboard',title.pix_copia_cola],['success']]);
  for(const pix of [' ',{},['synthetic'],7]){const bad=fixture();await bind(callback(file,name),bad.deps)({...title,pix_copia_cola:pix});assert.deepEqual(bad.events,[['error']]);}
 }
});
test('PIX fallback rechecks returned title and propagates failure without copying',async()=>{
 for(const returned of [{...title,cliente_id:'other'},{...title,pix_copia_cola:{}},{...title,id:null}]){const f=fixture();f.deps.emitirSegundaVia.mutateAsync=async()=>returned;await bind(callback(docs,'handleCopiarPix'),f.deps)({...title,pix_copia_cola:null});assert.deepEqual(f.events,[['error']]);}
 const good=fixture();await bind(callback(docs,'handleCopiarPix'),good.deps)({...title,pix_copia_cola:null});assert.deepEqual(good.events,[['mutateAsync'],['clipboard',title.pix_copia_cola],['success']]);
 const failed=fixture();failed.deps.emitirSegundaVia.mutateAsync=async()=>{throw Error('synthetic failure');};await bind(callback(docs,'handleCopiarPix'),failed.deps)({...title,pix_copia_cola:null});assert.deepEqual(failed.events,[['error']]);
});
test('boleto retains safe URL and line workflows; opaque artifacts cannot coerce or trigger generation',()=>{
 const f=fixture();bind(callback(docs,'handleVisualizarBoleto'),f.deps)({...title,url_boleto_pdf:'https://synthetic.invalid/boleto.pdf'});assert.deepEqual(f.events,[['open','https://synthetic.invalid/boleto.pdf','_blank','noopener,noreferrer']]);
 const line=fixture();bind(callback(docs,'handleVisualizarBoleto'),line.deps)({...title,url_boleto_pdf:'portal://synthetic',linha_digitavel:'synthetic-line'});assert.deepEqual(line.events,[['line']]);
 let coerced=false;const opaque={toString(){coerced=true;throw Error('unexpected coercion');}};
 for(const patch of [{url_boleto_pdf:opaque},{linha_digitavel:opaque},{url_boleto_pdf:'javascript:invalid'}]){const bad=fixture();bind(callback(docs,'handleVisualizarBoleto'),bad.deps)({...title,...patch});assert.deepEqual(bad.events,[['error']]);}assert.equal(coerced,false);
});
test('inline invoice callback checks title ownership before opening',()=>{
 for(const owner of [title.cliente_id,'synthetic-other']){const f=fixture();bind(callback(docs,'fatura'),{...f.deps,conta:{...title,cliente_id:owner,url_fatura:'https://synthetic.invalid/invoice.pdf'}})();assert.equal(f.events[0][0],owner===title.cliente_id?'open':'error');}
});
test('clipboard failure reports failure without a success claim',async()=>{
 for(const [file,name] of [[docs,'handleCopiarPix'],[boletos,'copiarPix']]){const f=fixture();f.deps.navigator.clipboard.writeText=async()=>{throw Error('synthetic clipboard denial');};await bind(callback(file,name),f.deps)(title);assert.deepEqual(f.events,[['error']]);}
});
test('actual boleto query refuses missing or malformed customer even when enabled is bypassed',async()=>{
 const ast=ts.createSourceFile(boletos,fs.readFileSync(boletos,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let query;
 const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useQuery')query=node.arguments[0].properties.find(p=>p.name?.getText(ast)==='queryFn').initializer.getText(ast);ts.forEachChild(node,visit);};visit(ast);assert.ok(query);
 for(const cliente of [null,{}, {id:[]},{id:{}},{id:' '},{id:Infinity}]){let calls=0;const run=bind(query,{cliente,base44:{entities:{ContaReceber:{filter:()=>{calls++;throw Error('unexpected read');}}}}});if(!cliente?.id)assert.deepEqual(await run(),[]);else await assert.rejects(run());assert.equal(calls,0);}
 for(const id of ['synthetic-client',23]){const run=bind(query,{cliente:{id},base44:{entities:{ContaReceber:{filter:async(filter,sort,limit)=>{assert.deepEqual(filter,{cliente_id:id});assert.equal(sort,'-data_vencimento');assert.equal(limit,100);return[title];}}}}});assert.deepEqual(await run(),[title]);}
});
