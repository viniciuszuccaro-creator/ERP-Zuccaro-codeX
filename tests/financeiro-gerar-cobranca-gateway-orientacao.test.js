/**
 * Recuperação funcional #397 — orientação de gateway em GerarCobrancaModal
 * (equivalente ao WizardGatewayPagamento da referência erp-integra-novo,
 * sem criar módulo paralelo: painel no modal existente).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GerarCobrancaModal: orientação de gateway sem Wizard paralelo', async () => {
  const src = await readFile(new URL('../src/components/financeiro/GerarCobrancaModal.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /WizardGatewayPagamento/);
  assert.match(src, /gateways-pagamento-cobranca/);
  assert.match(src, /filterInContext\("GatewayPagamento"/);
  assert.match(src, /data-action="cobranca-gateway-orientacao"/);
  assert.match(src, /data-action="cobranca-gateway-ok"/);
  assert.match(src, /from-sky-50/);
  assert.match(src, /Abrir Cadastros \(Gateways\)/);
});

test('GerarCobrancaModal: gateway cadastrado ≠ cobrança operacional (simulacao explícita)', async () => {
  const src = await readFile(new URL('../src/components/financeiro/GerarCobrancaModal.jsx', import.meta.url), 'utf8');
  assert.match(src, /geracaoOperacionalValidada = false/);
  assert.match(src, /data-action="cobranca-gateway-simulacao"/);
  assert.match(src, /permanece em <strong>simulacao<\/strong>/);
  assert.match(src, /status_cobranca: "gerada_simulada"/);
  // Banner verde "pronto" só com integração validada — não com cadastro sozinho.
  assert.match(src, /geracaoOperacionalValidada && \(/);
});

test('Cadastros logística/banco: chrome sky windowMode (entrada em uso)', async () => {
  for (const file of [
    'BancoForm.jsx',
    'MotoristaForm.jsx',
    'VeiculoForm.jsx',
    'TransportadoraForm.jsx',
  ]) {
    const src = await readFile(new URL(`../src/components/cadastros/${file}`, import.meta.url), 'utf8');
    assert.match(src, /from-sky-50/, `${file} sky header`);
    assert.match(src, /text-sky-600/, `${file} sky icon`);
  }
});

test('Cadastros config: sky chrome Evento/Modelo (Pacote3; Boletos permanece ID-only golden)', async () => {
  for (const file of [
    'EventoNotificacaoForm.jsx',
    'ModeloDocumentoForm.jsx',
  ]) {
    const src = await readFile(new URL(`../src/components/cadastros/${file}`, import.meta.url), 'utf8');
    assert.match(src, /from-sky-50/, `${file} sky header`);
  }
  const boletos = await readFile(new URL('../src/components/cadastros/ConfiguracaoBoletosForm.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(boletos, /from-sky-50/, 'ConfiguracaoBoletos fora do sky — coorte ID-only');
});
