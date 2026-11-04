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

test("CentralIntegracoes e IntegrationConfigButtons usam uniqueKey por integracao+escopo", async () => {
  const central = await readFile(
    new URL("../src/components/integracoes/CentralIntegracoes.jsx", import.meta.url),
    "utf8",
  );
  const buttons = await readFile(
    new URL("../src/components/integracoes/IntegrationConfigButtons.jsx", import.meta.url),
    "utf8",
  );
  assert.match(central, /uniqueKey:\s*`integracoes-config-/);
  assert.match(buttons, /uniqueKey:\s*`integracoes-config-/);
  assert.match(central, /integracao\.key \|\| integracao\.nome/);
  assert.match(buttons, /cfg\.key \|\| integracao\.id/);
});

test("comportamental: mesma integracao+escopo reusa; distintas nao colidem", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const nfeA = openWithUniqueKey(registry, 'integracoes-config-integracao_nfe-["g","e1"]', seq);
  const nfeA2 = openWithUniqueKey(registry, 'integracoes-config-integracao_nfe-["g","e1"]', seq);
  const nfeB = openWithUniqueKey(registry, 'integracoes-config-integracao_nfe-["g","e2"]', seq);
  const boleto = openWithUniqueKey(registry, 'integracoes-config-integracao_boletos-["g","e1"]', seq);

  assert.equal(nfeA2.reused, true);
  assert.equal(nfeA2.id, nfeA.id);
  assert.notEqual(nfeB.id, nfeA.id);
  assert.notEqual(boleto.id, nfeA.id);
});

test("comportamental: fechar libera reabertura no mesmo escopo", () => {
  const registry = new Map();
  const seq = { nextId: 1 };
  const key = 'integracoes-config-integracao_whatsapp-["g","e"]';
  const first = openWithUniqueKey(registry, key, seq);
  closeWithUniqueKey(registry, key);
  const second = openWithUniqueKey(registry, key, seq);
  assert.equal(second.reused, false);
  assert.notEqual(second.id, first.id);
});

test("WindowManager canônico permanece o dono (sem segundo gerenciador em Integracoes)", async () => {
  const wm = await readFile(
    new URL("../src/components/lib/WindowManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(wm, /uniqueKeyRegistryRef/);
  for (const rel of [
    "../src/components/integracoes/CentralIntegracoes.jsx",
    "../src/components/integracoes/IntegrationConfigButtons.jsx",
  ]) {
    const src = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(src, /new WindowManager|createContext\(\s*['\"]Window/);
  }
});
