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

test("PontoTab: Registrar Ponto usa uniqueKey singleton", async () => {
  const source = await readFile(
    new URL("../src/components/rh/PontoTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*['"]rh-ponto-create['"]/);
});

test("comportamental: dois cliques em Registrar Ponto reusam a mesma janela", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const first = openWithUniqueKey(registry, "rh-ponto-create", seq);
  const second = openWithUniqueKey(registry, "rh-ponto-create", seq);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.id, first.id);
  assert.equal(registry.size, 1);
});

test("comportamental: fechar libera singleton para reabrir formulário", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const first = openWithUniqueKey(registry, "rh-ponto-create", seq);
  closeWithUniqueKey(registry, "rh-ponto-create");
  const second = openWithUniqueKey(registry, "rh-ponto-create", seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("comportamental: rh-ponto-create nao colide com outra entidade", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const ponto = openWithUniqueKey(registry, "rh-ponto-create", seq);
  const outra = openWithUniqueKey(registry, "producao-op-view-x", seq);
  assert.notEqual(outra.id, ponto.id);
  assert.equal(registry.size, 2);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em RH)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const tab = await readFile(new URL("../src/components/rh/PontoTab.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(tab, /new WindowManager|createContext\(\s*['\"]Window/);
});
