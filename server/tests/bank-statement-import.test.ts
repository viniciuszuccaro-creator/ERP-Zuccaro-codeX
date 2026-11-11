import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankStatement, reconcileStatementStage, type CsvBankMapping } from '../src/services/bankStatementImport.ts';

const ofx = (id = '000FIT', amount = '-12.30', posted = '20261015120000[-3:BRT]') => Buffer.from(`OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:NONE
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX><BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>001<BRANCHID>0001<ACCTID>000007<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST><DTSTART>20261001<DTEND>20261031<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${posted}<TRNAMT>${amount}<FITID>${id}<MEMO>SYNTHETIC</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);
const mapping: CsvBankMapping = { delimiter: ';', decimal: ',', columns: { bankId: 'bank', accountId: 'account', branchId: 'branch', currency: 'currency', sourceId: 'id', posted: 'day', amount: 'amount' } };
const csv = (rows: string) => Buffer.from(`bank;account;branch;currency;id;day;amount;memo\n${rows}`);
const row = '001;000007;0001;BRL;000FIT;2026-10-15;-12,30;"quoted;memo"';

test('OFX actual parser preserves bank/FITID zeros, signed exact cents and raw offset', () => {
  const result = parseBankStatement(ofx(), 'ofx');
  assert.deepEqual(result.account, { bankId: '001', accountId: '000007', branchId: '0001', currency: 'BRL' });
  assert.equal(result.transactions[0].sourceId, '000FIT');
  assert.equal(result.transactions[0].postedRaw, '20261015120000[-3:BRT]');
  assert.equal(result.transactions[0].amountRaw, '-12.30');
  assert.equal(result.totalMinor, '-1230');
  assert.equal(result.kind, 'bank_statement');
});

test('CSV uses explicit mapping, quoting and no automatic identity coercion', () => {
  const result = parseBankStatement(csv(row), 'csv', mapping);
  assert.equal(result.transactions[0].original.memo, 'quoted;memo');
  assert.equal(result.account.accountId, '000007');
  assert.equal(result.totalMinor, '-1230');
  assert.equal(result.transactions[0].original.amount, '-12,30');
});

test('replay, conflict and cross-account are distinguished without any write', () => {
  const original = parseBankStatement(ofx(), 'ofx');
  const stored = new Map([[original.transactions[0].identityHash, original.transactions[0].contentHash]]);
  assert.equal(reconcileStatementStage(original, original.account, stored)[0].disposition, 'REPLAY');
  const changed = parseBankStatement(ofx('000FIT', '-12.31'), 'ofx');
  assert.equal(reconcileStatementStage(changed, original.account, stored)[0].disposition, 'CONFLICT');
  assert.equal(reconcileStatementStage(parseBankStatement(ofx('OTHER'), 'ofx'), original.account, stored)[0].disposition, 'NEW');
  assert.throws(() => reconcileStatementStage(original, { ...original.account, accountId: '7' }, stored), /Bank account mismatch/);
  assert.equal(stored.size, 1);
});

test('zero and amounts exceeding JS exact integer range stay decimal strings', () => {
  assert.equal(parseBankStatement(ofx('ZERO', '0.00'), 'ofx').totalMinor, '0');
  assert.equal(parseBankStatement(ofx('BIG', '9007199254740991.99'), 'ofx').totalMinor, '900719925474099199');
});

test('reject ambiguous money, invalid calendar/time, missing identity and unsafe XML without raw errors', () => {
  for (const input of [ofx('', '1'), ofx('ID', '1e3'), ofx('ID', '1,000.00'), ofx('ID', '1.001'),
    ofx('ID', '1', '20260230'), ofx('ID', '1', '20261015250000'), Buffer.from('<!DOCTYPE OFX SYSTEM "file:///secret"><OFX/>'),
    Buffer.from([0xff, 0xfe]), Buffer.alloc(2_000_001)]) {
    assert.throws(() => parseBankStatement(input, 'ofx'), error => error instanceof Error && !error.message.includes('secret'));
  }
});

test('duplicate bank IDs, mixed accounts, missing columns and unknown CSV formats fail closed', () => {
  assert.throws(() => parseBankStatement(csv(`${row}\n${row}`), 'csv', mapping), /Repeated bank transaction identifier/);
  for (const input of [csv(`${row}\n${row.replace('000007', '000008').replace('000FIT', 'OTHER')}`),
    csv(row.replace('2026-10-15', '15/10/2026')), Buffer.from('id;amount\nA;1')]) {
    assert.throws(() => parseBankStatement(input, 'csv', mapping));
  }
  assert.throws(() => parseBankStatement(csv(row), 'csv'));
});

test('corrections require a separate business policy, never silently become ordinary new entries', () => {
  const corrected = ofx().toString().replace('<MEMO>', '<CORRECTFITID>OLD<CORRECTACTION>REPLACE<MEMO>');
  assert.throws(() => parseBankStatement(Buffer.from(corrected), 'ofx'));
});

test('changing explicit CSV amount mapping is a conflict, not replay of the same original row', () => {
  const bytes = Buffer.from('bank;account;branch;currency;id;day;amount;other\n001;000007;0001;BRL;FIT;2026-10-15;1,00;2,00');
  const first = parseBankStatement(bytes, 'csv', mapping);
  const changed = parseBankStatement(bytes, 'csv', { ...mapping, columns: { ...mapping.columns, amount: 'other' } });
  assert.equal(first.transactions[0].identityHash, changed.transactions[0].identityHash);
  assert.notEqual(first.transactions[0].amountMinor, changed.transactions[0].amountMinor);
  assert.equal(reconcileStatementStage(changed, first.account,
    new Map([[first.transactions[0].identityHash, first.transactions[0].contentHash]]))[0].disposition, 'CONFLICT');
});
