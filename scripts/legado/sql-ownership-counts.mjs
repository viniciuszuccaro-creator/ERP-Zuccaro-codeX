import { execFileSync } from 'node:child_process';

const DATABASES = [
  'LEGACY_TID_AUDITORIA', 'LEGACY_TID_EMP01', 'LEGACY_TID_EMP02',
  'LEGACY_TID_EMP03', 'LEGACY_TID_EMP04', 'LEGACY_TID_EMP05',
  'LEGACY_TID_EXETPS', 'LEGACY_TID_TEMP', 'LEGACY_TIDDF',
];

const SOURCES = [
  ['EMP01', 'PedidoVenda', 'CODIGOEMPRESA'],
  ['EMP02', 'PedidoVenda', 'CODIGOEMPRESA'],
  ['EMP03', 'PedidoVenda', 'CODIGOEMPRESA'],
  ['EMP01', 'NotaFiscalSaidas', 'CODIGOEMPRESA'],
  ['EMP02', 'NotaFiscalSaidas', 'CODIGOEMPRESA'],
  ['EMP03', 'NotaFiscalSaidas', 'CODIGOEMPRESA'],
  ['EMP01', 'NotasFiscaisEntradas', 'CODIGOEMPRESA'],
  ['EMP02', 'NotasFiscaisEntradas', 'CODIGOEMPRESA'],
  ['EMP03', 'NotasFiscaisEntradas', 'CODIGOEMPRESA'],
  ['EMP01', 'ContaCorrenteClientes', 'EMPRESA'],
  ['EMP02', 'ContaCorrenteClientes', 'EMPRESA'],
  ['EMP03', 'ContaCorrenteClientes', 'EMPRESA'],
];

const bucketNames = ['semCodigo', 'codigo000', 'codigo001', 'codigo002', 'codigo003', 'codigo004', 'codigo005', 'outroCodigo'];

export function ownershipCountQuery() {
  const databaseList = DATABASES.map((name) => `'${name}'`).join(', ');
  const select = SOURCES.map(([database, table, column]) => {
    const value = `LTRIM(RTRIM(CONVERT(nvarchar(64), [${column}])))`;
    const parsed = `TRY_CONVERT(int, ${value})`;
    const bucket = `CASE WHEN [${column}] IS NULL OR ${value} = '' THEN 'semCodigo'`
      + ` WHEN ${parsed} BETWEEN 0 AND 5 THEN 'codigo' + RIGHT('000' + CONVERT(varchar(3), ${parsed}), 3)`
      + " ELSE 'outroCodigo' END";
    return `SELECT '${database.slice(-5)}' AS fonte, '${table}' AS entidade, ${bucket} AS categoria,`
      + ` COUNT_BIG(*) AS quantidade FROM [LEGACY_TID_${database}].[dbo].[${table}] GROUP BY ${bucket}`;
  }).join('\nUNION ALL\n');
  return `SET NOCOUNT ON;
IF (SELECT COUNT(*) FROM sys.databases WHERE name IN (${databaseList})
  AND state_desc = 'ONLINE' AND is_read_only = 1) <> ${DATABASES.length}
  THROW 50000, 'LEGACY_SQL_READ_ONLY_GATE', 1;
SELECT fonte, entidade, categoria, quantidade FROM (${select}) AS agregado FOR JSON PATH;`;
}

export function parseOwnershipCounts(raw) {
  let rows;
  try { rows = JSON.parse(String(raw).replace(/\r?\n/g, '').trim()); } catch { throw new Error('LEGACY_SQL_RESULT_INVALID'); }
  if (!Array.isArray(rows)) throw new Error('LEGACY_SQL_RESULT_INVALID');
  const results = Object.fromEntries(SOURCES.map(([database, table]) => {
    const key = `${database.slice(-5)}|${table}`;
    return [key, { fonte: database.slice(-5), entidade: table, total: 0,
      ...Object.fromEntries(bucketNames.map((name) => [name, 0])) }];
  }));
  for (const row of rows) {
    const key = `${row?.fonte}|${row?.entidade}`;
    if (!Object.hasOwn(results, key) || !bucketNames.includes(row?.categoria)
      || !Number.isSafeInteger(row?.quantidade) || row.quantidade <= 0
      || results[key][row.categoria] !== 0) throw new Error('LEGACY_SQL_RESULT_INVALID');
    results[key][row.categoria] = row.quantidade;
    results[key].total += row.quantidade;
  }
  return { mode: 'READ_ONLY_AGGREGATE', ownershipProven: false,
    importAuthorized: false, databasesRequiredReadOnly: DATABASES.length,
    sources: Object.values(results) };
}

export function inspectLegacySql(runQuery) {
  return parseOwnershipCounts(runQuery(ownershipCountQuery()));
}

export function sqlcmdArguments(query) {
  return ['-S', 'lpc:.\\ERPZLEGACY', '-E', '-C', '-d', 'master', '-b', '-l', '30',
    '-h', '-1', '-w', '65535', '-y', '4096', '-Q', query];
}

if (process.argv[1]?.endsWith('sql-ownership-counts.mjs')) {
  const sqlcmd = 'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\180\\Tools\\Binn\\SQLCMD.EXE';
  try {
    const report = inspectLegacySql((query) => execFileSync(sqlcmd, sqlcmdArguments(query),
      { encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    process.stderr.write('LEGACY_SQL_INSPECTION_FAILED\n');
    process.exitCode = 1;
  }
}
