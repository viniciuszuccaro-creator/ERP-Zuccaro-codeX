#!/usr/bin/env node
/**
 * Validação SOMENTE LEITURA da origem/proveniência dos relatórios privados do legado.
 *
 * Comprova por relatório:
 * - fonte (relativePath sob o root privado / fixture);
 * - SHA-256 (duas passagens idênticas = reprodução);
 * - extractorId + extractorVersion registrados no manifesto;
 * - bytes opcionais;
 * - kind do extrator (sql_readonly | tps_schema | app_literal_scan | aggregate | inventory).
 *
 * Não altera origem. Não importa. Não imprime conteúdo dos relatórios.
 * Saída: JSON agregado sanitizado (somente leaf names + hashes + status).
 *
 * Uso:
 *   node scripts/legado/validar-origem-relatorios-privados.mjs \
 *     --root /caminho/BACKUP\ ERP\ ANTIGO\ -\ CODEX \
 *     --manifest /caminho/manifest-origem-relatorios.json
 *
 * Fixture sintética (repo):
 *   node scripts/legado/validar-origem-relatorios-privados.mjs \
 *     --root fixtures/legado/origem-relatorios-sinteticos \
 *     --manifest fixtures/legado/origem-relatorios-sinteticos/manifest-origem.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTRACTOR_KINDS = Object.freeze([
  'sql_readonly',
  'tps_schema',
  'app_literal_scan',
  'aggregate',
  'inventory',
]);

export const VALIDATOR_VERSION = '1.0.0';

const SHA256_RE = /^[a-f0-9]{64}$/i;
const BLOCKED_NAME_RE = /USUSENHA|SENHA\.TPS|PASSWORD|\.ENV|CREDENTIAL/i;

function fail(code, detail = '') {
  const err = new Error(detail ? `${code}:${detail}` : code);
  err.code = code;
  throw err;
}

function parseArgs(argv) {
  const out = { root: '', manifest: '', json: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i] || '';
    else if (a === '--manifest') out.manifest = argv[++i] || '';
    else if (a === '--help' || a === '-h') out.help = true;
    else fail('LEGACY_ORIGIN_ARG_UNKNOWN', a);
  }
  return out;
}

function loadManifest(manifestPath) {
  if (!manifestPath) fail('LEGACY_ORIGIN_MANIFEST_REQUIRED');
  if (!existsSync(manifestPath)) fail('LEGACY_ORIGIN_MANIFEST_MISSING', basename(manifestPath));
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    fail('LEGACY_ORIGIN_MANIFEST_UNREADABLE', basename(manifestPath));
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('LEGACY_ORIGIN_MANIFEST_INVALID', 'root');
  }
  if (parsed.schemaVersion !== 1) fail('LEGACY_ORIGIN_MANIFEST_SCHEMA', String(parsed.schemaVersion));
  if (!Array.isArray(parsed.extractorRegistry) || parsed.extractorRegistry.length === 0) {
    fail('LEGACY_ORIGIN_EXTRACTOR_REGISTRY_EMPTY');
  }
  if (!Array.isArray(parsed.reports) || parsed.reports.length === 0) {
    fail('LEGACY_ORIGIN_REPORTS_EMPTY');
  }
  return parsed;
}

function registryMap(registry) {
  const map = new Map();
  for (const entry of registry) {
    if (!entry || typeof entry !== 'object') fail('LEGACY_ORIGIN_EXTRACTOR_INVALID', 'entry');
    const id = String(entry.id || '').trim();
    const version = String(entry.version || '').trim();
    const kind = String(entry.kind || '').trim();
    if (!id || !version) fail('LEGACY_ORIGIN_EXTRACTOR_INVALID', 'id|version');
    if (!EXTRACTOR_KINDS.includes(kind)) fail('LEGACY_ORIGIN_EXTRACTOR_KIND', kind || 'empty');
    const key = `${id}@${version}`;
    if (map.has(key)) fail('LEGACY_ORIGIN_EXTRACTOR_DUP', key);
    map.set(key, { id, version, kind });
  }
  return map;
}

function assertInsideRoot(rootAbs, candidateAbs) {
  const rel = relative(rootAbs, candidateAbs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    fail('LEGACY_ORIGIN_PATH_ESCAPE', basename(candidateAbs));
  }
}

function sha256FileTwice(absPath) {
  const hashOnce = () => {
    const h = createHash('sha256');
    h.update(readFileSync(absPath));
    return h.digest('hex');
  };
  const pass1 = hashOnce();
  const pass2 = hashOnce();
  if (pass1 !== pass2) fail('LEGACY_ORIGIN_REPRO_MISMATCH', basename(absPath));
  return { pass1, pass2, reproduced: true };
}

function sanitizeLeaf(name) {
  if (BLOCKED_NAME_RE.test(name)) return 'BLOCKED_SECRET_FILENAME';
  return String(name).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, 'REDACTED_EMAIL');
}

/**
 * @param {string} root
 * @param {string} manifestPath
 */
