import { createHash } from 'node:crypto';
import { parseStrict as parseOfx } from 'ofx-js';
import { parse as parseCsv } from 'csv-parse/sync';
import { z } from 'zod';
import { AppError } from '../api/errors.js';

const text = z.string().min(1).max(500);
export const bankAccountIdentitySchema = z.object({ bankId: text, accountId: text, branchId: text.optional(), currency: z.literal('BRL') }).strict();
const accountSchema = bankAccountIdentitySchema;
export type BankAccountIdentity = z.infer<typeof accountSchema>;
export type StatementTransaction = {
  sourceId: string; postedRaw: string; amountRaw: string; amountMinor: string;
  identityHash: string; contentHash: string; original: Record<string, unknown>;
};
export type BankStatement = {
  sourceSha256: string; account: BankAccountIdentity; transactions: StatementTransaction[];
  totalMinor: string; kind: 'bank_statement';
};
export type CsvBankMapping = {
  delimiter: ',' | ';'; decimal: '.' | ',';
  columns: { bankId: string; accountId: string; branchId?: string; currency: string; sourceId: string; posted: string; amount: string };
};
const MAX_ROWS = 10000;
function invalid(): never { throw new AppError(422, 'BANK_STATEMENT_INVALID', 'Invalid bank statement or mapping'); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function digest(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function bankStatementAccountHash(account: BankAccountIdentity) { return digest(accountSchema.parse(account)); }
export function bankStatementIdentityHash(account: BankAccountIdentity, sourceId: string) { return digest([accountSchema.parse(account), text.parse(sourceId)]); }
export function bankStatementContentHash(row: Pick<StatementTransaction, 'sourceId' | 'postedRaw' | 'amountRaw' | 'amountMinor' | 'original'>) {
  return digest({ sourceId: row.sourceId, postedRaw: row.postedRaw, amountRaw: row.amountRaw, amountMinor: row.amountMinor, original: row.original });
}
export function bankStatementStageSignature(statement: Pick<BankStatement,'sourceSha256'|'account'|'transactions'>) {
  return digest({ contract: 2, sourceSha256: statement.sourceSha256, account: statement.account,
    transactions: statement.transactions.map(row => [row.identityHash, row.contentHash]) });
}
function money(raw: string, decimal: '.' | ','): string {
  const pattern = decimal === '.' ? /^-?\d{1,16}(?:\.\d{1,2})?$/ : /^-?\d{1,16}(?:,\d{1,2})?$/;
  if (!pattern.test(raw)) return invalid();
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^-/, '').split(decimal);
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return (negative ? -minor : minor).toString();
}
function date(raw: string, ofx: boolean) {
  const match = ofx ? /^(\d{4})(\d{2})(\d{2})(?:\d{6}(?:\.\d+)?(?:\[-?\d+(?:\.\d+)?:[^\]]+\])?)?$/.exec(raw)
    : /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return invalid();
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return invalid();
  // Preserve the original bank date/time/offset; never infer an ERP posting date.
  if (ofx && raw.length > 8 && (Number(raw.slice(8, 10)) > 23 || Number(raw.slice(10, 12)) > 59 || Number(raw.slice(12, 14)) > 59)) return invalid();
  return raw;
}
function transaction(account: BankAccountIdentity, id: string, posted: string, amount: string, original: Record<string, unknown>, decimal: '.' | ',', ofx: boolean): StatementTransaction {
  text.parse(id);
  const postedRaw = date(posted, ofx), amountMinor = money(amount, decimal);
  return { sourceId: id, postedRaw, amountRaw: amount, amountMinor,
    identityHash: bankStatementIdentityHash(account, id), contentHash: bankStatementContentHash({ sourceId: id, postedRaw, amountRaw: amount, amountMinor, original }),
    original: structuredClone(original) };
}
const ofxTransaction = z.object({ FITID: text, DTPOSTED: text, TRNAMT: text,
  CORRECTFITID: z.never().optional(), CORRECTACTION: z.never().optional() }).passthrough();
const ofxStatement = z.object({ CURDEF: z.string(), BANKACCTFROM: z.object({ BANKID: text, ACCTID: text, BRANCHID: text.optional() }),
  BANKTRANLIST: z.object({ STMTTRN: z.union([ofxTransaction, z.array(ofxTransaction).max(MAX_ROWS)]) }) });

