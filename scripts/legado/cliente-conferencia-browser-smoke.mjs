import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

/** Test-only harness for the existing consumer. Never mounts an operational route or handles real sessions. */
export async function exerciseClienteConferenciaBrowser({ modulePath, baseUrl, groupId, actorId, repo, output }) {
  const target = new URL(baseUrl);
  assert.equal(target.origin.startsWith('http://127.0.0.1:'), true);
  assert.equal(groupId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(actorId, 'a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4');
  assert.equal(path.isAbsolute(modulePath), true); assert.equal(path.isAbsolute(output), true);
  assert.equal(path.resolve(output).startsWith(path.resolve(repo) + path.sep), false);
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const frontend = 'http://127.0.0.1:4175', bootstrap = '/__conferencia-fixture.jsx';
  const permissionsModule = '\0synthetic-conferencia-permissions';
  // The fixture supplies frontend permissions only; backend middleware and PostgreSQL RBAC are never replaced.
  const permissions = `export default function usePermissions(){return {isLoading:false,
    hasPermission:(m,s,a)=>m==='Cadastros'&&s==='cliente'&&['visualizar','importar'].includes(a)}}`;
  const source = `import React from 'react';import{createRoot}from'react-dom/client';
    import{persistErpHttpSession,clearErpHttpSession,HTTP_CONTEXT_CHANGED}from'/src/api/erpHttpSession.js';
    persistErpHttpSession({accessToken:'synthetic-valid',groupId:${JSON.stringify(groupId)},actorId:${JSON.stringify(actorId)},scopeType:'grupo'});
    window.clearSyntheticSession=()=>{clearErpHttpSession();window.dispatchEvent(new Event(HTTP_CONTEXT_CHANGED));};
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(...args)=>{const response=await nativeFetch(...args);
      if(window.delaySyntheticResponse&&String(args[0]).includes('/conferencia-legado')){
        window.syntheticResponseReady=true;await new Promise(resolve=>{window.releaseSyntheticResponse=resolve;});
      }return response;};
    const {default:Consumer}=await import('/src/components/comercial/ClienteConferenciaLegado.jsx');
    createRoot(document.getElementById('root')).render(React.createElement(Consumer));`;
  const vite = await createServer({ configFile: false, root: repo, publicDir: false, appType: 'custom',
    resolve: { alias: { '@': path.join(repo, 'src') } },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] },
    define: { 'import.meta.env.VITE_ERP_API_BASE_URL': JSON.stringify(baseUrl) },
    server: { host: '127.0.0.1', port: 4175, strictPort: true, hmr: false, cors: false },
    plugins: [{ name: 'synthetic-conferencia-fixture', enforce: 'pre',
      resolveId(id) { if (/[/\\]src[/\\]components[/\\]lib[/\\]usePermissions(?:\.jsx?)?$/.test(id) || id === '@/components/lib/usePermissions') return permissionsModule;
        if (id === bootstrap) return id; },
      load(id) { if (id === permissionsModule) return permissions; if (id === bootstrap) return source; },
      configureServer(server) { server.middlewares.use((req, res, next) => {
        if (req.url !== '/') return next();
        res.setHeader('content-type', 'text/html;charset=utf-8'); res.setHeader('cache-control', 'no-store');
        res.end('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><div id="root"></div><script type="module" src="' + bootstrap + '"></script></html>');
      }); },
    }] });
  let browser;
  const checks = [];
  try {
    await vite.listen(); browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => [frontend, target.origin].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    const page = await context.newPage(), calls = [];
    page.on('request', request => { if (request.url().startsWith(baseUrl)) calls.push(new URL(request.url()).pathname); });
    await page.goto(frontend); await page.getByRole('heading', { name: 'Conferência de clientes legados' }).waitFor();
    assert.deepEqual(calls, []); checks.push('consumer-no-eager-or-broad-request');
    const input = { identidades: [{ documento: '11222333000181', sourceSystem: 'SYNTHETIC_CONFERENCE', codigoLegado: 'native-001' }] };
    const textarea = page.locator('#cliente-coorte'), button = page.getByRole('button', { name: 'Conferir coorte', exact: true });
    await textarea.fill(JSON.stringify(input)); await button.click();
    await page.getByRole('table').waitFor(); assert.equal(await page.locator('tbody tr').count(), 1);
    assert.equal((await page.getByRole('table').textContent()).includes('11222333000181'), false);
    checks.push('adapter-http-canonical-service-consumer');
    await textarea.fill(JSON.stringify({ identidades: Array(100).fill(input.identidades[0]) })); await button.click();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 100);
    checks.push('hundred-identities-rendered-without-list-query');
    await textarea.fill(JSON.stringify({ identidades: Array(101).fill(input.identidades[0]) })); await button.click();
    await page.getByRole('alert').waitFor(); assert.equal(await page.locator('tbody tr').count(), 0);
    checks.push('oversized-cohort-refused');
    await page.evaluate(() => { window.delaySyntheticResponse = true; });
    await textarea.fill(JSON.stringify(input)); await button.click();
    await page.waitForFunction(() => window.syntheticResponseReady === true);
    await page.evaluate(() => { window.clearSyntheticSession(); window.releaseSyntheticResponse(); });
    await page.getByRole('status').waitFor(); assert.equal(await page.locator('tbody tr').count(), 0);
    assert.equal(await textarea.inputValue(), ''); assert.equal(await button.isDisabled(), true);
    checks.push('revoked-session-discards-real-late-response');
    assert.ok(calls.every(value => value === '/api/v1/clientes/conferencia-legado'));
    fs.mkdirSync(output, { recursive: true, mode: 0o700 });
    await page.screenshot({ path: path.join(output, 'synthetic-consumer.png'), fullPage: true });
    const served = await (await page.request.get(frontend + '/src/components/comercial/ClienteConferenciaLegado.jsx')).text();
    const sha = bytes => createHash('sha256').update(bytes).digest('hex');
    const result = { passed: checks.length, failed: 0, skipped: 0, checks, syntheticOnly: true,
      frontendPermissionFixture: true, backendAuthAndRbacRealCode: true, operationalHomologation: false,
      baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim(),
      consumerSourceSha256: sha(fs.readFileSync(path.join(repo, 'src/components/comercial/ClienteConferenciaLegado.jsx'))),
      servedDevModuleSha256: sha(served), privateDataServed: false };
    fs.writeFileSync(path.join(output, 'result-sanitized.json'), JSON.stringify(result), { mode: 0o600 });
    return result;
  } finally { if (browser) await browser.close(); await vite.close(); }
}
