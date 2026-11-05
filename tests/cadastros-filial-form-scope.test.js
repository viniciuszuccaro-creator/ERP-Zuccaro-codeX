import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("FilialForm lista empresas/matrizes via filterInContext no escopo", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/FilialForm.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /filterInContext\('Empresa'/);
  assert.match(src, /queryKey:\s*\['empresas',\s*contextKey\]/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.Empresa\.list\(/);
  assert.doesNotMatch(src, /data:\s*empresas\s*=\s*\[\]/);
  assert.match(src, /matrizesIndisponiveis/);
  assert.match(src, /Contagem de matrizes indisponível|≠ zero/);
});

test("FilialForm preserva reopen canônico e sky chrome", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/FilialForm.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /useCadastroReopenOnIdentity/);
  assert.match(src, /filialBoundId/);
  assert.match(src, /bg-sky-600/);
  assert.match(src, /ID técnico/);
});
