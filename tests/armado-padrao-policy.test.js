import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  calcularPeca,
  consolidarItensPorEtapa,
  gerarItensRevenda
} from '../src/components/comercial/armado-padrao/armadoPadraoPolicy.js';

test('calcula coluna preservando quantidade, estribos, peso e valor', () => {
  const peca = calcularPeca('coluna', {
    identificador: 'C1',
    quantidade: 2,
    comprimento: 3,
    quantidade_ferros_principais: 4,
    bitola_principal: '10mm',
    estribo_bitola: '5mm',
    estribo_largura: 15,
    estribo_altura: 25,
    distancia_estribo: 20
  });

  assert.equal(peca.quantidade_estribos, 30);
  assert.equal(peca.peso_total_kg, 48);
  assert.equal(peca.preco_venda_total, 408);
  assert.match(peca.descricao_automatica, /2 COLUNA/);
});

test('consolida somente pecas vinculadas a uma etapa', () => {
  const resumo = consolidarItensPorEtapa([
    { identificador: 'C1', etapa_obra_id: 'estrutura', etapa_obra_nome: 'Estrutura', peso_total_kg: 10, preco_venda_total: 85 },
    { identificador: 'V1', etapa_obra_id: 'estrutura', etapa_obra_nome: 'Estrutura', peso_total_kg: 5, preco_venda_total: 42.5 },
    { identificador: 'B1', peso_total_kg: 7, preco_venda_total: 59.5 }
  ]);

  assert.equal(resumo.length, 1);
  assert.equal(resumo[0].pecas.length, 2);
  assert.equal(resumo[0].peso_total_kg, 15);
  assert.equal(resumo[0].valor_total, 127.5);
});

test('gera item de revenda sem divisao por zero', () => {
  const [item] = gerarItensRevenda([{ identificador: 'B1', quantidade: 0, peso_total_kg: 17, preco_venda_total: 102 }]);

  assert.equal(item.codigo_sku, 'B1');
  assert.equal(item.preco_unitario, 102);
  assert.equal(item.peso_unitario, 17);
  assert.equal(item.origem_armado, true);
});

test('consulta de bitolas fecha sem empresa e preserva grupo no filtro', async () => {
  const source = await readFile(new URL('../src/components/comercial/ArmadoPadraoTab.jsx', import.meta.url), 'utf8');

  assert.match(source, /enabled: Boolean\(empresaId \|\| formData\?\.empresa_id\)/);
  assert.match(source, /if \(!empId\) return \[\]/);
  assert.match(source, /group_id: formData\.group_id/);
  assert.doesNotMatch(source, /: \{ eh_bitola: true, status: 'Ativo' \}/);
});
