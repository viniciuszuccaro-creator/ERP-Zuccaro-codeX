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

test("BotoesImportacaoProduto usa uniqueKey por Grupo/Empresa", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/BotoesImportacaoProduto.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /uniqueKey:\s*`cadastros-importacao-produto-nfe-/);
  assert.match(src, /groupId \|\| null, empresaId \|\| null/);
});

test("comportamental: mesmo escopo reusa; empresas distintas nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const a = openWithUniqueKey(registry, 'cadastros-importacao-produto-nfe-["g","e1"]', seq);
  const a2 = openWithUniqueKey(registry, 'cadastros-importacao-produto-nfe-["g","e1"]', seq);
  const b = openWithUniqueKey(registry, 'cadastros-importacao-produto-nfe-["g","e2"]', seq);
  assert.equal(a2.reused, true);
  assert.equal(a2.id, a.id);
  assert.notEqual(b.id, a.id);
});

test("comportamental: fechar libera reabertura", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'cadastros-importacao-produto-nfe-["g","e"]';
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
    new URL("../src/components/cadastros/BotoesImportacaoProduto.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
