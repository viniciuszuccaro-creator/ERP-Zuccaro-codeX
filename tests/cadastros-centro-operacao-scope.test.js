import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CentroOperacaoForm lista Colaborador via filterInContext", async () => {
  const src = await readFile(
    new URL("../src/components/cadastros/CentroOperacaoForm.jsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /filterInContext\('Colaborador'/);
  assert.match(src, /queryKey:\s*\['colaboradores-centro-operacao',\s*contextKey\]/);
  assert.doesNotMatch(src, /base44\.entities\.Colaborador\.list\(/);
  assert.doesNotMatch(src, /data:\s*colaboradores\s*=\s*\[\]/);
  assert.match(src, /colaboradoresIndisponiveis/);
  assert.match(src, /Contagem de colaboradores indisponível|≠ zero/);
});
