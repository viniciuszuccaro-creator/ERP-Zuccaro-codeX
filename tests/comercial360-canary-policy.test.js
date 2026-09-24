import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const script = fileURLToPath(new URL('../scripts/deploy/comercial360-canary.sh', import.meta.url));

function precheck({ port = '3086', name = 'erp-api-comercial360-canary' } = {}) {
  return spawnSync(bash, [script], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      SystemRoot: process.env.SystemRoot ?? '',
      IMAGE: 'synthetic:sha',
      ENV_FILE: '/nonexistent/synthetic.env',
      ERP_DOCKER_NETWORK: 'synthetic',
      CANARY_PORT: port,
      CANARY_NAME: name,
    },
  });
}

test('Comercial 360 canary rejects the official 3080 and invalid ports before Docker', () => {
  for (const port of ['3080', '0', '1023', '65536', 'abc', '03086']) {
    const result = precheck({ port });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /BLOCKED: canary requires an unprivileged isolated port other than 3080/);
    assert.doesNotMatch(result.stderr, /docker/i);
  }
});

test('Comercial 360 canary cannot take the official API container name', () => {
  const result = precheck({ name: 'erp-api-dev' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BLOCKED: canary must not use the official API container name/);
});

function metadataGate(path, metadata) {
  const source = readFileSync(path, 'utf8');
  const expression = source.match(/if ! node -e "([^"]+)" "\$meta" "\$EXPECTED_RUNTIME"/)?.[1];
  assert.ok(expression, 'script must fail closed on metadata mismatch');
  const payload = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  return spawnSync(process.execPath, ['-e', expression, payload, 'COMERCIAL-360-V1'], { encoding: 'utf8' });
}

test('Comercial 360 canary requires the reviewed runtime and verified Supabase Auth', () => {
  const meta = { runtime: 'COMERCIAL-360-V1', auth: { mode: 'supabase_user' } };
  assert.equal(metadataGate(script, meta).status, 0);
  for (const invalid of [
    { ...meta, auth: { mode: 'dev_headers' } },
    { ...meta, auth: undefined },
    { ...meta, runtime: 'ERP-RUNTIME-07B' },
    '{invalid-json',
  ]) assert.equal(metadataGate(script, invalid).status, 1);
});

test('Comercial 360 smoke also requires verified Auth and both commercial entities', () => {
  const smoke = fileURLToPath(new URL('../scripts/deploy/comercial360-smoke.sh', import.meta.url));
  const meta = { runtime: 'COMERCIAL-360-V1', auth: { mode: 'supabase_user' }, httpEntities: ['Orcamento', 'Pedido'] };
  assert.equal(metadataGate(smoke, meta).status, 0);
  for (const invalid of [
    { ...meta, auth: { mode: 'dev_headers' } },
    { ...meta, httpEntities: ['Orcamento'] },
    { ...meta, runtime: 'ERP-RUNTIME-07B' },
  ]) assert.equal(metadataGate(smoke, invalid).status, 1);
});
