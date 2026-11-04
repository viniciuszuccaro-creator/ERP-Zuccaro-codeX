import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMetricasAtendenteFromConversas,
  computeDiasConsecutivosAtendente,
} from "../src/components/chatbot/dashboardAtendenteKpiPolicy.js";

test("DashboardAtendente: usa policy e não fabrica dias=5", async () => {
  const source = await readFile(
    new URL("../src/components/chatbot/DashboardAtendente.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /diasConsecutivos\s*=\s*5/);
  assert.doesNotMatch(source, /TODO:\s*calcular real/);
  assert.match(source, /buildMetricasAtendenteFromConversas/);
  assert.match(source, /dashboardAtendenteKpiPolicy/);
  assert.match(source, /DESCONHECIDO/);
});

test("computeDiasConsecutivosAtendente: streak real a partir de datas", () => {
  const today = new Date("2026-11-04T15:00:00-03:00");
  const d0 = "2026-11-04T10:00:00-03:00";
  const d1 = "2026-11-03T10:00:00-03:00";
  const d2 = "2026-11-02T10:00:00-03:00";
  assert.equal(
    computeDiasConsecutivosAtendente(
      [
        { data_ultima_mensagem: d0 },
        { data_ultima_mensagem: d1 },
        { data_ultima_mensagem: d2 },
      ],
      today,
    ),
    3,
  );
  assert.equal(computeDiasConsecutivosAtendente([], today), 0);
  assert.equal(
    computeDiasConsecutivosAtendente([{ data_ultima_mensagem: d1 }], today),
    0,
  );
});

test("buildMetricasAtendenteFromConversas: sem amostra → null (não 0)", () => {
  const agora = new Date("2026-11-04T15:00:00-03:00");
  const empty = buildMetricasAtendenteFromConversas([], { agora });
  assert.equal(empty.tempoMedioResposta, null);
  assert.equal(empty.csat, null);
  assert.equal(empty.taxaResolucao, null);
  assert.equal(empty.conversasHoje, 0);
  assert.equal(empty.diasConsecutivos, 0);

  const withSamples = buildMetricasAtendenteFromConversas(
    [
      {
        data_ultima_mensagem: "2026-11-04T10:00:00-03:00",
        status: "Resolvida",
        tempo_primeira_resposta_minutos: 4,
        score_satisfacao: 5,
      },
    ],
    { agora },
  );
  assert.equal(withSamples.tempoMedioResposta, 4);
  assert.equal(withSamples.csat, 5);
  assert.equal(withSamples.taxaResolucao, 100);
  assert.equal(withSamples.diasConsecutivos, 1);
});
