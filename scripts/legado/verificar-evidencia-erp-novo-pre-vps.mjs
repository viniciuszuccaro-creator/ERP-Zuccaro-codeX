#!/usr/bin/env node
/**
 * Verifica evidências privadas do ERP novo (pré-VPS + export VPS) — somente metadados.
 *
 * - Confere SHA-256 do export VPS já registrado (mesmo arquivo?).
 * - Se existir topology-proof pré-VPS no HD, confirma presença de pares id+cnpj
 *   (hashes) SEM imprimir IDs/CNPJ.
 * - Separado da importação do ERP antigo. CADESP não é re-solicitado.
 * - importAuthorized permanece false. Não toca mapper Cursor #48.
 *
 * Uso (no PC com HD montado):
 *   node scripts/legado/verificar-evidencia-erp-novo-pre-vps.mjs \
 *     --export "/mnt/.../04_REPORTS/legado-empresas-api-20261006T153440Z.json" \
 *     --expected-sha256 18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e \
 *     --reports-dir "/mnt/.../BACKUP ERP ANTIGO - CODEX/04_REPORTS"
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERIFIER_ERP_NOVO_VERSION = '1.0.0';
export const EXPECTED_EXPORT_SHA256_DEFAULT =
  '18e2ab9a085dda6040d4d63d2dfc88d702b0a84203a5cf19d80358c46cca3d7e';
export const EXPECTED_EXPORT_LEAF =
  'legado-empresas-api-20261006T153440Z.json';

const TOPOLOGY_LEAF_HINTS = [
  'current-erp-company-topology-proof.json',
  'current-erp-company-topology-proof',
];

function fail(code, detail = '') {
  const err = new Error(detail ? `${code}:${detail}` : code);
  err.code = code;
  throw err;
}

function text(v) {
  return String(v ?? '').trim();
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function parseArgs(argv) {
  const out = {
    exportPath: '',
    expectedSha: EXPECTED_EXPORT_SHA256_DEFAULT,
    reportsDir: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--export') out.exportPath = argv[++i];
    else if (argv[i] === '--expected-sha256') out.expectedSha = argv[++i];
    else if (argv[i] === '--reports-dir') out.reportsDir = argv[++i];
  }
  return out;
}

function findTopologyCandidates(reportsDir) {
  if (!reportsDir || !existsSync(reportsDir)) return [];
  const names = readdirSync(reportsDir);
  return names
    .filter((n) => TOPOLOGY_LEAF_HINTS.some((h) => n === h || n.startsWith(h)))
    .map((n) => join(reportsDir, n));
}

/**
 * Conta pares id+cnpj_sha256 em estruturas típicas sem emitir valores.
 * @param {unknown} data
 */
export function contarParesIdCnpj(data, acc = { objetos: 0, comId: 0, comCnpjHash: 0, comIdECnpj: 0 }) {
  if (Array.isArray(data)) {
    for (const item of data) contarParesIdCnpj(item, acc);
    return acc;
  }
  if (!data || typeof data !== 'object') return acc;
  acc.objetos += 1;
  const o = /** @type {Record<string, unknown>} */ (data);
  const id = o.id ?? o.empresa_id ?? o.group_id ?? o.empresaId ?? o.groupId;
  const cnpjHash = o.cnpj_sha256 ?? o.cnpjSha256 ?? o.cnpj_hash ?? o.hash_cnpj;
  const hasId = typeof id === 'string' && id.length > 0;
  const hasCnpj = typeof cnpjHash === 'string' && /^[a-f0-9]{64}$/i.test(cnpjHash);
  if (hasId) acc.comId += 1;
  if (hasCnpj) acc.comCnpjHash += 1;
  if (hasId && hasCnpj) acc.comIdECnpj += 1;
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') contarParesIdCnpj(v, acc);
  }
  return acc;
}

export function verificarEvidenciaErpNovoPreVps(opts) {
  const expectedSha = text(opts.expectedSha || EXPECTED_EXPORT_SHA256_DEFAULT).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha)) fail('LEGACY_EXPECTED_SHA_INVALID');

  const report = {
    verifierVersion: VERIFIER_ERP_NOVO_VERSION,
    importAuthorized: false,
    operationalLoadAuthorized: false,
    cadespRedocumentRequested: false,
    sameFileAsPaste: null,
    export: {
      pathLeaf: null,
      present: false,
      bytes: null,
      sha256: null,
      matchesExpected: null,
    },
    topologyPreVps: {
      searched: false,
      candidates: 0,
      leafNames: [],
      paresIdCnpj: null,
      note: 'ERP novo anterior à VPS — separado da importação do ERP antigo',
    },
    blocked: [],
  };

  const exportPath = text(opts.exportPath);
  if (!exportPath) {
    report.blocked.push('LEGACY_EXPORT_PATH_MISSING');
  } else if (!existsSync(exportPath)) {
    report.export.pathLeaf = basename(exportPath);
    report.blocked.push('LEGACY_EXPORT_FILE_ABSENT');
  } else {
    const st = statSync(exportPath);
    const digest = sha256File(exportPath);
    report.export = {
      pathLeaf: basename(exportPath),
      present: true,
      bytes: st.size,
      sha256: digest,
      matchesExpected: digest === expectedSha,
    };
    report.sameFileAsPaste = digest === expectedSha;
    if (!report.sameFileAsPaste) report.blocked.push('LEGACY_EXPORT_SHA_MISMATCH');
  }

  const reportsDir = text(opts.reportsDir);
  if (reportsDir) {
    report.topologyPreVps.searched = true;
    if (!existsSync(reportsDir)) {
      report.blocked.push('LEGACY_REPORTS_DIR_ABSENT');
    } else {
      const cands = findTopologyCandidates(reportsDir);
      report.topologyPreVps.candidates = cands.length;
      report.topologyPreVps.leafNames = cands.map((p) => basename(p));
      if (cands.length === 0) {
        report.blocked.push('LEGACY_TOPOLOGY_PROOF_NOT_FOUND');
      } else {
        // Lê só o primeiro candidato; conta pares sem emitir IDs/CNPJ
        try {
          const json = JSON.parse(readFileSync(cands[0], 'utf8').replace(/^\uFEFF/, ''));
          report.topologyPreVps.paresIdCnpj = contarParesIdCnpj(json);
          if ((report.topologyPreVps.paresIdCnpj.comIdECnpj || 0) < 1) {
            report.blocked.push('LEGACY_TOPOLOGY_NO_ID_CNPJ_PAIRS');
          }
        } catch {
          report.blocked.push('LEGACY_TOPOLOGY_UNREADABLE');
        }
      }
    }
  } else {
    report.blocked.push('LEGACY_REPORTS_DIR_NOT_PROVIDED');
  }

  report.ok = report.blocked.length === 0;
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = verificarEvidenciaErpNovoPreVps({
    exportPath: args.exportPath ? resolve(args.exportPath) : '',
    expectedSha: args.expectedSha,
    reportsDir: args.reportsDir ? resolve(args.reportsDir) : '',
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 2;
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === self) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err.code || 'LEGACY_ERP_NOVO_VERIFY_ERROR'}:${err.message}\n`);
    process.exit(1);
  }
}
