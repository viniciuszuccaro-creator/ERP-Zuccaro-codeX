import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Producao page Nova OP usa uniqueKey por escopo", async () => {
  const source = await readFile(
    new URL("../src/pages/Producao.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`producao-op-create-/);
});

test("KanbanProducaoInteligente: create/view OP usa uniqueKey", async () => {
  const source = await readFile(
    new URL("../src/components/producao/KanbanProducaoInteligente.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`producao-op-create-kanban-/);
  assert.match(source, /producao-op-view-\$/);
});
