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

test("RequisicoesAlmoxarifadoTab: Nova Requisição usa uniqueKey por escopo", async () => {
  const source = await readFile(
    new URL("../src/components/estoque/RequisicoesAlmoxarifadoTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`estoque-requisicao-create-/);
  assert.match(
    source,
    /estoque-requisicao-create-\$\{JSON\.stringify\(\[groupId, empresaAtual\?\.id \|\| null\]\)\}/,
  );
});

test("comportamental: dois cliques reusam; escopos distintos nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a1 = openWithUniqueKey(registry, 'estoque-requisicao-create-["g","e1"]', seq);
  const a2 = openWithUniqueKey(registry, 'estoque-requisicao-create-["g","e1"]', seq);
  const b = openWithUniqueKey(registry, 'estoque-requisicao-create-["g","e2"]', seq);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a1.id);
  assert.notEqual(b.id, a1.id);
});

test("comportamental: fechar libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'estoque-requisicao-create-["g","e"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em Requisicoes)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const tab = await readFile(
    new URL("../src/components/estoque/RequisicoesAlmoxarifadoTab.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(tab, /new WindowManager|createContext\(\s*['\"]Window/);
});
