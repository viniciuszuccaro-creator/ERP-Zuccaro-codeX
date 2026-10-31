import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';

test('pilot option annotations preserve the complete executable policy', () => {
  const emitted = ts.transpileModule(fs.readFileSync('src/components/lib/pilotoOperacaoPolicy.js', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true },
  }).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),
    'd752f72b41d9f94405464c047a9b9e7c34babb490dbcd1e127d70511f31a4d28');
});

test('pilot contracts accept optional fields and reject invalid flags and collections', () => {
  const filename = path.resolve('tests/synthetic-piloto-options.ts');
  const source = `import {stampUsuarioPiloto,applyPilotoCenariosOnWrite,assertOperacaoPiloto,applyModoOperacaoOnWrite} from '../src/components/lib/pilotoOperacaoPolicy.js';
stampUsuarioPiloto({papel_piloto:'financeiro'}, {piloto:true,papel:'financeiro'});
applyPilotoCenariosOnWrite({record:{chave:'piloto_cenarios',valor_json:[]},user:{email:'synthetic@example.invalid'}});
assertOperacaoPiloto({user:{usuario_piloto:false,ativo:false},modoOperacao:'piloto'});
applyModoOperacaoOnWrite({record:{chave:'modo_operacao'},users:[],backups:[]});
stampUsuarioPiloto({}, {piloto:'yes'});
assertOperacaoPiloto({user:{usuario_piloto:'yes'}});
applyModoOperacaoOnWrite({backups:'invalid'});
applyPilotoCenariosOnWrite({user:{email:123}});`;
  const options = {allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,
    module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  const errors = ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host));
  assert.deepEqual(errors.map(error => ({file:path.resolve(error.file?.fileName || ''),code:error.code,
    line:error.file?.getLineAndCharacterOfPosition(error.start).line})),
  [5,6,7,8].map(line => ({file:filename,code:2322,line})));
});
