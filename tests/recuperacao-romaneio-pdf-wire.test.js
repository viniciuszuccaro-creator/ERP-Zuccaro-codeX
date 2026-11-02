/**
 * Recuperação Expedição: RomaneioImpressao "Baixar PDF" → gerarPDFRomaneio existente.
 * Classificação: funcionalidade recuperada (botão stub → helper canônico).
 * Não altera exportacaoPDF (pin consumer-window).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('RomaneioImpressao: Baixar PDF usa gerarPDFRomaneio (sem alert stub)', () => {
  const src = read('src/components/expedicao/RomaneioImpressao.jsx');
  assert.match(src, /from ["']@\/components\/lib\/exportacaoPDF["']/);
  assert.match(src, /gerarPDFRomaneio\(/);
  assert.doesNotMatch(src, /Funcionalidade de PDF em desenvolvimento/);
  assert.doesNotMatch(src, /TODO:\s*Integrar com gerador de PDF/);
  assert.match(src, /window\.print\(/); // Imprimir preservado
});

test('exportacaoPDF já expõe gerarPDFRomaneio (helper canônico reutilizado)', () => {
  const src = read('src/components/lib/exportacaoPDF.jsx');
  assert.match(src, /export function gerarPDFRomaneio\s*\(/);
  assert.match(src, /ROMANEIO DE ENTREGA/);
});
