import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("EntregasListagem: openWindow view/edit/separacao/reversa usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/expedicao/EntregasListagem.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /expedicao-entrega-view-\$/);
  assert.match(source, /expedicao-entrega-edit-\$/);
  assert.match(source, /expedicao-entrega-separacao-\$/);
  assert.match(source, /expedicao-entrega-reversa-\$/);
  assert.equal((source.match(/uniqueKey:/g) || []).length >= 5, true);
});