/** Bounded staging parser only. It cannot create titles, payments, balances or reconciliation links. */
export function parseBankStatement(bytes: Buffer, format: 'ofx' | 'csv', mapping?: CsvBankMapping): BankStatement {
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 2_000_000) return invalid();
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (source.includes('\0') || /<!DOCTYPE|<!ENTITY/i.test(source)) return invalid();
    let account: BankAccountIdentity;
    let transactions: StatementTransaction[];
    if (format === 'ofx') {
      const parsed = parseOfx(source);
      const response = parsed.OFX.BANKMSGSRSV1?.STMTTRNRS;
      if (!response || Array.isArray(response) || String(response.STATUS?.CODE) !== '0') return invalid();
      const statement = ofxStatement.parse(response.STMTRS);
      account = accountSchema.parse({ bankId: statement.BANKACCTFROM.BANKID, accountId: statement.BANKACCTFROM.ACCTID,
        ...(statement.BANKACCTFROM.BRANCHID ? { branchId: statement.BANKACCTFROM.BRANCHID } : {}), currency: statement.CURDEF });
      const rows = Array.isArray(statement.BANKTRANLIST.STMTTRN) ? statement.BANKTRANLIST.STMTTRN : [statement.BANKTRANLIST.STMTTRN];
      transactions = rows.map(row => transaction(account, row.FITID, row.DTPOSTED, row.TRNAMT, row, '.', true));
    } else if (format === 'csv' && mapping && [',', ';'].includes(mapping.delimiter) && ['.', ','].includes(mapping.decimal)) {
      const result: unknown = parseCsv(source, { delimiter: mapping.delimiter, bom: true, cast: false,
        skip_empty_lines: true, max_record_size: 65536, relax_column_count: false, to: MAX_ROWS + 2 });
      const rows = z.array(z.array(z.string())).min(2).max(MAX_ROWS + 1).parse(result);
      const header = rows[0];
      if (new Set(header).size !== header.length) return invalid();
      const columns = mapping.columns;
      if (Object.values(columns).some(name => !name || !header.includes(name)) || new Set(Object.values(columns)).size !== Object.values(columns).length) return invalid();
      const field = (row: string[], name: string) => row[header.indexOf(name)];
      const accounts = rows.slice(1).map(row => accountSchema.parse({ bankId: field(row, columns.bankId), accountId: field(row, columns.accountId),
        ...(columns.branchId ? { branchId: field(row, columns.branchId) } : {}), currency: field(row, columns.currency) }));
      account = accounts[0];
      if (accounts.some(item => canonical(item) !== canonical(account))) return invalid();
      transactions = rows.slice(1).map(row => transaction(account, field(row, columns.sourceId), field(row, columns.posted), field(row, columns.amount),
        Object.fromEntries(header.map((name, i) => [name, row[i]])), mapping.decimal, false));
    } else return invalid();
    if (!transactions.length || transactions.length > MAX_ROWS) return invalid();
    const seen = new Map<string, string>();
    for (const row of transactions) {
      if (seen.has(row.identityHash)) throw new AppError(409, 'BANK_STATEMENT_DUPLICATE_ID', 'Repeated bank transaction identifier');
      seen.set(row.identityHash, row.contentHash);
    }
    return { kind: 'bank_statement', sourceSha256: createHash('sha256').update(bytes).digest('hex'), account, transactions,
      totalMinor: transactions.reduce((sum, row) => sum + BigInt(row.amountMinor), 0n).toString() };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return invalid();
  }
}

/** Compare only with the same verified bank account; absence of a stable bank ID never becomes a guessed match. */
export function reconcileStatementStage(statement: BankStatement, verifiedAccount: BankAccountIdentity, existing: ReadonlyMap<string, string>) {
  if (canonical(accountSchema.parse(verifiedAccount)) !== canonical(statement.account)) throw new AppError(403, 'BANK_ACCOUNT_MISMATCH', 'Bank account mismatch');
  return statement.transactions.map(row => ({ identityHash: row.identityHash,
    disposition: existing.has(row.identityHash) ? (existing.get(row.identityHash) === row.contentHash ? 'REPLAY' : 'CONFLICT') : 'NEW' }));
}
