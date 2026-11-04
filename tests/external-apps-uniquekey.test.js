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

test("ExternalAppsHub: apps usam uniqueKey por escopo Grupo/Empresa", async () => {
  const source = await readFile(
    new URL("../src/components/administracao-sistema/ExternalAppsHub.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /external-apps-portal-cliente-/);
  assert.match(source, /external-apps-motorista-/);
  assert.match(source, /external-apps-chatbot-dashboard-/);
  assert.match(source, /external-apps-apontamento-producao-/);
  assert.match(source, /external-apps-apontamento-mobile-/);
  assert.match(source, /external-apps-chat-cliente-/);
  assert.match(source, /external-apps-orcamento-site-/);
  assert.match(source, /scopeKey\s*=\s*JSON\.stringify\(\[groupId, empresaId\]\)/);
  assert.match(source, /uniqueKey:\s*options\?\.uniqueKey\s*\|\|/);
});

test("comportamental: clique repetido reusa; apps e escopos distintos nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const portalA = openWithUniqueKey(registry, 'external-apps-portal-cliente-["g","e1"]', seq);
  const portalA2 = openWithUniqueKey(registry, 'external-apps-portal-cliente-["g","e1"]', seq);
  const portalB = openWithUniqueKey(registry, 'external-apps-portal-cliente-["g","e2"]', seq);
  const motorista = openWithUniqueKey(registry, 'external-apps-motorista-["g","e1"]', seq);

  assert.equal(portalA2.reused, true);
  assert.equal(portalA2.id, portalA.id);
  assert.notEqual(portalB.id, portalA.id);
  assert.notEqual(motorista.id, portalA.id);
});

test("comportamental: fechar libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'external-apps-chatbot-dashboard-["g","e"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em ExternalAppsHub)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  const src = await readFile(
    new URL("../src/components/administracao-sistema/ExternalAppsHub.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
});
