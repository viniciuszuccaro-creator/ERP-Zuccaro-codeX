import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');

async function walkJs(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'sistema') continue;
      await walkJs(full, acc);
      continue;
    }
    if (/\.(jsx?|tsx?)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

test('Contatos: Form canônico montado em Completo e Painel; adaptador comercial órfão de produção', async () => {
  const form = await readFile(path.join(srcRoot, 'components/cadastros/GerenciarContatosClienteForm.jsx'), 'utf8');
  const adapter = await readFile(path.join(srcRoot, 'components/comercial/GerenciarContatosCliente.jsx'), 'utf8');
  const completo = await readFile(path.join(srcRoot, 'components/cadastros/CadastroClienteCompleto.jsx'), 'utf8');
  const painel = await readFile(path.join(srcRoot, 'components/cadastros/PainelDinamicoCliente.jsx'), 'utf8');

  assert.match(adapter, /GerenciarContatosClienteForm/);
  assert.match(adapter, /assertScopeCurrent/);
  assert.match(completo, /<GerenciarContatosClienteForm\b/);
  assert.match(painel, /<GerenciarContatosClienteForm\b/);
  assert.doesNotMatch(painel, /GerenciarContatosCliente[^F]/);
  assert.doesNotMatch(completo, /from ['"].*comercial\/GerenciarContatosCliente['"]/);
  assert.match(form, /Cadastros\.Cliente\.contato\.(adicionar|salvar|editar|excluir)/);

  const files = await walkJs(srcRoot);
  const productionImporters = [];
  for (const file of files) {
    if (file.endsWith(`${path.sep}comercial${path.sep}GerenciarContatosCliente.jsx`)) continue;
    const src = await readFile(file, 'utf8');
    if (/from\s+['"][^'"]*GerenciarContatosCliente['"]/.test(src)
      || /import\s*\(\s*['"][^'"]*GerenciarContatosCliente['"]\s*\)/.test(src)) {
      productionImporters.push(path.relative(root, file));
    }
  }
  assert.deepEqual(
    productionImporters,
    [],
    `Adaptador comercial deve permanecer órfão de montagem; encontrados: ${productionImporters.join(', ')}`,
  );
});
