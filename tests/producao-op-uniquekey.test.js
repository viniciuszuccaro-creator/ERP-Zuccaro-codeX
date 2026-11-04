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

test("Producao page Nova OP usa uniqueKey por escopo", async () => {
  const source = await readFile(
    new URL("../src/pages/Producao.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`producao-op-create-/);
});

test("KanbanProducaoInteligente: create/view OP usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/producao/KanbanProducaoInteligente.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`producao-op-create-kanban-/);
  assert.match(source, /producao-op-view-\$/);
});

test("comportamental: create por escopo e view por id nao colidem; dois cliques reusam", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const scopeA = 'producao-op-create-["g1","e1"]';
  const scopeB = 'producao-op-create-["g1","e2"]';
  const a1 = openWithUniqueKey(registry, scopeA, seq);
  const a2 = openWithUniqueKey(registry, scopeA, seq);
  const b = openWithUniqueKey(registry, scopeB, seq);
  const view1 = openWithUniqueKey(registry, "producao-op-view-op1", seq);
  const view1b = openWithUniqueKey(registry, "producao-op-view-op1", seq);
  const view2 = openWithUniqueKey(registry, "producao-op-view-op2", seq);

  assert.equal(a1.reused, false);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a1.id);
  assert.notEqual(b.id, a1.id);
  assert.equal(view1b.reused, true);
  assert.equal(view1b.id, view1.id);
  assert.notEqual(view2.id, view1.id);
  assert.notEqual(view1.id, a1.id);
});

test("comportamental: fechar create libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'producao-op-create-kanban-["g","e"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em Produção)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const page = await readFile(new URL("../src/pages/Producao.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /new WindowManager|createContext\(\s*['\"]Window/);
});
