import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeCadastroSearch,
  matchesCadastroSearch,
  matchCadastrosCatalog,
  handleCadastroTileKeyDown,
} from "../src/components/cadastros/cadastrosSearchFilter.js";

test("normalizeCadastroSearch e matchesCadastroSearch ignoram acentos, caixa e múltiplos espaços", () => {
  assert.equal(normalizeCadastroSearch("  Regiões   de Atendimento  "), "regioes de atendimento");
  assert.equal(matchesCadastroSearch("servicos", "Servico", "Serviços"), true);
  assert.equal(matchesCadastroSearch("veiculos", "Veiculo", "Veículos"), true);
  assert.equal(matchesCadastroSearch("condicoes comerciais", "CondicaoComercial", "Condições Comerciais"), true);
  assert.equal(matchesCadastroSearch("configuracoes nfe", "ConfiguracaoNFe", "Configurações NF-e"), true);
  assert.equal(matchesCadastroSearch("inexistente-xyz", "Cliente", "Clientes"), false);
});

test("matchCadastrosCatalog identifica blocos e total de correspondências sem rede", () => {
  const empty = matchCadastrosCatalog("");
  assert.equal(empty.active, false);
  assert.deepEqual(empty.matchingBlocks, []);

  const clientes = matchCadastrosCatalog("cliente");
  assert.equal(clientes.active, true);
  assert.ok(clientes.matchingBlocks.includes("bloco1"));
  assert.ok(clientes.matchCount >= 2); // Clientes + Segmentos de Cliente

  const nfe = matchCadastrosCatalog("sefaz");
  assert.equal(nfe.active, true);
  assert.deepEqual(nfe.matchingBlocks, ["bloco6"]);
  assert.equal(nfe.matchCount, 1);

  const none = matchCadastrosCatalog("termo-que-nao-existe-999");
  assert.equal(none.active, true);
  assert.deepEqual(none.matchingBlocks, []);
  assert.equal(none.matchCount, 0);
});

test("handleCadastroTileKeyDown aciona Enter/Space e navega entre cards com setas/Home/End", () => {
  let opened = 0;
  let prevented = false;
  handleCadastroTileKeyDown(
    { key: "Enter", preventDefault: () => { prevented = true; } },
    () => { opened += 1; },
  );
  assert.equal(opened, 1);
  assert.equal(prevented, true);

  let focusedIndex = -1;
  const tiles = [0, 1, 2].map((idx) => ({
    focus: () => { focusedIndex = idx; },
  }));
  const fakeContainer = {
    querySelectorAll: () => tiles,
  };
  tiles.forEach((tile) => {
    tile.closest = () => fakeContainer;
  });

  handleCadastroTileKeyDown({ key: "ArrowRight", currentTarget: tiles[0], preventDefault: () => {} });
  assert.equal(focusedIndex, 1);

  handleCadastroTileKeyDown({ key: "ArrowLeft", currentTarget: tiles[0], preventDefault: () => {} });
  assert.equal(focusedIndex, 2);

  handleCadastroTileKeyDown({ key: "Home", currentTarget: tiles[2], preventDefault: () => {} });
  assert.equal(focusedIndex, 0);

  handleCadastroTileKeyDown({ key: "End", currentTarget: tiles[0], preventDefault: () => {} });
  assert.equal(focusedIndex, 2);
});

test("ColaboradorForm reutiliza CadastroEntitySelect com IDs oficiais (cargo_id, departamento_id, turno_id)", () => {
  const src = readFileSync("src/components/rh/ColaboradorForm.jsx", "utf8");
  assert.match(src, /import CadastroEntitySelect from "@\/components\/cadastros\/CadastroEntitySelect"/);
  assert.match(src, /entityName="Cargo"/);
  assert.match(src, /cargo_id/);
  assert.match(src, /entityName="Departamento"/);
  assert.match(src, /departamento_id/);
  assert.match(src, /entityName="Turno"/);
  assert.match(src, /turno_id/);
});
