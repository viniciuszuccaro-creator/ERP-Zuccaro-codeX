// DEV-only browser smoke. Fresh context, synthetic proposal, external traffic blocked.
// Usage: node scripts/comercial360-preview-smoke.mjs /absolute/path/playwright/index.mjs /tmp/output
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath=process.argv[2];
const { chromium } = await import(modulePath ? pathToFileURL(path.resolve(modulePath)).href : 'playwright');
const output=path.resolve(process.argv[3] || '/tmp/erp-comercial-preview');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const blocked=[],writes=[],errors=[];
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='localhost'&&u.port==='5173')return route.continue();blocked.push({host:u.hostname,port:u.port,path:u.pathname});return route.abort();});
page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push(new URL(request.url()).pathname);});
page.on('pageerror',e=>errors.push(e.name));
await page.goto('http://localhost:5173/Comercial?proposta=comercial360',{waitUntil:'networkidle',timeout:90000});
await page.getByText('Orçamentos',{exact:true}).click();await page.getByRole('button',{name:'Novo orçamento',exact:true}).click();
const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Novo orçamento',exact:true})});
await dialog.locator('#orc-cliente').click();await page.getByRole('option',{name:/Cliente SINTÉTICO/}).click();
await dialog.getByRole('combobox').last().click();await page.getByRole('option',{name:/Produto SINTÉTICO/}).click();
await dialog.locator('#orc-condicao').click();await page.getByRole('option',{name:/Condição ilustrativa/}).click();
await dialog.locator('#orc-tabela').click();await page.getByRole('option',{name:/Tabela ilustrativa/}).click();
await dialog.locator('input[inputmode="decimal"]').first().fill('2');
await dialog.locator('#orc-observacoes').fill('Rascunho SINTÉTICO preservado entre painéis.');
await dialog.getByRole('button',{name:'Produtos e disponibilidade',exact:true}).click();
await dialog.getByText('Disponibilidade ilustrativa: 30 UN',{exact:true}).waitFor();
await dialog.getByRole('button',{name:'Resumo e pagamento',exact:true}).click();await dialog.getByRole('region',{name:'Resumo sintético'}).locator('dd.font-bold').filter({hasText:'20,00'}).waitFor();
await dialog.getByRole('button',{name:'Cliente e histórico',exact:true}).click();
const retained=await dialog.locator('#orc-observacoes').inputValue();const quantity=await dialog.locator('input[inputmode="decimal"]').first().inputValue();
const disabled=await dialog.getByRole('button',{name:'Salvar orçamento',exact:true}).isDisabled();
await page.screenshot({path:path.join(output,'desktop.png'),fullPage:false,animations:'disabled'});
await page.setViewportSize({width:1024,height:900});await page.waitForFunction(()=>{const el=document.querySelector('[role=dialog]');if(!el)return false;const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});await dialog.getByRole('navigation',{name:'Painéis da proposta'}).scrollIntoViewIfNeeded();
await dialog.getByRole('button',{name:'Resumo e pagamento',exact:true}).click();
await dialog.getByRole('region',{name:'Resumo sintético'}).locator('dd.font-bold').filter({hasText:'20,00'}).waitFor();
await dialog.getByRole('button',{name:'Cliente e histórico',exact:true}).click();
await page.screenshot({path:path.join(output,'tablet.png'),fullPage:false,animations:'disabled'});
const geometry=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,cssWidth:s.width,minWidth:s.minWidth,maxWidth:s.maxWidth};});
const overflow=geometry.left<0||geometry.right>geometry.viewport;
console.log(JSON.stringify({retained:retained==='Rascunho SINTÉTICO preservado entre painéis.',quantity:quantity==='2',saveDisabled:disabled,horizontalOverflow:overflow,geometry,writes:writes.length,blockedRequests:blocked.length,errors}));
if(retained!=='Rascunho SINTÉTICO preservado entre painéis.'||quantity!=='2'||!disabled||writes.length||overflow||errors.length)process.exitCode=1;
} finally { await browser.close(); }
