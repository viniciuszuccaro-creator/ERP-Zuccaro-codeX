import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Comercial.jsx: criar/editar Pedido usa uniqueKey estável", async () => {
  const source = await readFile(
    new URL("../src/pages/Comercial.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`comercial-pedido-create-\$\{scopeKey\}`/);
  assert.match(source, /uniqueKey:\s*pedidoId/);
  assert.match(source, /comercial-pedido-edit-\$\{pedidoId\}/);
  assert.match(source, /uniqueKey:\s*`comercial-validar-externos-/);
});

test("AcoesRapidasGlobal: cadastros rápidos usam uniqueKey por escopo", async () => {
  const source = await readFile(
    new URL("../src/components/AcoesRapidasGlobal.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uniqueKey:\s*`acoes-rapidas-pedido-create-\$\{scopeKey\}`/);
  assert.match(source, /uniqueKey:\s*`acoes-rapidas-cliente-create-\$\{scopeKey\}`/);
  assert.match(source, /uniqueKey:\s*`acoes-rapidas-produto-create-\$\{scopeKey\}`/);
  assert.match(source, /uniqueKey:\s*`acoes-rapidas-fornecedor-create-\$\{scopeKey\}`/);
  assert.match(source, /uniqueKey:\s*`acoes-rapidas-tabela-create-\$\{scopeKey\}`/);
  assert.match(source, /const scopeKey = JSON\.stringify\(\[/);
});
