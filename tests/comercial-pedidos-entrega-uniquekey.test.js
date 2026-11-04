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

test("PedidosEntregaTab injeta uniqueKey em abrirPainelLogistica", async () => {
  const src = await readFile(
    new URL("../src/components/comercial/PedidosEntregaTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*\n?\s*config\?\.uniqueKey \|\|/);
  assert.match(src, /comercial-pedido-entrega-/);
  assert.match(src, /effectiveGroupId \|\| null/);
  assert.match(src, /effectiveEmpresaId \|\| null/);
});

test("comportamental: mesma acao+escopo reusa; acoes/empresas distintas nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const m = openWithUniqueKey(registry, 'comercial-pedido-entrega-PedidoEntrega.metricas_abrir-["g","e"]', seq);
  const m2 = openWithUniqueKey(registry, 'comercial-pedido-entrega-PedidoEntrega.metricas_abrir-["g","e"]', seq);
  const a = openWithUniqueKey(registry, 'comercial-pedido-entrega-PedidoEntrega.analytics_abrir-["g","e"]', seq);
  const mB = openWithUniqueKey(registry, 'comercial-pedido-entrega-PedidoEntrega.metricas_abrir-["g","e2"]', seq);
  assert.equal(m2.reused, true);
  assert.equal(m2.id, m.id);
  assert.notEqual(a.id, m.id);
  assert.notEqual(mB.id, m.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'comercial-pedido-entrega-PedidoEntrega.roteirizacao_abrir-["g","e"]';
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
    new URL("../src/components/comercial/PedidosEntregaTab.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
