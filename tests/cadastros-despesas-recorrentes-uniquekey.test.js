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

test("GestorDespesasRecorrentes usa uniqueKey em criar e editar", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/GestorDespesasRecorrentes.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`cadastros-despesa-recorrente-create-/);
  assert.match(src, /uniqueKey:\s*`cadastros-despesa-recorrente-edit-/);
  assert.match(src, /config\?\.id/);
  assert.match(src, /groupId \|\| null,\s*empresaAtual\?\.id \|\| null/);
});

test("comportamental: create por escopo reusa; edits distintas por id", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const c1 = openWithUniqueKey(registry, 'cadastros-despesa-recorrente-create-["g","e"]', seq);
  const c1b = openWithUniqueKey(registry, 'cadastros-despesa-recorrente-create-["g","e"]', seq);
  const c2 = openWithUniqueKey(registry, 'cadastros-despesa-recorrente-create-["g","e2"]', seq);
  const e1 = openWithUniqueKey(registry, "cadastros-despesa-recorrente-edit-d1", seq);
  const e1b = openWithUniqueKey(registry, "cadastros-despesa-recorrente-edit-d1", seq);
  const e2 = openWithUniqueKey(registry, "cadastros-despesa-recorrente-edit-d2", seq);

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
  const key = "cadastros-despesa-recorrente-edit-dx";
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
    new URL("../src/components/cadastros/GestorDespesasRecorrentes.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
