import test from 'node:test';
import {portalIdentityRemainder} from './helpers/portalIdentityRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {QueryClient} from '@tanstack/react-query';

const hashes={
  'src/components/chatbot/ChatbotWidget.jsx':'799369856b23b2243ffc25888ff5595b34ee4f90d129b8a1803cacd710bc44e7',
  'src/components/chatbot/ChatbotWidgetAvancado.jsx':'9db0674af24a161ea3dc9f3a5178ab6f7a917e54b03440b0889a9065fdd56dd5',
  'src/pages/HubAtendimento.jsx':'11c82013421eb5d0066d75f06159e620780b557a03b5d3f02a7cddbc2d9e3ef3',
  'src/components/portal/ChatCliente.jsx':'f4e04036c7135376e86e928770a98a4c3d8e1c08195e9641c95bd71a8869ceaf',
  'src/components/portal/ChatVendedor.jsx':'160258c0126beb1a158c129c3fac569ccc041d76804ff92cb656bc572ce18b86',
  'src/components/comercial/BadgeOrigemPedido.jsx':'734d90c115c16fd8092355bee7fe92431e1ff4f382cdc5ec2f018c33b1c96547',
};
for(const [file,hash] of Object.entries(hashes))test(`${file}: unchanged executable except two exact query-filter conversions`,()=>{
  let source=portalIdentityRemainder(file,fs.readFileSync(file,'utf8'));
  if(file.endsWith('/ChatVendedor.jsx')){
    const after="queryClient.invalidateQueries({ queryKey: ['chat-cliente', clienteId] });";
    assert.equal(source.split(after).length-1,2);
    source=source.split(after).join("queryClient.invalidateQueries(['chat-cliente', clienteId]);");
  }
  const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
    jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});

function compile(filename,source,checkJs=false){
  const options={allowJs:true,checkJs,noEmit:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,
    module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,
    baseUrl:process.cwd(),paths:{'@/*':['./src/*']}};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source:read(file);
  return ts.createProgram([filename],options,host).getSemanticDiagnostics()
    .filter(error=>error.file&&path.resolve(error.file.fileName)===filename);
}

test('widget and origin-badge props accept current object contracts and reject wrong flags and IDs',()=>{
  const filename=path.resolve('tests/synthetic-chat-props.tsx');
  const prefix=`import Widget from '../src/components/chatbot/ChatbotWidget';
import Advanced from '../src/components/chatbot/ChatbotWidgetAvancado';
import Origin from '../src/components/comercial/BadgeOrigemPedido';
const good=<><Widget canal="Site" exibirBotaoFlutuante/><Widget clienteId="synthetic" conversaId="synthetic-conversation" configuracoes={{synthetic:true}}/><Advanced clienteId="synthetic" habilitarAvaliacao={false} tema="light"/><Origin origemPedido="Chatbot" showLock={false}/></>;
`;
  const invalid=['<Widget clienteId={1}/>','<Widget canal={1}/>','<Widget exibirBotaoFlutuante="invalid"/>',
    '<Advanced habilitarAvaliacao="invalid"/>','<Origin origemPedido="Chatbot" showLock="invalid"/>','<Origin/>'];
  const source=prefix+invalid.map((jsx,i)=>`const invalid${i}=${jsx};`).join('\n');
  const errors=compile(filename,source),firstNegative=prefix.split('\n').length-1;
  assert.equal(errors.length,invalid.length);
  assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),invalid.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(error=>[2322,2741].includes(error.code)));
});

function mutation(file,name){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  let result;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){
      assert.equal(result,undefined);
      assert.ok(ts.isCallExpression(node.initializer));
      const config=node.initializer.arguments[0];
      const get=key=>config.properties.find(p=>p.name?.getText(ast)===key)?.initializer;
      result={ast,fn:get('mutationFn'),success:get('onSuccess')};
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(result);return result;
}

test('six actual mutation parameter declarations prevent void inference without relaxing payload types',()=>{
  const cases=[
    ['src/components/chatbot/ChatbotWidget.jsx','enviarMensagemMutation',"{mensagem:'synthetic',arquivo:null}","{mensagem:123}"],
    ['src/components/chatbot/ChatbotWidgetAvancado.jsx','enviarMensagemMutation',"{mensagem:'synthetic',arquivo:new File([],'synthetic.txt')}","{mensagem:'synthetic',arquivo:'invalid'}"],
    ['src/pages/HubAtendimento.jsx','enviarMensagemMutation',"{mensagem:'synthetic'}","{arquivo:null}"],
    ['src/components/portal/ChatCliente.jsx','enviarMensagemMutation',"'synthetic'","123"],
    ['src/components/portal/ChatVendedor.jsx','enviarMensagemMutation',"'synthetic'","{}"],
    ['src/components/portal/ChatVendedor.jsx','responderMutation',"{interacaoId:'synthetic',resposta:'synthetic'}","{interacaoId:123,resposta:'synthetic'}"],
  ];
  const filename=path.resolve('tests/synthetic-chat-mutations.js');
  let source="import {useMutation} from '@tanstack/react-query';\n";
  for(const [i,[file,name,good]] of cases.entries()){
    const {ast,fn}=mutation(file,name);
    assert.equal(fn.parameters.length,1);
    source+=`const command${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\ncommand${i}.mutate(${good});\n`;
  }
  const firstNegative=source.split('\n').length-1;
  for(const [i,[,,,bad]] of cases.entries())source+=`command${i}.mutate(${bad});\n`;
  const errors=compile(filename,source,true);
  assert.equal(errors.length,cases.length,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),cases.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(error=>[2322,2345].includes(error.code)));
});

test('actual chat success callbacks invalidate the producer key and not other clients or entities with QueryClient v5',async()=>{
  const file='src/components/portal/ChatVendedor.jsx';
  for(const name of ['enviarMensagemMutation','responderMutation']){
    const {ast,success}=mutation(file,name),client=new QueryClient();
    const clienteId='synthetic-a',keys=[['chat-cliente',clienteId],['chat-cliente','synthetic-b'],['cliente',clienteId],['chamados',clienteId]];
    for(const key of keys)client.setQueryData(key,{synthetic:true});
    const producer=[];
    function visit(node){
      if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='queryKey'&&ts.isArrayLiteralExpression(node.initializer)
        &&node.initializer.elements[0]?.getText(ast)==="'chat-cliente'")producer.push(node.initializer.getText(ast));
      ts.forEachChild(node,visit);
    }
    visit(ast);
    assert.ok(producer.length>=1);
    assert.ok(producer.every(key=>key===producer[0]));
    assert.deepEqual(new Function('clienteId',`return ${producer[0]};`)(clienteId),keys[0]);
    let cleared=0,notified=0;
    const callback=new Function('queryClient','clienteId','setMensagem','toast',`return (${success.getText(ast)});`)
      (client,clienteId,value=>{assert.equal(value,'');cleared++;},{success:()=>notified++});
    await callback();
    assert.equal(client.getQueryState(keys[0]).isInvalidated,true);
    for(const key of keys.slice(1))assert.equal(client.getQueryState(key).isInvalidated,false);
    assert.equal(cleared,name==='enviarMensagemMutation'?1:0);
    assert.equal(notified,cleared);
    client.clear();
  }
});
