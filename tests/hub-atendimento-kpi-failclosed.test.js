import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("HubAtendimento: não fabrica tempo médio 2.5 nem resolução bot 78", async () => {
  const source = await readFile(
    new URL("../src/pages/HubAtendimento.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /tempoMedioResposta:\s*2\.5/);
  assert.doesNotMatch(source, /taxaResolucaoBot:\s*78/);
  assert.match(source, /tempoMedioResposta:\s*null/);
  assert.match(source, /taxaResolucaoBot:\s*null/);
  assert.match(source, /DESCONHECIDO/);
  assert.match(source, /data-action="hub-kpi-desconhecido"/);
  assert.match(source, /botSla\.sla_total \?/);
  assert.doesNotMatch(
    source,
    /botSla\.sla_total \? Math\.round\(100\*\(botSla\.sla_ok\/\(botSla\.sla_total\|\|1\)\)\) : 0/,
  );
});
