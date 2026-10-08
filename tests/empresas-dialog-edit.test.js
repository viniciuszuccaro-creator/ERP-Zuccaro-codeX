import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Empresas: edição controlada sem DialogTrigger e FormWrapper com key', async () => {
  const source = await readFile(new URL('../src/pages/Empresas.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /DialogTrigger/);
  assert.match(source, /data-action=["']empresa-edit["']/);
  assert.match(source, /data-action=["']empresa-nova["']/);
  assert.match(source, /data-action=["']empresa-form-dialog["']/);
  assert.match(source, /key=\{editingEmpresa\?\.id \|\| ['"]nova-empresa['"]\}/);
  assert.match(source, /withContext=\{false\}/);
  assert.match(source, /setIsDialogOpen\(true\)/);
});
