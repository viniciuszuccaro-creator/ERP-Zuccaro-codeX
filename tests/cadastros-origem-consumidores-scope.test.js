import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSrc(rel) {
  return readFile(new URL(`../${rel}`, import.meta.url), "utf8");
}

test("useOrigemPedido lista ParametroOrigemPedido via filterInContext + contextKey", async () => {
  const src = await readSrc("src/components/lib/useOrigemPedido.jsx");
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.match(src, /queryKey:\s*\['parametros-origem-pedido',\s*contextKey\]/);
  assert.doesNotMatch(src, /base44\.entities\.ParametroOrigemPedido\.(list|filter)\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
  assert.match(src, /enabled:\s*contextoValido/);
});

test("useParametroOrigem também é escopado", async () => {
  const src = await readSrc("src/components/lib/useOrigemPedido.jsx");
  assert.match(src, /export function useParametroOrigem/);
  assert.match(src, /queryKey:\s*\['parametros-origem-pedido',\s*contextKey,\s*canal\]/);
});

test("BadgeOrigemPedido reutiliza useOrigemPedido (sem list unscoped)", async () => {
  const src = await readSrc("src/components/comercial/BadgeOrigemPedido.jsx");
  assert.match(src, /useOrigemPedido/);
  assert.doesNotMatch(src, /base44\.entities\.ParametroOrigemPedido\.list\(/);
  assert.doesNotMatch(src, /initialData:\s*\[\]/);
});

test("MonitoramentoCanaisRealtime escopa Pedido e ParametroOrigemPedido", async () => {
  const src = await readSrc("src/components/comercial/MonitoramentoCanaisRealtime.jsx");
  assert.match(src, /filterInContext\(\s*'Pedido'/);
  assert.match(src, /filterInContext\('ParametroOrigemPedido'/);
  assert.match(src, /Contagens indisponíveis não são zero|Contagens não são zero/);
  assert.doesNotMatch(src, /base44\.entities\.(Pedido|ParametroOrigemPedido)\.(list|filter)\(/);
});

test("WizardEtapa1Cliente consome hook canônico (sem list unscoped)", async () => {
  const src = await readSrc("src/components/comercial/wizard/WizardEtapa1Cliente.jsx");
  assert.match(src, /useOrigemPedido/);
  assert.match(src, /origemContagemIndisponivel/);
  assert.doesNotMatch(src, /base44\.entities\.ParametroOrigemPedido\.list\(/);
});
