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

test("Contratos: Novo Contrato usa uniqueKey por escopo Grupo/Empresa", async () => {
  const source = await readFile(
    new URL("../src/pages/Contratos.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`contratos-create-/);
  assert.match(
    source,
    /contratos-create-\$\{JSON\.stringify\(\[contextoCanonico\.groupId, empresaAtual\?\.id \|\| null\]\)\}/,
  );
});

test("Contratos: Editar Contrato usa uniqueKey por id (sem unir registros distintos)", async () => {
  const source = await readFile(
    new URL("../src/pages/Contratos.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /contratos-edit-\$\{String\(contrato\.id\)\}/);
  assert.match(source, /contratos-edit-sem-id/);
});

test("comportamental: dois cliques em Novo Contrato reusam a mesma janela no escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'contratos-create-["g-cpa","e-ferro"]';
  const first = openWithUniqueKey(registry, key, seq);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.id, first.id);
  assert.equal(registry.size, 1);
});

test("comportamental: escopos e ids distintos nao colidem; fechar libera reabrir", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const createA = openWithUniqueKey(registry, 'contratos-create-["g","e1"]', seq);
  const createB = openWithUniqueKey(registry, 'contratos-create-["g","e2"]', seq);
  const edit1 = openWithUniqueKey(registry, "contratos-edit-c1", seq);
  const edit1b = openWithUniqueKey(registry, "contratos-edit-c1", seq);
  const edit2 = openWithUniqueKey(registry, "contratos-edit-c2", seq);

  assert.notEqual(createB.id, createA.id);
  assert.equal(edit1b.reused, true);
  assert.equal(edit1b.id, edit1.id);
  assert.notEqual(edit2.id, edit1.id);
  assert.notEqual(edit1.id, createA.id);

  closeWithUniqueKey(registry, 'contratos-create-["g","e1"]');
  const createA2 = openWithUniqueKey(registry, 'contratos-create-["g","e1"]', seq);
  assert.equal(createA2.reused, false);
  assert.notEqual(createA2.id, createA.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em Contratos)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const page = await readFile(new URL("../src/pages/Contratos.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /new WindowManager|createContext\(\s*['\"]Window/);
});
