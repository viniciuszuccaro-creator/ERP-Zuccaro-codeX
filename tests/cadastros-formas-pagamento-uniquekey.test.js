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

test("GestorFormasPagamento usa uniqueKey em criar e editar", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/GestorFormasPagamento.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`cadastros-forma-pagamento-create-/);
  assert.match(src, /uniqueKey:\s*`cadastros-forma-pagamento-edit-/);
  assert.match(src, /forma\?\.id/);
});

test("comportamental: create por escopo reusa; edits distintas por id", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const c1 = openWithUniqueKey(registry, 'cadastros-forma-pagamento-create-["g","e"]', seq);
  const c1b = openWithUniqueKey(registry, 'cadastros-forma-pagamento-create-["g","e"]', seq);
  const c2 = openWithUniqueKey(registry, 'cadastros-forma-pagamento-create-["g","e2"]', seq);
  const e1 = openWithUniqueKey(registry, "cadastros-forma-pagamento-edit-f1", seq);
  const e1b = openWithUniqueKey(registry, "cadastros-forma-pagamento-edit-f1", seq);
  const e2 = openWithUniqueKey(registry, "cadastros-forma-pagamento-edit-f2", seq);

  assert.equal(c1b.reused, true);
  assert.equal(c1b.id, c1.id);
  assert.notEqual(c2.id, c1.id);
  assert.equal(e1b.reused, true);
  assert.equal(e1b.id, e1.id);
  assert.notEqual(e2.id, e1.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = "cadastros-forma-pagamento-edit-fx";
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const src = await readFile(
    new URL("../src/components/cadastros/GestorFormasPagamento.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
