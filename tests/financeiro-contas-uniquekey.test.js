import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ContasReceberTab: openWindow create/edit/view usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/financeiro/ContasReceberTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`financeiro-cr-create-/);
  assert.match(source, /financeiro-cr-\$\{editar \? 'edit' : 'view'\}/);
});

test("ContasPagarTab: openWindow create/edit usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/financeiro/ContasPagarTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`financeiro-cp-create-/);
  assert.match(source, /financeiro-cp-edit-\$/);
});
