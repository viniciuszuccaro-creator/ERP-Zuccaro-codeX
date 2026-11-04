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

test("GestorDespesasRecorrentes: create/edit usam uniqueKey sem unir registros", async () => {
  const source = await readFile(
    new URL("../src/components/cadastros/GestorDespesasRecorrentes.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`cadastros-despesa-recorrente-create-/);
  assert.match(source, /cadastros-despesa-recorrente-edit-\$\{String\(config\.id\)\}/);
  assert.match(source, /cadastros-despesa-recorrente-edit-sem-id/);
});

test("GestorGatewaysPagamento: create/edit usam uniqueKey sem unir registros", async () => {
  const source = await readFile(
    new URL("../src/components/cadastros/GestorGatewaysPagamento.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`cadastros-gateway-pagamento-create-/);
  assert.match(source, /cadastros-gateway-pagamento-edit-\$\{String\(gateway\.id\)\}/);
  assert.match(source, /cadastros-gateway-pagamento-edit-sem-id/);
});

test("comportamental: create por escopo e edit por id; cliques repetidos reusam; entidades nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const createDesp = openWithUniqueKey(registry, 'cadastros-despesa-recorrente-create-["g","e1"]', seq);
  const createDesp2 = openWithUniqueKey(registry, 'cadastros-despesa-recorrente-create-["g","e1"]', seq);
  const createDespB = openWithUniqueKey(registry, 'cadastros-despesa-recorrente-create-["g","e2"]', seq);
  const editDesp1 = openWithUniqueKey(registry, "cadastros-despesa-recorrente-edit-d1", seq);
  const editDesp1b = openWithUniqueKey(registry, "cadastros-despesa-recorrente-edit-d1", seq);
  const editDesp2 = openWithUniqueKey(registry, "cadastros-despesa-recorrente-edit-d2", seq);
  const createGw = openWithUniqueKey(registry, 'cadastros-gateway-pagamento-create-["g","e1"]', seq);
  const editGw = openWithUniqueKey(registry, "cadastros-gateway-pagamento-edit-g1", seq);

  assert.equal(createDesp2.reused, true);
  assert.equal(createDesp2.id, createDesp.id);
  assert.notEqual(createDespB.id, createDesp.id);
  assert.equal(editDesp1b.reused, true);
  assert.equal(editDesp1b.id, editDesp1.id);
  assert.notEqual(editDesp2.id, editDesp1.id);
  assert.notEqual(createGw.id, createDesp.id);
  assert.notEqual(editGw.id, editDesp1.id);
});

test("comportamental: fechar create libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'cadastros-gateway-pagamento-create-["g","e"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador nos gestores)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  for (const rel of [
    "../src/components/cadastros/GestorDespesasRecorrentes.jsx",
    "../src/components/cadastros/GestorGatewaysPagamento.jsx",
  ]) {
    const src = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
  }
});
