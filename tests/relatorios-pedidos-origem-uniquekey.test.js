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

test("RelatorioPedidosPorOrigem usa API canônica openWindow + uniqueKey", async () => {
  const src = await readFile(
    new URL("../src/components/relatorios/RelatorioPedidosPorOrigem.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /openWindow\(\s*PedidoFormCompleto/);
  assert.match(src, /uniqueKey:\s*`comercial-pedido-origem-view-/);
  assert.match(src, /pedido\?\.id/);
  // Não usa mais a assinatura legado { title, component, props, size }
  assert.doesNotMatch(src, /openWindow\(\{\s*title:/);
});

test("comportamental: mesmo pedido reusa; distintos nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a = openWithUniqueKey(registry, "comercial-pedido-origem-view-p1", seq);
  const a2 = openWithUniqueKey(registry, "comercial-pedido-origem-view-p1", seq);
  const b = openWithUniqueKey(registry, "comercial-pedido-origem-view-p2", seq);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a.id);
  assert.notEqual(b.id, a.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = "comercial-pedido-origem-view-px";
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
    new URL("../src/components/relatorios/RelatorioPedidosPorOrigem.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
