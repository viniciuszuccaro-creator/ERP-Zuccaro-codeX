import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Espelha o guard síncrono do WindowManager (uniqueKeyRegistryRef):
 * segundo open com a mesma uniqueKey reutiliza a janela; chaves distintas
 * abrem janelas distintas. Não une registros diferentes.
 */
function openWithUniqueKey(registry, uniqueKey) {
  const key = uniqueKey ? String(uniqueKey) : "";
  if (key && registry.has(key)) {
    return { id: registry.get(key), reused: true, uniqueKey: key };
  }
  const id = `window-${registry.size + 1}`;
  if (key) registry.set(key, id);
  return { id, reused: false, uniqueKey: key || null };
}

function closeWithUniqueKey(registry, uniqueKey) {
  const key = uniqueKey ? String(uniqueKey) : "";
  if (key) registry.delete(key);
}

test("EntregasListagem: openWindow view/edit/separacao/reversa usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/expedicao/EntregasListagem.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /expedicao-entrega-view-\$/);
  assert.match(source, /expedicao-entrega-edit-\$/);
  assert.match(source, /expedicao-entrega-separacao-\$/);
  assert.match(source, /expedicao-entrega-reversa-\$/);
  assert.ok((source.match(/uniqueKey:/g) || []).length >= 5);
});

test("DetalhesEntregaView: logística reversa reusa a mesma uniqueKey da listagem", async () => {
  const source = await readFile(
    new URL("../src/components/expedicao/DetalhesEntregaView.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /expedicao-entrega-reversa-\$/);
});

test("comportamental: dois cliques no mesmo id reusam; id distinto e ação distinta nao colidem", () => {
  const registry = new Map();
  const view1a = openWithUniqueKey(registry, "expedicao-entrega-view-e1");
  const view1b = openWithUniqueKey(registry, "expedicao-entrega-view-e1");
  const view2 = openWithUniqueKey(registry, "expedicao-entrega-view-e2");
  const edit1 = openWithUniqueKey(registry, "expedicao-entrega-edit-e1");
  const sep1 = openWithUniqueKey(registry, "expedicao-entrega-separacao-e1");
  const rev1 = openWithUniqueKey(registry, "expedicao-entrega-reversa-e1");

  assert.equal(view1a.reused, false);
  assert.equal(view1b.reused, true);
  assert.equal(view1b.id, view1a.id);
  assert.notEqual(view2.id, view1a.id);
  assert.notEqual(edit1.id, view1a.id);
  assert.notEqual(sep1.id, view1a.id);
  assert.notEqual(rev1.id, view1a.id);
  assert.equal(registry.size, 5);
});

test("comportamental: fechar libera uniqueKey para reabrir o mesmo registro", () => {
  const registry = new Map();
  const first = openWithUniqueKey(registry, "expedicao-entrega-view-e9");
  closeWithUniqueKey(registry, "expedicao-entrega-view-e9");
  const second = openWithUniqueKey(registry, "expedicao-entrega-view-e9");
  assert.equal(first.reused, false);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico ainda é o dono do uniqueKey (sem segundo gerenciador)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  assert.match(wm, /segundo clique.*reutiliza|uniqueKey && uniqueKeyRegistryRef/);
  assert.doesNotMatch(
    await readFile(new URL("../src/components/expedicao/EntregasListagem.jsx", import.meta.url), "utf8"),
    /createContext\(|new WindowManager|openWindows\s*=\s*\[/,
  );
});
