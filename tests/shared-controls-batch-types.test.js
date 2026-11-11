import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const hashes = {
  'src/components/ui/context-menu.jsx':'9b1343b4703e4c97f4a7fbfa57385d2dca733e98eaeeb8f9565ef8781aefcd60',
  'src/components/ui/avatar.jsx':'a851569e941ee3f4ef40ca557499a67b066789eb54460f5daa7a22c3063cb0db',
  'src/components/ui/separator.jsx':'4be4e2dda9da42c49346ef1d5d4eaef1b421c1f60398502b5773e7092e441907',
  'src/components/ui/sheet.jsx':'aa100732cdf25491242fae9b9ec30b63fb3ad69bff5d0dfdcc21a80976354cab',
  'src/components/ui/radio-group.jsx':'495958b2828b53af126f82c09bfef2afe1e8d6dff8013b59f325d825ef33c6ee',
  'src/components/StatusBadge.jsx':'9ac35cd4ad8177ccb88e6da5a3d451bab5d5c766c2443c5b70ad3e09820df1fa',
  'src/components/ui/confirm-dialog.jsx':'c5d88365577ab9f67392123c27507b62557606f659485cc039c58bab256b3f5e',
};
const emit = source => ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
for (const [file,hash] of Object.entries(hashes)) test(`${file}: full executable remains byte-identical to stage20`, () => {
  assert.equal(crypto.createHash('sha256').update(emit(fs.readFileSync(file,'utf8'))).digest('hex'),hash);
});

test('shared controls accept native contracts and reject invalid callbacks, refs, flags and identifiers', () => {
  const filename=path.resolve('tests/synthetic-shared-controls.tsx');
  const good=`import * as React from 'react';
import {ContextMenuItem,ContextMenuRadioItem,ContextMenuCheckboxItem,ContextMenuShortcut,ContextMenuSubTrigger} from '../src/components/ui/context-menu';
import {Avatar,AvatarImage,AvatarFallback} from '../src/components/ui/avatar';
import {Separator} from '../src/components/ui/separator';
import {SheetContent,SheetHeader,SheetTitle,SheetDescription} from '../src/components/ui/sheet';
import {RadioGroup,RadioGroupItem} from '../src/components/ui/radio-group';
import StatusBadge from '../src/components/StatusBadge';
import ConfirmDialog,{useConfirm} from '../src/components/ui/confirm-dialog';
const divRef=React.createRef<HTMLDivElement>(),imgRef=React.createRef<HTMLImageElement>(),spanRef=React.createRef<HTMLSpanElement>();
const goodMenu=<><ContextMenuItem inset onSelect={event=>event.preventDefault()} ref={divRef}>Synthetic</ContextMenuItem><ContextMenuRadioItem value="synthetic"/><ContextMenuCheckboxItem checked="indeterminate" onCheckedChange={checked=>String(checked)}/><ContextMenuShortcut/><ContextMenuSubTrigger inset/></>;
const goodAvatar=<Avatar ref={spanRef}><AvatarImage src="synthetic" ref={imgRef}/><AvatarFallback delayMs={10}>S</AvatarFallback></Avatar>;
const goodSheet=<SheetContent side="left" ref={divRef}><SheetHeader/><SheetTitle>Synthetic</SheetTitle><SheetDescription>Synthetic</SheetDescription></SheetContent>;
const goodRadio=<RadioGroup ref={divRef} data-permission="synthetic.permission" data-toast-success="true" onValueChange={value=>value.toUpperCase()}><RadioGroupItem value="synthetic"/></RadioGroup>;
const goodOther=<><Separator orientation="vertical" decorative/><StatusBadge status="Synthetic" customColors={{Synthetic:'synthetic'}}/><ConfirmDialog open={false} onOpenChange={()=>{}} onConfirm={()=>{}}/></>;
async function resultType(){ const {confirm}=useConfirm(); const confirmed:boolean=await confirm({description:'synthetic'}); return confirmed; }
`;
  const negative=[
    '<ContextMenuRadioItem/>','<ContextMenuItem inset="invalid"/>','<ContextMenuCheckboxItem checked="invalid"/>',
    '<AvatarImage ref={divRef}/>','<AvatarFallback delayMs="invalid"/>','<Separator orientation="diagonal"/>',
    '<SheetContent side="diagonal"/>','<RadioGroupItem/>','<RadioGroup onValueChange="invalid"/>',
    '<RadioGroup data-toast-success={123}/>','<StatusBadge status={123}/>','<StatusBadge status="Synthetic" variant="invalid"/>',
    '<ConfirmDialog open={false} onOpenChange={()=>{}}/>',
  ];
  const source=good+negative.map((jsx,i)=>`const invalid${i}=${jsx};`).join('\n');
  const options={allowJs:true,checkJs:false,noEmit:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,
    module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,
    baseUrl:process.cwd(),paths:{'@/*':['./src/*']}};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics()
    .filter(error=>error.file&&path.resolve(error.file.fileName)===filename);
  assert.equal(errors.length,negative.length,JSON.stringify(errors.map(error=>ts.flattenDiagnosticMessageText(error.messageText,'\n'))));
  const firstNegative=good.split('\n').length-1;
  assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),negative.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(error=>[2322,2741].includes(error.code)));
});

