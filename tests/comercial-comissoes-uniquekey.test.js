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

test("ComissoesTab usa uniqueKey em calcular e detalhe", async () => {
  const src = await readFile(
    new URL("../src/components/comercial/ComissoesTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`comercial-comissoes-calcular-/);
  assert.match(src, /uniqueKey:\s*`comercial-comissao-detalhe-/);
  assert.match(src, /comissao\?\.id/);
});

test("comportamental: mesmo cálculo+escopo reusa; detalhe distinto por id", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const calcA = openWithUniqueKey(registry, 'comercial-comissoes-calcular-["g","e","u"]', seq);
  const calcA2 = openWithUniqueKey(registry, 'comercial-comissoes-calcular-["g","e","u"]', seq);
  const calcB = openWithUniqueKey(registry, 'comercial-comissoes-calcular-["g","e2","u"]', seq);
  const d1 = openWithUniqueKey(registry, "comercial-comissao-detalhe-c1", seq);
  const d1b = openWithUniqueKey(registry, "comercial-comissao-detalhe-c1", seq);
  const d2 = openWithUniqueKey(registry, "comercial-comissao-detalhe-c2", seq);

  assert.equal(calcA2.reused, true);
  assert.equal(calcA2.id, calcA.id);
  assert.notEqual(calcB.id, calcA.id);
  assert.equal(d1b.reused, true);
  assert.equal(d1b.id, d1.id);
  assert.notEqual(d2.id, d1.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = "comercial-comissao-detalhe-c9";
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
    new URL("../src/components/comercial/ComissoesTab.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