export function validatePrivateReportOrigins(root, manifestPath) {
  if (!root) fail('LEGACY_ORIGIN_ROOT_REQUIRED');
  const rootAbs = resolve(root);
  if (!existsSync(rootAbs) || !statSync(rootAbs).isDirectory()) {
    fail('LEGACY_REPORTS_ROOT_UNAVAILABLE', 'monte o HD ou use fixture sintetica');
  }

  const manifestAbs = resolve(manifestPath);
  const manifest = loadManifest(manifestAbs);
  const extractors = registryMap(manifest.extractorRegistry);

  const synthetic = Boolean(manifest.synthetic);
  const reports = [];
  let verified = 0;
  let failed = 0;

  for (const item of manifest.reports) {
    if (!item || typeof item !== 'object') fail('LEGACY_ORIGIN_REPORT_INVALID', 'entry');
    const relativePath = String(item.relativePath || '').replace(/\\/g, '/').trim();
    const expectedSha = String(item.sha256 || '').trim().toLowerCase();
    const extractorId = String(item.extractorId || '').trim();
    const extractorVersion = String(item.extractorVersion || '').trim();
    const sourceKind = String(item.sourceKind || '').trim();
    const expectedBytes = item.bytes;

    if (!relativePath || relativePath.includes('..') || normalize(relativePath).includes('..')) {
      fail('LEGACY_ORIGIN_RELPATH_INVALID', sanitizeLeaf(basename(relativePath || 'empty')));
    }
    if (!SHA256_RE.test(expectedSha)) fail('LEGACY_ORIGIN_HASH_INVALID', sanitizeLeaf(basename(relativePath)));
    if (!extractorId || !extractorVersion) {
      fail('LEGACY_ORIGIN_EXTRACTOR_REF_MISSING', sanitizeLeaf(basename(relativePath)));
    }
    if (!EXTRACTOR_KINDS.includes(sourceKind)) {
      fail('LEGACY_ORIGIN_SOURCE_KIND', sourceKind || 'empty');
    }

    const reg = extractors.get(`${extractorId}@${extractorVersion}`);
    if (!reg) fail('LEGACY_ORIGIN_EXTRACTOR_UNREGISTERED', `${extractorId}@${extractorVersion}`);
    if (reg.kind !== sourceKind) {
      fail('LEGACY_ORIGIN_EXTRACTOR_KIND_MISMATCH', `${extractorId}:${sourceKind}`);
    }

    const fileAbs = resolve(join(rootAbs, ...relativePath.split('/')));
    assertInsideRoot(rootAbs, fileAbs);
    if (!existsSync(fileAbs) || !statSync(fileAbs).isFile()) {
      fail('LEGACY_ORIGIN_FILE_MISSING', sanitizeLeaf(basename(relativePath)));
    }

    const leaf = sanitizeLeaf(basename(relativePath));
    if (BLOCKED_NAME_RE.test(basename(relativePath))) {
      fail('LEGACY_ORIGIN_SECRET_CANDIDATE', leaf);
    }

    const st = statSync(fileAbs);
    if (expectedBytes != null && Number(expectedBytes) !== st.size) {
      fail('LEGACY_ORIGIN_BYTES_MISMATCH', leaf);
    }

    const { pass1, pass2, reproduced } = sha256FileTwice(fileAbs);
    const hashOk = pass1 === expectedSha && pass2 === expectedSha;
    if (!hashOk) {
      failed += 1;
      reports.push({
        leaf,
        bytes: st.size,
        sha256_expected: expectedSha,
        sha256_pass1: pass1,
        sha256_pass2: pass2,
        reproduced,
        hash_match: false,
        extractor_id: extractorId,
        extractor_version: extractorVersion,
        source_kind: sourceKind,
        status: 'HASH_MISMATCH',
      });
      continue;
    }

    verified += 1;
    reports.push({
      leaf,
      bytes: st.size,
      sha256: pass1,
      reproduced,
      hash_match: true,
      extractor_id: extractorId,
      extractor_version: extractorVersion,
      source_kind: sourceKind,
      status: 'ORIGIN_VERIFIED',
    });
  }

  if (failed > 0) fail('LEGACY_ORIGIN_HASH_MISMATCH', `failed=${failed}`);

  return {
    schemaVersion: 1,
    validatorVersion: VALIDATOR_VERSION,
    mode: 'READ_ONLY_NO_IMPORT',
    synthetic,
    operationalImportAuthorized: false,
    root_leaf: basename(rootAbs),
    manifest_leaf: basename(manifestAbs),
    extractor_registry_size: extractors.size,
    report_count: reports.length,
    verified_count: verified,
    failed_count: failed,
    reproduction_passes: 2,
    all_origins_verified: verified === reports.length && failed === 0,
    reports,
    note: 'Metadados sanitizados. Sem conteudo de relatorio. Sem PII. Sem autorizacao de carga.',
  };
}

function printHelp() {
  process.stdout.write(`Uso: validar-origem-relatorios-privados.mjs --root DIR --manifest FILE
Valida fonte, SHA-256 (2 passagens), extractorId/version e kind.
Nao altera origem. Nao importa. Nao imprime conteudo.
Validator ${VALIDATOR_VERSION}
`);
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exitCode = 0;
    } else {
      const report = validatePrivateReportOrigins(args.root, args.manifest);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exitCode = report.all_origins_verified ? 0 : 1;
    }
  } catch (error) {
    const msg = error?.code || error?.message || 'LEGACY_ORIGIN_VALIDATION_FAILED';
    const text = String(msg).startsWith('LEGACY_') ? String(error.message || msg) : 'LEGACY_ORIGIN_VALIDATION_FAILED';
    process.stderr.write(`${text}\n`);
    process.exitCode = 1;
  }
}
