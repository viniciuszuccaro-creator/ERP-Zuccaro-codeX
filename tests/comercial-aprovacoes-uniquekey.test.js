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

test("CentralAprovacoesManager usa uniqueKey por modo+pedido", async () => {
  const src = await readFile(
    new URL("../src/components/comercial/CentralAprovacoesManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`comercial-aprovacao-analisar-/);
  assert.match(src, /uniqueKey:\s*`comercial-aprovacao-fechar-/);
  assert.match(src, /pedido\?\.id/);
});

test("comportamental: mesmo modo+pedido reusa; modos e pedidos distintos nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a1 = openWithUniqueKey(registry, "comercial-aprovacao-analisar-p1", seq);
  const a1b = openWithUniqueKey(registry, "comercial-aprovacao-analisar-p1", seq);
  const f1 = openWithUniqueKey(registry, "comercial-aprovacao-fechar-p1", seq);
  const a2 = openWithUniqueKey(registry, "comercial-aprovacao-analisar-p2", seq);

  assert.equal(a1b.reused, true);
  assert.equal(a1b.id, a1.id);
  assert.notEqual(f1.id, a1.id);
  assert.notEqual(a2.id, a1.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = "comercial-aprovacao-analisar-px";
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
    new URL("../src/components/comercial/CentralAprovacoesManager.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
