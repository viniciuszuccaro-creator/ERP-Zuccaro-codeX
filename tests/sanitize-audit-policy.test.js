import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('operational audit call sites no longer swallow AuditLog failures', async () => {
  const sanitizer = await readFile(new URL('../src/components/lib/sanitizeOnWrite.jsx', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../src/components/lib/uiAudit.jsx', import.meta.url), 'utf8');
  const local = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const caixa = await readFile(new URL('../src/components/financeiro/CaixaCentralLiquidacao.jsx', import.meta.url), 'utf8');
  const cobranca = await readFile(new URL('../src/components/financeiro/GerarCobrancaModal.jsx', import.meta.url), 'utf8');
  const link = await readFile(new URL('../src/components/financeiro/GeradorLinkPagamento.jsx', import.meta.url), 'utf8');
  const liquidar = await readFile(new URL('../src/components/financeiro/caixa-central/LiquidarReceberPagar.jsx', import.meta.url), 'utf8');
  const seguranca = await readFile(new URL('../src/components/sistema/ConfiguracaoSeguranca.jsx', import.meta.url), 'utf8');
  const pedido = await readFile(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  const events = await readFile(new URL('../base44/functions/auditEntityEvents/entry.ts', import.meta.url), 'utf8');

  assert.match(sanitizer, /SENSITIVE_AUDIT_KEY/);
  assert.match(sanitizer, /protegido: true/);
  assert.match(sanitizer, /linha_digitavel/);
  assert.match(ui, /persistOperationalAudit/);
  assert.match(ui, /Falha ao persistir auditoria operacional/);
  assert.match(local, /sanitizeAuditPayload\(before\)/);
  assert.match(local, /correlacao_id/);
  assert.match(caixa, /persistOperationalAudit/);
  assert.match(cobranca, /persistOperationalAudit/);
  assert.match(link, /persistOperationalAudit/);
  assert.match(liquidar, /persistOperationalAudit/);
  assert.match(seguranca, /persistOperationalAudit/);
  assert.doesNotMatch(caixa, /catch \{\}/);
  assert.doesNotMatch(cobranca, /catch \{\}/);
  assert.doesNotMatch(link, /catch \{\}/);
  assert.doesNotMatch(liquidar, /catch \{\}/);
  assert.doesNotMatch(seguranca, /catch \{\}/);
  assert.match(pedido, /Nao foi possivel validar credito/);
  assert.match(events, /protegido: true/);
  assert.match(events, /Falha ao registrar auditoria/);
});
