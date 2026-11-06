import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const wiring = "    authorization: { guard: rbacGuard, moduleName: 'Cadastros', section: 'setor_atividade' },\n";

/** Peel only the Setor authorization wiring, retaining the entire prior app. */
export function setorRbacRemainder(file, text) {
  if (file !== 'server/src/app.ts' || !text.includes('authorization:')) return text;
  const source = text.replace(/\r\n/g, '\n');
  assert.equal(source.split(wiring).length, 2, 'exact Setor RBAC wiring count');
  const before = source.replace(wiring, '');
  assert.equal(createHash('sha256').update(before).digest('hex'),
    '02beb8fa89e094d2ba47af98550818caebb4b8488ce14498788aa4c0f37186ae',
    'entire app before Setor RBAC');
  return text.includes('\r\n') ? before.replace(/\n/g, '\r\n') : before;
}
