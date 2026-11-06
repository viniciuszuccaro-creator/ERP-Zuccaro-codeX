import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(name='synthetic-codespace',fail=false) {
  const source=fs.readFileSync('vite.config.js','utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(compiled,{exports,process:{env:{CODESPACE_NAME:name}},require:id=>{
    if(id==='node:child_process')return{execFileSync:(_git,args)=>{if(fail)throw new Error('synthetic private detail');return args.includes('HEAD')?'a'.repeat(40):args.includes('--show-current')?'codex/consolidacao-infra-20261017':'';}};
    if(id==='vite')return{defineConfig:value=>value};
    return{__esModule:true,default:()=>({})};
  }});
  return exports.default;
}
test('347 actual Vite config allows only the exact private Codespace hostname',()=>{
  const config=load();assert.deepEqual([...config.server.allowedHosts],['synthetic-codespace-5173.app.github.dev']);
  assert.deepEqual([...load('evil.example/../').server.allowedHosts],[]);
});
test('347 DEV provenance exposes only SHA/branch/dirty status, never file names or process environment',()=>{
  const plugin=load().plugins.find(p=>p.name==='erp-private-preview-provenance');let handler;
  plugin.configureServer({middlewares:{use:(url,fn)=>{assert.equal(url,'/__erp_preview');handler=fn;}}});
  const headers={};let body;
  handler({}, {setHeader:(name,value)=>{headers[name]=value;},end:value=>{body=JSON.parse(value);}});
  assert.equal(body.sha,'a'.repeat(40));assert.equal(body.dirty,false);assert.equal(headers['Cache-Control'],'no-store');
  assert.deepEqual(Object.keys(body).sort(),['branch','dirty','purpose','sha']);
});
test('347 DEV provenance fails closed and does not reveal Git/process errors',()=>{
  const plugin=load('synthetic-codespace',true).plugins.find(p=>p.name==='erp-private-preview-provenance');let handler;
  plugin.configureServer({middlewares:{use:(_url,fn)=>{handler=fn;}}});
  let body;const res={statusCode:200,setHeader(){},end:value=>{body=JSON.parse(value);}};handler({},res);
  assert.equal(res.statusCode,503);assert.deepEqual(body,{error:'PREVIEW_PROVENANCE_UNAVAILABLE'});
});