function isolatedRadio(allowed) {
  const file='src/components/ui/radio-group.jsx';
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const source=ast.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getFullText(ast)).join('\n');
  const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
  const exports={},calls=[];
  const React={forwardRef:render=>render,createElement:(type,props,...children)=>({type,props:{...props,children}})};
  const primitive={Root:()=>{},Item:()=>{},Indicator:()=>{}};
  new Function('exports','React','RadioGroupPrimitive','Circle','cn','uiAuditWrap','usePermissions',emitted)(exports,
    React,primitive,()=>{},()=>'',(action,handler,options)=>{calls.push({action,options});return handler;},
    ()=>({hasPermissionKey:key=>{assert.equal(key,'synthetic.permission');return allowed;}}));
  return {exports,calls};
}

test('actual audited radio retains denied rendering and allowed handler, ref and metadata filtering', () => {
  for(const allowed of [false,true]) {
    const {exports,calls}=isolatedRadio(allowed);
    const handler=()=>{},ref={current:null};
    const element=exports.RadioGroup({'data-permission':'synthetic.permission','data-toast-success':'true',
      'data-action':'synthetic.action',__wrapped_audit:true,onValueChange:handler,disabled:true},ref);
    assert.equal(calls.length,1);
    assert.equal(calls[0].action,'synthetic.action');
    assert.equal(calls[0].options.toastSuccess,true);
    if(!allowed){assert.equal(element.type,'span');assert.equal(element.props.onValueChange,undefined);continue;}
    assert.equal(element.props.ref,ref);
    assert.equal(element.props.disabled,true);
    assert.equal(element.props.onValueChange,handler);
    for(const key of ['data-permission','data-toast-success','__wrapped_audit']) assert.equal(key in element.props,false);
  }
});

test('TabelaPagar drops only an unused size prop; StatusBadge output is identical with and without it', () => {
  const file='src/components/financeiro/contas-pagar/TabelaPagar.jsx';
  const source=fs.readFileSync(file,'utf8');
  const exact='<StatusBadge status={r.status} />';
  assert.equal(source.split(exact).length,2);
  assert.equal(emit(source.replace(exact,'<StatusBadge status={r.status} size="sm" />')),
    emit(execFileSync('git',['show',`e36231b3a7e546aa9fd2529abb8d5edb61d8189c:${file}`],{encoding:'utf8'})));
  const badgeFile='src/components/StatusBadge.jsx';
  const ast=ts.createSourceFile(badgeFile,fs.readFileSync(badgeFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='StatusBadge');
  const emitted=ts.transpileModule(fn.getFullText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
  const exports={};
  new Function('exports','React','Badge','cn',emitted)(exports,{createElement:(type,props,...children)=>({type,props,children})},'synthetic-badge',(...values)=>values.filter(Boolean).join(' '));
  for(const status of ['Pago','Pendente','Synthetic']) {
    assert.deepEqual(exports.default({status,size:'sm'}),exports.default({status}));
  }
});
