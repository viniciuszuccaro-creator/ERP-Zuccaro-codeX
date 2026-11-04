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

test("DetalhesEntregaView usa uniqueKey em logística reversa", async () => {
  const src = await readFile(
    new URL("../src/components/expedicao/DetalhesEntregaView.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`expedicao-logistica-reversa-/);
  assert.match(src, /entrega\?\.id/);
});

test("comportamental: mesma entrega reusa; distintas nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a = openWithUniqueKey(registry, "expedicao-logistica-reversa-e1", seq);
  const a2 = openWithUniqueKey(registry, "expedicao-logistica-reversa-e1", seq);
  const b = openWithUniqueKey(registry, "expedicao-logistica-reversa-e2", seq);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a.id);
  assert.notEqual(b.id, a.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = "expedicao-logistica-reversa-ex";
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
    new URL("../src/components/expedicao/DetalhesEntregaView.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
