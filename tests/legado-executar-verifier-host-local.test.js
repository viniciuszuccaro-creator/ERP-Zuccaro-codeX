import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = path.join(root, 'scripts/legado/executar-verifier-host-local.sh');

test('host-local executor existe, nao reexporta e aponta sha esperado', () => {
  const text = fs.readFileSync(sh, 'utf8');
  const body = text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.match(text, /18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e/);
  assert.match(text, /verificar-evidencia-erp-novo-pre-vps\.mjs/);
  assert.match(text, /executor=host_local/);
  assert.match(text, /sameFileAsPaste=/);
  assert.doesNotMatch(body, /exportar-empresas-api-somente-leitura/);
  assert.doesNotMatch(text, /tip-port|tipPort/);
  assert.doesNotMatch(body, /\b(UPDATE|DELETE|INSERT|DROP)\b/);
});
