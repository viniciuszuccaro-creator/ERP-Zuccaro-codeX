import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CADASTROS_BLOCO_CATALOG,
  normalizeCadastroSearch,
  matchesCadastroSearch,
  matchesCadastroEntitySearch,
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

test("matchesCadastroEntitySearch usa keywords do catálogo para manter paridade total com matchCadastrosCatalog", () => {
  assert.equal(matchesCadastroEntitySearch("cpf", "Cliente", "Clientes"), true);
  assert.equal(matchesCadastroEntitySearch("pix", "FormaPagamento", "Formas de Pagamento"), true);
  assert.equal(matchesCadastroEntitySearch("sefaz", "ConfiguracaoNFe", "Configurações NF-e"), true);
  assert.equal(matchesCadastroEntitySearch("cfop", "TabelaFiscal", "Tabelas Fiscais"), true);
  assert.equal(matchesCadastroEntitySearch("cpf", "Banco", "Bancos"), false);

  for (const items of Object.values(CADASTROS_BLOCO_CATALOG)) {
    for (const item of items) {
      const firstKeyword = String(item.keywords || "").split(/\s+/).filter(Boolean)[0];
      if (!firstKeyword) continue;
      assert.equal(
        matchesCadastroEntitySearch(firstKeyword, item.key, item.label),
        true,
        `Keyword '${firstKeyword}' deveria casar com o tile '${item.key}'`,
      );
    }
  }

  for (const blocoFile of [
    "src/components/cadastros/blocks/Bloco1Pessoas.jsx",
    "src/components/cadastros/blocks/Bloco2Produtos.jsx",
    "src/components/cadastros/blocks/Bloco3Financeiro.jsx",
    "src/components/cadastros/blocks/Bloco4Logistica.jsx",
    "src/components/cadastros/blocks/Bloco5Organizacional.jsx",
    "src/components/cadastros/blocks/Bloco6Tecnologia.jsx",
  ]) {
    const src = readFileSync(blocoFile, "utf8");
    assert.match(src, /matchesCadastroEntitySearch/, `${blocoFile} deve filtrar tiles usando matchesCadastroEntitySearch`);
  }
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
