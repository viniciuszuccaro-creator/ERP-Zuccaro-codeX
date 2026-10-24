import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const runtimeHashes = {
  'src/components/ui/accordion.jsx': 'a37cd7bcc594ed60f97a1d7efb8ef3f4fafb4ae4158b7b576ee2e153f5955fd2',
  'src/components/ui/alert-dialog.jsx': '7fb8c7c90ac865d4286d41e25504a49adaa2ed2b55078111554964bf09781558',
  'src/components/ui/resizable.jsx': '5cf1f5e74a36db9eb0a65f070783f5614072ba3a4351d5e0b264c7aa97e6f859',
};
for (const [file,expected] of Object.entries(runtimeHashes)) test(`${file}: native prop annotations preserve complete emitted runtime`, () => {
  const emitted = ts.transpileModule(fs.readFileSync(file,'utf8'), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true,jsx:ts.JsxEmit.React},
  }).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),expected);
});

test('native props preserve required identifiers, directions, event handlers and element refs', () => {
  const filename = path.resolve('tests/synthetic-native-ui-contracts.tsx');
  const source = `import * as React from 'react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '../src/components/ui/accordion';
import {AlertDialogContent,AlertDialogHeader,AlertDialogFooter,AlertDialogTitle,AlertDialogDescription,AlertDialogAction,AlertDialogCancel} from '../src/components/ui/alert-dialog';
import {ResizablePanelGroup,ResizablePanel,ResizableHandle} from '../src/components/ui/resizable';
const divRef = React.createRef<HTMLDivElement>();
const buttonRef = React.createRef<HTMLButtonElement>();
const goodAccordion = <Accordion type="single" collapsible><AccordionItem value="synthetic" ref={divRef}><AccordionTrigger ref={buttonRef} onClick={event => event.currentTarget.focus()}>Synthetic</AccordionTrigger><AccordionContent ref={divRef}>Synthetic</AccordionContent></AccordionItem></Accordion>;
const goodDialog = <AlertDialogContent ref={divRef}><AlertDialogHeader><AlertDialogTitle>Synthetic</AlertDialogTitle><AlertDialogDescription>Synthetic</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction ref={buttonRef} disabled={false} onClick={event => event.currentTarget.focus()}>Synthetic</AlertDialogAction><AlertDialogCancel ref={buttonRef}>Synthetic</AlertDialogCancel></AlertDialogFooter></AlertDialogContent>;
const goodResize = <ResizablePanelGroup direction="horizontal" onLayout={sizes => sizes.map(size => size.toFixed())}><ResizablePanel/><ResizableHandle/><ResizablePanel/><ResizableHandle withHandle/><ResizableHandle className="synthetic"/></ResizablePanelGroup>;
const missingIdentifier = <AccordionItem/>;
const badClick = <AccordionTrigger onClick="invalid"/>;
const badDisabled = <AlertDialogAction disabled="invalid"/>;
const badRef = <AlertDialogContent ref={buttonRef}/>;
const badDirection = <ResizablePanelGroup direction="diagonal"/>;
const badGrip = <ResizableHandle withHandle="invalid"/>;
const badClass = <AlertDialogHeader className={123}/>;`;
  const options = {allowJs:true,checkJs:false,noEmit:true,jsx:ts.JsxEmit.ReactJSX,
    target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
    skipLibCheck:true,baseUrl:process.cwd(),paths:{'@/*':['./src/*']}};
  const host = ts.createCompilerHost(options), read = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? source : read(file);
  const program = ts.createProgram([filename],options,host);
  const errors = program.getSemanticDiagnostics().filter(error => error.file && path.resolve(error.file.fileName) === filename);
  assert.deepEqual(errors.map(error => ({code:error.code,line:error.file.getLineAndCharacterOfPosition(error.start).line})),
    [9,10,11,12,13,14,15].map((line,index) => ({code:index === 0 ? 2741 : 2322,line})));
});
