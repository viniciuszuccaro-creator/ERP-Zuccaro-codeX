import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

test("PainelDinamicoCliente usa uniqueKey de edit distinto do painel", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/PainelDinamicoCliente.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`cadastros-cliente-edit-/);
  assert.match(src, /cliente\?\.id/);
  assert.doesNotMatch(src, /uniqueKey:\s*`painel-cliente-/);
});

test("comportamental: mesmo cliente reusa edit; distintos e painel nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const e1 = openWithUniqueKey(registry, "cadastros-cliente-edit-c1", seq);
  const e1b = openWithUniqueKey(registry, "cadastros-cliente-edit-c1", seq);
  const e2 = openWithUniqueKey(registry, "cadastros-cliente-edit-c2", seq);
  const painel = openWithUniqueKey(registry, "painel-cliente-c1", seq);
  assert.equal(e1b.reused, true);
  assert.equal(e1b.id, e1.id);
  assert.notEqual(e2.id, e1.id);
  assert.notEqual(painel.id, e1.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = "cadastros-cliente-edit-cx";
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
    new URL("../src/components/cadastros/PainelDinamicoCliente.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
