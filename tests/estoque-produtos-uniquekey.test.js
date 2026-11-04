import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Guard síncrono espelhando WindowManager.uniqueKeyRegistryRef. */
function openWithUniqueKey(registry, uniqueKey, seq) {
  const key = uniqueKey ? String(uniqueKey) : "";
  if (key && registry.has(key)) {
    return { id: registry.get(key), reused: true };
  }
  const id = `window-${seq.nextId++}`;
  if (key) registry.set(key, id);
  return { id, reused: false };
}

function closeWithUniqueKey(registry, uniqueKey) {
  const key = uniqueKey ? String(uniqueKey) : "";
  if (key) registry.delete(key);
}

test("ProdutosTab: opens usam uniqueKey por escopo; conversao compartilhada", async () => {
  const source = await readFile(
    new URL("../src/components/estoque/ProdutosTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /estoque-produto-create-/);
  assert.match(source, /estoque-produto-dashboard-producao-/);
  assert.match(source, /estoque-produto-importar-planilha-/);
  assert.equal(
    (source.match(/estoque-produto-conversao-massa-\$\{scopeKey\}/g) || []).length,
    2,
  );
  assert.match(source, /scopeKey\s*=\s*JSON\.stringify\(\[groupId, empresaId\]\)/);
});

test("comportamental: create/dashboard/import distintos; conversao reusa entre entradas", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const scope = '["g","e1"]';
  const create1 = openWithUniqueKey(registry, `estoque-produto-create-${scope}`, seq);
  const create2 = openWithUniqueKey(registry, `estoque-produto-create-${scope}`, seq);
  const dash = openWithUniqueKey(registry, `estoque-produto-dashboard-producao-${scope}`, seq);
  const convDash = openWithUniqueKey(registry, `estoque-produto-conversao-massa-${scope}`, seq);
  const convBtn = openWithUniqueKey(registry, `estoque-produto-conversao-massa-${scope}`, seq);
  const importar = openWithUniqueKey(registry, `estoque-produto-importar-planilha-${scope}`, seq);

  assert.equal(create2.reused, true);
  assert.equal(create2.id, create1.id);
  assert.notEqual(dash.id, create1.id);
  assert.equal(convBtn.reused, true);
  assert.equal(convBtn.id, convDash.id);
  assert.notEqual(importar.id, create1.id);
});

test("comportamental: fechar create libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'estoque-produto-create-["g","e"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em ProdutosTab)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const tab = await readFile(
    new URL("../src/components/estoque/ProdutosTab.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(tab, /new WindowManager|createContext\(\s*['\"]Window/);
});
