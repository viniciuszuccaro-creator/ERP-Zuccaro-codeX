import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PontoTab: Registrar Ponto usa uniqueKey singleton", async () => {
  const source = await readFile(
    new URL("../src/components/rh/PontoTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*['"]rh-ponto-create['"]/);
});
