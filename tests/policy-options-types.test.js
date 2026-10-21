import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {componentContractRemainder} from './helpers/componentContractRemainder.js';

// Emitted JavaScript hashes recorded before the stage16 type-only edits.
const runtimeHashes = {
  'base44/functions/_lib/security/entityGuardPolicy/entry.ts': '273c55877cfd3715c817b7bd7ea97512b2036088277a505157457114285be093',
  'src/components/lib/contextoMultiempresaPolicy.js': 'ec585b48fd0d3009812d1a3f78a67a0f8454a6b0cdb0629bb75f224fa84faf5a',
  'src/components/lib/sensitiveActionGuardPolicy.js': '0d2f9b0a361616bf0f9ca6e248eb04c0c2b9d5ad9149d7cc697166ed38342f80',
  'src/components/lib/agenteAutorizacaoPolicy.js': 'a3d6cd0e9c9798713a18f5a4c6fce0552855f87044a53e653b9a07156f4cb71c',
  'src/components/lib/automacaoAvancadaPolicy.js': '1192097485ae27e6ec0b5027e5eeb8e94a24f35e93d90f9578c19380142e912c',
  'src/components/comercial/pedidoUiPolicy.js': 'e1e14abd4935483d2f2175a844f4b97da013827dd7009123f8accff7cfe0383d',
};
for (const [file, expected] of Object.entries(runtimeHashes)) test(`${file}: explicit option types retain byte-identical emitted JavaScript`, () => {
  const emitted = ts.transpileModule(componentContractRemainder(file,fs.readFileSync(file, 'utf8')), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true },
  }).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'), expected);
});

test('real policy option contracts accept scoped inputs and reject wrong IDs, flags, collections and misspelled fields', () => {
  const filename = path.resolve('tests/synthetic-policy-options.ts');
  const source = `import {normalizeGuardContext,validateGuardContext} from '../base44/functions/_lib/security/entityGuardPolicy/entry.ts';
import {buildMultiempresaReadFilter,buildMultiempresaQueryScopeKey} from '../src/components/lib/contextoMultiempresaPolicy.js';
import {buildSensitiveGuardRequest} from '../src/components/lib/sensitiveActionGuardPolicy.js';
import {assertAgentMayAct,assertMappedAgentFunction,buildAgentInvokePayload} from '../src/components/lib/agenteAutorizacaoPolicy.js';
import {assertAutomacaoContext} from '../src/components/lib/automacaoAvancadaPolicy.js';
import {evaluatePedidoStatusTransitionUiGate,evaluatePedidoPrintPdfUiGate,evaluatePedidoShareUiGate,resolvePedidoHistoryUiState} from '../src/components/comercial/pedidoUiPolicy.js';
normalizeGuardContext({groupId:'synthetic-group',empresaId:'synthetic-company',scopeType:'empresa'});
validateGuardContext({grupo_id:'synthetic-group',company_id:'synthetic-company',scope_type:'company'});
buildMultiempresaQueryScopeKey({groupId:'synthetic-group',empresaId:'synthetic-company'});
buildMultiempresaReadFilter({groupId:'synthetic-group',empresaId:'synthetic-company',shared:true,rest:{$or:[{ativo:true}]}});
buildSensitiveGuardRequest({groupId:'synthetic-group',empresaId:'synthetic-company',scopeType:'empresa',permission:'Sistema.Controle de Acesso.editar'});
assertAgentMayAct({agent:'seguranca',userAllowed:false,confirmed:false,functionSpec:{critical:true}});
assertMappedAgentFunction({functionName:'permissionOptimizer',userAllowed:false,agent:'seguranca'});
buildAgentInvokePayload({agente:'financeiro',groupId:'synthetic-group',empresaId:'synthetic-company',extra:{synthetic:true}});
assertAutomacaoContext({groupId:'synthetic-group',empresaId:'synthetic-company'});
evaluatePedidoStatusTransitionUiGate({row:{status:'EM_ABERTO',tipo_operacao:'ENTREGA',itens:[]},groupId:'synthetic-group',empresaId:'synthetic-company',canTransition:false});
evaluatePedidoPrintPdfUiGate({row:{numero:'synthetic-order',itens:[]},canPrint:false});
evaluatePedidoShareUiGate({row:{numero:'synthetic-order'},canShare:false});
resolvePedidoHistoryUiState({events:[],isLoading:false,isError:false,errorMessage:null});
// Negative fixtures: each must produce a diagnostic, without suppression directives.
normalizeGuardContext({groupId:{synthetic:true}});
buildSensitiveGuardRequest({groupId:42});
assertAgentMayAct({userAllowed:'yes'});
buildAgentInvokePayload({confirmed:1});
evaluatePedidoStatusTransitionUiGate({canTransition:'yes'});
evaluatePedidoPrintPdfUiGate({row:{itens:'not-an-array'}});
buildMultiempresaReadFilter({rest:7});
validateGuardContext({empresaUUID:'synthetic-company'});`;
  const options = { allowJs: true, checkJs: true, noEmit: true, allowImportingTsExtensions: true,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true, types: [] };
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  const program = ts.createProgram([filename], options, host);
  const errors = ts.getPreEmitDiagnostics(program);
  const external = errors.filter(error => !error.file || path.resolve(error.file.fileName) !== filename);
  assert.deepEqual(external.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')), []);
  assert.equal(errors.length, 8);
  assert.deepEqual(errors.map(error => error.code), [2322, 2322, 2322, 2322, 2322, 2322, 2322, 2561]);
  const firstNegativeLine = source.split('\n').findIndex(line => line.startsWith('// Negative fixtures')) + 1;
  assert.ok(errors.every(error => error.file.getLineAndCharacterOfPosition(error.start).line >= firstNegativeLine),
  JSON.stringify(errors.map(error => ({ code: error.code, line: error.file.getLineAndCharacterOfPosition(error.start).line,
    message: ts.flattenDiagnosticMessageText(error.messageText, '\n') }))));
  assert.equal(new Set(errors.map(error => error.file.getLineAndCharacterOfPosition(error.start).line)).size, 8);
});
