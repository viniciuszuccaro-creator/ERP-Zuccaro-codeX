import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("OrdensCompraTab: openWindow create/view/receber/avaliar usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/compras/OrdensCompraTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`compras-oc-create-/);
  assert.match(source, /compras-oc-view-\$/);
  assert.match(source, /compras-oc-receber-\$/);
  assert.match(source, /compras-oc-avaliar-\$/);
});

test("Compras page Nova OC usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/pages/Compras.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`compras-oc-create-page-/);
});

test("CotacoesTab / MovimentacoesTab / RecebimentoTab / SolicitacoesTab: create uniqueKey", async () => {
  const cot = await readFile(
    new URL("../src/components/compras/CotacoesTab.jsx", import.meta.url),
    "utf8",
  );
  const mov = await readFile(
    new URL("../src/components/estoque/MovimentacoesTab.jsx", import.meta.url),
    "utf8",
  );
  const receb = await readFile(
    new URL("../src/components/estoque/RecebimentoTab.jsx", import.meta.url),
    "utf8",
  );
  const sol = await readFile(
    new URL("../src/components/estoque/SolicitacoesTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(cot, /uniqueKey:\s*`compras-cotacao-create-/);
  assert.match(mov, /uniqueKey:\s*`estoque-mov-create-/);
  assert.match(receb, /uniqueKey:\s*`estoque-receb-create-/);
  assert.match(sol, /uniqueKey:\s*`estoque-solicitacao-create-/);
});
