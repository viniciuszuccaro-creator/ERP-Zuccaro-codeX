import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Guard síncrono espelhando WindowManager.uniqueKeyRegistryRef. */
function openWithUniqueKey(registry, uniqueKey, seq) {
  const key = uniqueKey ? String(uniqueKey) : '';
  if (key && registry.has(key)) {
    return { id: registry.get(key), reused: true };
  }
  const id = `window-${seq.nextId++}`;
  if (key) registry.set(key, id);
  return { id, reused: false };
}

function closeWithUniqueKey(registry, uniqueKey) {
  const key = uniqueKey ? String(uniqueKey) : '';
  if (key) registry.delete(key);
}

test('PedidosTab usa uniqueKey em aprovações e automação', async () => {
  const src = await readFile(
    new URL('../src/components/comercial/PedidosTab.jsx', import.meta.url),
    'utf8',
  );
  assert.match(src, /uniqueKey:\s*`comercial-pedidos-aprovacoes-/);
  assert.match(src, /uniqueKey:\s*`comercial-pedidos-automacao-/);
  assert.match(src, /pedido\?\.id \|\| pedido\?\.numero_pedido/);
  assert.match(src, /groupId \|\| null, empresaContextoId \|\| null/);
});

test('comportamental: clique repetido reusa; pedidos distintos não unem', () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const aprA = openWithUniqueKey(registry, 'comercial-pedidos-aprovacoes-["g","e"]', seq);
  const aprA2 = openWithUniqueKey(registry, 'comercial-pedidos-aprovacoes-["g","e"]', seq);
  const aprB = openWithUniqueKey(registry, 'comercial-pedidos-aprovacoes-["g","e2"]', seq);
  const aut1 = openWithUniqueKey(registry, 'comercial-pedidos-automacao-p1', seq);
  const aut1b = openWithUniqueKey(registry, 'comercial-pedidos-automacao-p1', seq);
  const aut2 = openWithUniqueKey(registry, 'comercial-pedidos-automacao-p2', seq);

  assert.equal(aprA2.reused, true);
  assert.equal(aprA2.id, aprA.id);
  assert.notEqual(aprB.id, aprA.id);
  assert.equal(aut1b.reused, true);
  assert.equal(aut1b.id, aut1.id);
  assert.notEqual(aut2.id, aut1.id);
});

test('comportamental: fechar libera reabertura; rascunho de outro pedido permanece', () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key1 = 'comercial-pedidos-automacao-p1';
  const key2 = 'comercial-pedidos-automacao-p2';
  const first = openWithUniqueKey(registry, key1, seq);
  const other = openWithUniqueKey(registry, key2, seq);
  closeWithUniqueKey(registry, key1);
  const second = openWithUniqueKey(registry, key1, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
  assert.equal(registry.get(key2), other.id);
});

test('WindowManager canônico permanece o dono', async () => {
  const wm = await readFile(
    new URL('../src/components/lib/WindowManager.jsx', import.meta.url),
    'utf8',
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const src = await readFile(
    new URL('../src/components/comercial/PedidosTab.jsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
