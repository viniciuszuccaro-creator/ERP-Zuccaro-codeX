import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("StatusOrigemPedido100 lista ParametroOrigemPedido e Pedido via filterInContext", async () => {
  const src = await readFile(
    new URL("../src/components/sistema/StatusOrigemPedido100.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /queryKey:\s*\['parametros-origem-pedido',\s*contextKey\]/);
  assert.match(src, /queryKey:\s*\['pedidos-validacao',\s*contextKey\]/);
  assert.doesNotMatch(src, /base44\.entities\.(ParametroOrigemPedido|Pedido)\.list\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.match(src, /Contagens indisponíveis não são zero|Contagens não são zero/);
  assert.match(src, /contagemIndisponivel/);
  assert.doesNotMatch(src, /100% Completo e Certificado/);
});

test("completude percentual fica nula quando contagem indisponível", async () => {
  const src = await readFile(
    new URL("../src/components/sistema/StatusOrigemPedido100.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /percentualCompleto = contagemIndisponivel\s*\n?\s*\? null/);
  assert.match(src, /status: contagemIndisponivel \? null/);
});
