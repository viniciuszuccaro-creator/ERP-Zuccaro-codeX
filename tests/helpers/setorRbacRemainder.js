import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { clienteLocalBatchRemainder } from './clienteLocalBatchRemainder.js';

const wiring = "    authorization: { guard: rbacGuard, moduleName: 'Cadastros', section: 'setor_atividade' },\n";

/** Peel only the Setor authorization wiring, retaining the entire prior app. */
export function setorRbacRemainder(file, text) {
  if (file === 'server/src/app.ts' && /mountSupplierSettlementHistoryRead|supplierSettlementHistoryEnabled/.test(text)) {
    const wire = [
      "import { mountSupplierSettlementHistoryRead } from './api/supplierSettlementHistoryRead.js';",
      '  supplierSettlementHistoryEnabled?: boolean;',
      "  if (!useMemory && config.erpEnv === 'hml' && config.authMode === 'supabase_user' && options.tenantContextEnabled === true && options.supplierSettlementHistoryEnabled === true) mountSupplierSettlementHistoryRead(app, db, rbacGuard);",
    ];
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    for (const line of wire) {
      const exact = eol + line + eol;
      assert.equal(text.split(exact).length, 2, 'exact opt-in supplier history wiring');
      text = text.replace(exact, eol);
    }
  }
  if (file === 'server/src/app.ts' && /mountPedidoFinanceiroRoutes|pedidoFinanceiroEnabled/.test(text)) {
    const wire = [
      "import { mountPedidoFinanceiroRoutes } from './api/pedidoFinanceiroRoutes.js';",
      '  pedidoFinanceiroEnabled?: boolean;',
      "  if (!useMemory && config.authMode === 'supabase_user' && options.tenantContextEnabled === true && options.pedidoFinanceiroEnabled === true) mountPedidoFinanceiroRoutes(app, db, rbacGuard);",
    ];
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    for (const line of wire) {
      const exact = eol + line + eol;
      assert.equal(text.split(exact).length, 2, 'exact opt-in financial wiring');
      text = text.replace(exact, eol);
    }
  }
  if (file === 'server/src/app.ts' && text.includes('mountLegacyClientReviewRead')) {
    const reviewed = [
      "import { mountLegacyClientReviewRead } from './api/legacyClientReviewRoute.js';",
      "  if (!useMemory && config.authMode === 'supabase_user' && options.tenantContextEnabled === true) mountLegacyClientReviewRead(app, db, rbacGuard);",
    ];
    for (const line of reviewed) {
      const match = new RegExp('^' + line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\r?\\n', 'gm');
      assert.equal([...text.matchAll(match)].length, 1, `${file}: exact authenticated review wiring`);
      text = text.replace(match, '');
    }
  }
  text = clienteLocalBatchRemainder(file, text);
  if (file !== 'server/src/app.ts' || !text.includes('authorization:')) return text;
  const source = text.replace(/\r\n/g, '\n');
  assert.equal(source.split(wiring).length, 2, 'exact Setor RBAC wiring count');
  const before = source.replace(wiring, '');
  assert.equal(createHash('sha256').update(before).digest('hex'),
    '02beb8fa89e094d2ba47af98550818caebb4b8488ce14498788aa4c0f37186ae',
    'entire app before Setor RBAC');
  return text.includes('\r\n') ? before.replace(/\n/g, '\r\n') : before;
}
