import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CentralAprovacoesLayout: Limite/Duplicatas sem stub 'em desenvolvimento'", async () => {
  const source = await readFile(
    new URL("../src/components/comercial/CentralAprovacoesLayout.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Funcionalidade em desenvolvimento/);
  assert.match(source, /data-action=\{limite \? "central-aprovacoes-limite"/);
  assert.match(source, /central-aprovacoes-duplicatas/);
  assert.match(source, /DESCONHECIDO/);
  assert.match(source, /status_aprovacao:\s*"pendente"/);
  assert.match(source, /status:\s*"Atrasado"/);
  assert.match(source, /filterInContext/);
  assert.match(source, /retry:\s*false/);
});

test("CentralAprovacoesManager: ainda monta AprovacoesPlaceholder (sem hash-break)", async () => {
  const source = await readFile(
    new URL("../src/components/comercial/CentralAprovacoesManager.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<AprovacoesPlaceholder tipo="limite" \/>/);
  assert.match(source, /<AprovacoesPlaceholder tipo="duplicatas" \/>/);
  assert.match(source, /from "\.\/CentralAprovacoesLayout"/);
});

test("browser-runtime pin do Manager intacto (Layout isolado)", async () => {
  const pin = await readFile(
    new URL("./browser-runtime-contracts.test.js", import.meta.url),
    "utf8",
  );
  assert.match(
    pin,
    /'src\/components\/comercial\/CentralAprovacoesManager\.jsx': '83ad4e3b0fe276e61e4ea4edf8eff7ae63c452d8c62b83f84701bd7bc6e2d62c'/,
  );
});
