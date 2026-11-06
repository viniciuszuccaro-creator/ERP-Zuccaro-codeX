import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {PERFIL_FORM_DEFAULT,buildPerfilFormSubmitPayload,buildPerfilRbacPayload,buildPerfilCardInfo,buildPerfilSaveBlock,countPermissoesTotal} from '../src/components/sistema/central-perfis-acesso/rbacScopeUtils.js';

const utils='src/components/sistema/central-perfis-acesso/rbacScopeUtils.js';
const central='src/components/sistema/CentralPerfisAcesso.jsx';
for(const [file,hash] of [
  [utils,'65a58bc203164b1b8adc2cab5011b477828a07ebc858b9e78cfcd7f80737a9de'],
  [central,'1adac6e670f805177c550aefa3d8ccd3872c8bf2cdd0c2bec517af0c5be5899a'],
])test(`${file}: entire executable runtime remains unchanged`,()=>{
  const emitted=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});

function command(){
  const ast=ts.createSourceFile(central,fs.readFileSync(central,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let fn;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='salvarPerfilMutation'){
      assert.equal(fn,undefined);fn=node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer;
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(fn);return {ast,fn};
}
function bind(deps){const {ast,fn}=command();return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}

test('actual profile command type preserves optional defaults and extensions, rejects malformed known fields',()=>{
  const filename=path.resolve('src/components/sistema/synthetic-profile-command.js');
  const {ast,fn}=command();
  let source=`import {useMutation} from '@tanstack/react-query';\nconst command=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\n`;
  for(const good of ['{}',"{nome_perfil:'Synthetic',ativo:false,custom:{value:1}}","{permissoes:{Sistema:{'Controle de Acesso':['visualizar']}},setores_permitidos:['synthetic-sector']}"])source+=`command.mutate(${good});\n`;
  const negatives=["{nome_perfil:123}","{ativo:'false'}","{permissoes:{Sistema:{Acesso:true}}}","{setores_permitidos:[123]}",'123'];
  const firstNegative=source.split('\n').length-1;
  for(const bad of negatives)source+=`command.mutate(${bad});\n`;
  const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,negatives.length,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negatives.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(e=>[2322,2345].includes(e.code)));
});

test('profile submit and RBAC payload retain exact fields, permission actions and group/company stamps',()=>{
  for(const scope of ['grupo','empresa']){
    const input={...PERFIL_FORM_DEFAULT,nome_perfil:'Synthetic',escopo_acesso:'grupo_empresa',setores_permitidos:['synthetic-sector'],custom:7,
      permissoes:{Sistema:{'Controle de Acesso':['visualizar','editar']}},group_id:'synthetic-other',grupo_id:'synthetic-other'};
    const form=buildPerfilFormSubmitPayload({formPerfil:input,grupoAtivoId:'synthetic-group',empresaAtivaId:'synthetic-a'});
    assert.equal(form.custom,7);assert.equal(form.permissoes,input.permissoes);assert.equal(form.acesso_grupo,true);assert.equal(form.acesso_empresas,true);
    assert.deepEqual(form.departamentos_permitidos,input.setores_permitidos);
    const row=buildPerfilRbacPayload({data:form,contexto:scope,contextoValido:true,grupoAtivoId:'synthetic-group',empresaAtivaId:'synthetic-a',empresasGrupoIds:['synthetic-a','synthetic-b']});
    assert.equal(row.group_id,'synthetic-group');assert.equal(row.grupo_id,'synthetic-group');assert.equal(row.empresa_id,'synthetic-a');
    assert.equal(row.permissoes,input.permissoes);assert.equal(row.custom,7);
    assert.equal(row.contexto_valido,true);
    if(scope==='grupo')assert.deepEqual(row.empresas_grupo_ids,['synthetic-a','synthetic-b']);
    else assert.ok(!Object.hasOwn(row,'empresas_grupo_ids'));
  }
  assert.equal(buildPerfilFormSubmitPayload({}).acesso_grupo,false);
  assert.equal(buildPerfilRbacPayload({contexto:'empresa',contextoValido:false}).contexto_valido,false);
});

test('profile card preserves default rendering, exact action counts and linked-user identity',()=>{
  assert.deepEqual(buildPerfilCardInfo({}),{permissoesTotal:0,usuariosVinculados:[],usuariosVinculadosTotal:0,ativo:true,nome:'Perfil'});
  const users=[{perfil_acesso_id:'synthetic-profile'},{perfil_acesso_id:'synthetic-other'}];
  const card=buildPerfilCardInfo({perfil:{id:'synthetic-profile',nome:'Synthetic',ativo:false,permissoes:{Sistema:{Acesso:['visualizar','editar']}}},usuarios:users});
  assert.equal(card.permissoesTotal,2);assert.equal(card.ativo,false);assert.equal(card.nome,'Synthetic');assert.deepEqual(card.usuariosVinculados,[users[0]]);
});

function deps(overrides={}){
  const writes=[],audits=[];
  return {writes,audits,bindings:{perfilAberto:null,contexto:'empresa',contextoValido:true,podeCriarPerfil:true,podeEditarPerfil:true,
    grupoAtivoId:'synthetic-group',empresaAtivaId:'synthetic-a',empresasGrupoIds:['synthetic-a'],
    buildPerfilSaveBlock,buildPerfilRbacPayload,countPermissoesTotal,
    auditarPerfil:async p=>audits.push(p),createInContext:async(...args)=>{writes.push(['create',...args]);return {id:'synthetic-profile'};},
    updateInContext:async(...args)=>{writes.push(['update',...args]);return {id:'synthetic-profile'};},...overrides}};
}

test('actual profile save command keeps context/create/edit denials and records blocked audit before rejecting',async()=>{
  for(const override of [{contextoValido:false},{podeCriarPerfil:false},{perfilAberto:{id:'synthetic-profile'},podeEditarPerfil:false}]){
    const {writes,audits,bindings}=deps(override);
    await assert.rejects(bind(bindings)({nome_perfil:'Synthetic'}));assert.equal(writes.length,0);assert.equal(audits.length,1);assert.equal(audits[0].sucesso,false);
  }
});

test('actual profile save preserves create/edit/new-record ownership, payload and success audit',async()=>{
  for(const profile of [null,{id:'synthetic-profile'},{id:'synthetic-profile',novo:true}]){
    const {writes,audits,bindings}=deps({perfilAberto:profile});
    const input={nome_perfil:'Synthetic',escopo_acesso:'empresa',permissoes:{Sistema:{Acesso:['visualizar']}},custom:9};
    assert.deepEqual(await bind(bindings)(input),{id:'synthetic-profile'});
    assert.equal(writes.length,1);assert.equal(writes[0][0],!profile||profile.novo?'create':'update');
    const payload=writes[0].at(-1);assert.equal(payload.empresa_id,'synthetic-a');assert.equal(payload.group_id,'synthetic-group');assert.equal(payload.custom,9);
    assert.equal(payload.permissoes,input.permissoes);assert.equal(audits.length,1);assert.equal(audits[0].sucesso,true);assert.equal(audits[0].dadosNovos.permissoes_total,1);
  }
});

test('actual profile save propagates failed writes and audit errors without claiming transactional rollback',async()=>{
  const write=deps({createInContext:async()=>{throw new Error('synthetic write failure');}});
  await assert.rejects(bind(write.bindings)({}),/synthetic write failure/);assert.equal(write.audits.length,0);
  const audit=deps({auditarPerfil:async()=>{throw new Error('synthetic audit failure');}});
  await assert.rejects(bind(audit.bindings)({}),/synthetic audit failure/);assert.equal(audit.writes.length,1);
});
