import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {nativeDomEdits,nativeDomAttributeRemainder} from './helpers/nativeDomAttributeRemainder.js';
import {mirrorInputAfter,httpMirrorAnnotationRemainder} from './helpers/httpMirrorAnnotationRemainder.js';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const hashes = [
  ['src/api/localBase44Client.js','81a4ef9c0c06d920bf967c86b3d6897f060948f65326c7ee1f1bc2ac21768968'],
  ['src/components/crm/crmFormSubmission.js','41b4092ed7321ec1e1aad4d1d2b76ae094426ef5392a3fdb3aeaa164503b2d3f'],
  ['src/components/expedicao/EnvioMensagemAutomatica.jsx','f77697326d67d533d9f6f20c1893694da0f7f7f814a00992ef74de2c7a57ed91'],
  ['src/components/expedicao/painel-logistico/DriverChat.jsx','3d3fc9c650c1285b30305559753a851da0cff19744d811c9f913f0ee94d18ac2'],
  ['src/components/expedicao/financeiro/LogisticaFinanceiroPanel.jsx','5a2fb2ad25ae4f204bd529389b01ff0d0cf2e6f04c75ee53aed0a0115f1ca3f2'],
  ['src/components/comercial/FechamentoFinanceiroTab.jsx','fdcce19b826a521d3e0bc081e6a9309e42ebbe7bf013ebd9eeb3e2e45e2ea853'],
  ['src/components/comercial/LogisticaEntregaTab.jsx','ee7eec2007bfd40c0c09a5ddc29e15fa3b9ed9776e0ab7ed13acfe0057d42c17'],
  ['src/components/financeiro/CartoesACompensar.jsx','a852813df03f95e6a4f37ccda51a93da4aa8f9cd2162926d776b6aa56e4bbe0a'],
  ['src/components/integracoes/TesteTransportadoras.jsx','5ca03813177ce9d914c7c971e18015cf971dddfae5517638a5528f06a71832d5'],
  ['src/components/producao/DocumentosProducao.jsx','3f15f67af0b13b3cf83205646384aba26a4858e4d71e0ec39fcb5beb89247cf2'],
  ['src/components/expedicao/RoteirizacaoInteligente.jsx','b5f8670a896979bf15ce6e15af09b58ba440df1886985f46714829a65dfc5a65'],
];
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const emit=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
for(const [file,beforeHash] of hashes)test(`${file}: stage45 runtime retained outside exact numeric DOM attributes`,()=>{
  const source=nativeDomAttributeRemainder(file,iaResponseValidationRemainder(file,read(file)));
  assert.equal(crypto.createHash('sha256').update(emit(source)).digest('hex'),beforeHash);
});

test('eleven actual numeric JSX attributes remain native and render identical HTML',()=>{
  let total=0;
  for(const [file,edits] of Object.entries(nativeDomEdits)){
    const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
    for(const [name,value,count]of edits){
      let found=0;
      function visit(node){
        if(ts.isJsxAttribute(node)&&node.name.getText(tree)===name&&node.initializer&&ts.isJsxExpression(node.initializer)&&node.initializer.expression?.getText(tree)===String(value)){
          const element=node.parent.parent,tag=element.tagName.getText(tree);
          assert.ok(['textarea','td','Input'].includes(tag));
          const native=tag==='Input'?'input':tag;
          assert.equal(renderToStaticMarkup(React.createElement(native,{[name]:value})),renderToStaticMarkup(React.createElement(native,{[name]:String(value)})));
          found++;
        }
        ts.forEachChild(node,visit);
      }
      visit(tree);assert.equal(found,count);total+=found;
    }
  }
  assert.equal(total,11);
});

test('mirror annotation exception rejects missing or duplicate changes and cannot erase executable edits',()=>{
  const file='src/api/localBase44Client.js',source=read(file);
  assert.throws(()=>httpMirrorAnnotationRemainder(source.replace(mirrorInputAfter,'')));
  assert.throws(()=>httpMirrorAnnotationRemainder(source+'\n'+mirrorInputAfter));
  assert.match(httpMirrorAnnotationRemainder(source.replace('if (!groupId) return','if (groupId) return')),/if \(groupId\) return/);
});

test('actual mirror input contract accepts the complete producer projection and rejects invalid fields',()=>{
  const source=`/**\n${mirrorInputAfter}\n */\nfunction mirror(input={}){}\n`
    + `mirror({});\nmirror({groupId:'synthetic-group',empresaId:null,groupName:'Synthetic',empresas:[{id:'synthetic-company',cnpj:null}],perfilAcessoId:'synthetic-profile',permissoes:{'Financeiro.Caixa':['visualizar']},perfilNome:'Synthetic profile'});\n`;
  const invalid=["mirror({groupId:123});","mirror({empresas:[{}]});","mirror({permissoes:'*'});","mirror({empresaId:true});"];
  const first=source.split('\n').length-1,filename=path.resolve('tests/synthetic-mirror-contract.js');
  const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),originalRead=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source+invalid.join('\n'):originalRead(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(error=>error.file&&path.resolve(error.file.fileName)===filename);
  assert.equal(errors.length,invalid.length,JSON.stringify(errors.map(error=>ts.flattenDiagnosticMessageText(error.messageText,'\n'))));
  assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),invalid.map((_,index)=>first+index));
});
