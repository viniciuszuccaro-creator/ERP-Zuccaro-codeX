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

test("AcoesRapidasGlobal: creates usam uniqueKey por escopo (sem unir entidades distintas)", async () => {
  const source = await readFile(
    new URL("../src/components/AcoesRapidasGlobal.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /acoes-rapidas-pedido-create-/);
  assert.match(source, /acoes-rapidas-cliente-create-/);
  assert.match(source, /acoes-rapidas-produto-create-/);
  assert.match(source, /acoes-rapidas-fornecedor-create-/);
  assert.match(source, /acoes-rapidas-tabela-preco-create-/);
  assert.match(source, /financeiro-cr-create-/);
  assert.match(source, /financeiro-cp-create-/);
  assert.match(source, /uniqueKey:\s*['"]crm-oportunidade-nova['"]/);
  assert.match(source, /acoes-rapidas-evento-create-/);
  assert.match(source, /createScopeKey\s*=\s*JSON\.stringify\(\[groupId, empresaId, user\?\.id \|\| null\]\)/);
});

test("comportamental: clique repetido reusa; entidades e escopos distintos nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const scopeA = 'acoes-rapidas-pedido-create-["g","e1","u1"]';
  const scopeB = 'acoes-rapidas-pedido-create-["g","e2","u1"]';
  const a1 = openWithUniqueKey(registry, scopeA, seq);
  const a2 = openWithUniqueKey(registry, scopeA, seq);
  const b = openWithUniqueKey(registry, scopeB, seq);
  const cliente = openWithUniqueKey(registry, 'acoes-rapidas-cliente-create-["g","e1","u1"]', seq);
  const cr = openWithUniqueKey(registry, 'financeiro-cr-create-["g","e1","u1"]', seq);
  const opp = openWithUniqueKey(registry, "crm-oportunidade-nova", seq);
  const opp2 = openWithUniqueKey(registry, "crm-oportunidade-nova", seq);

  assert.equal(a2.reused, true);
  assert.equal(a2.id, a1.id);
  assert.notEqual(b.id, a1.id);
  assert.notEqual(cliente.id, a1.id);
  assert.notEqual(cr.id, a1.id);
  assert.equal(opp2.reused, true);
  assert.equal(opp2.id, opp.id);
});

test("comportamental: fechar libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'acoes-rapidas-evento-create-["g","e","u"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em AcoesRapidas)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const src = await readFile(
    new URL("../src/components/AcoesRapidasGlobal.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
