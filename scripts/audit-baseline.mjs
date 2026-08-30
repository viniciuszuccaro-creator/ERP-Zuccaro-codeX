import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules']);
const ENCODING_MARKERS = ['\u00c3', '\u00c2', '\u00f0\u0178', '\u00e2\u0153', '\u00e2\u009d', '\u00e2\u20ac'];
const LEGACY_NAME_PATTERN = /(?:^|[_.-])(old|legacy|final|status|certific|manifest|v\d+)/i;
const JSON_REPORT_ARTIFACTS = new Set([
  'src/components/reports/rhf_zod_report.jsx',
  'src/components/reports/rhf_zod_report.json.jsx',
  'src/components/lib/UnidadesDeMedida.jsx',
  'src/components/lib/UnidadesDeMedida.json.jsx',
]);

async function walkFiles(root, relativeDir = '') {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, relativePath));
    else files.push(relativePath);
  }

  return files;
}

const toPosix = (value) => value.split(path.sep).join('/');
const isSourceFile = (file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase());
const hasEncodingMarker = (content) => ENCODING_MARKERS.some((marker) => content.includes(marker));

export function isHistoricalArtifact(file, content = '') {
  const normalizedPath = toPosix(file);
  const normalizedContent = content.trimStart();

  return normalizedPath.endsWith('.md.jsx')
    || normalizedContent.startsWith('#')
    || /^markdown\s*\r?\n#/i.test(normalizedContent)
    || (JSON_REPORT_ARTIFACTS.has(normalizedPath) && normalizedContent.startsWith('{'));
}

export async function findHistoricalArtifactFiles(root = process.cwd()) {
  const allFiles = await walkFiles(root);
  const candidates = allFiles.filter(isSourceFile);
  const historicalArtifacts = [];

  for (const file of candidates) {
    const content = await readFile(path.join(root, file), 'utf8');
    if (isHistoricalArtifact(file, content)) historicalArtifacts.push(toPosix(file));
  }

  return historicalArtifacts.sort();
}

export async function buildInventory(root = process.cwd()) {
  const allFiles = await walkFiles(root);
  const sourceFiles = allFiles.filter(isSourceFile);
  const details = [];

  for (const file of sourceFiles) {
    const content = await readFile(path.join(root, file), 'utf8');
    details.push({
      path: toPosix(file),
      lines: content.split(/\r?\n/).length,
      historicalArtifact: isHistoricalArtifact(file, content),
      encodingIssue: hasEncodingMarker(content),
      legacyCandidate: LEGACY_NAME_PATTERN.test(path.basename(file)),
      controls: (content.match(/<(?:Button|button|Switch|Checkbox|Select|Input|Textarea)\b/g) || []).length,
      actions: (content.match(/data-action=/g) || []).length,
      permissions: (content.match(/data-permission=/g) || []).length,
      imports: [...content.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
      emptyCatches: (content.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) || []).length,
    });
  }

  const pageFiles = details.filter((item) => item.path.startsWith('src/pages/'));
  const componentFiles = details.filter((item) => item.path.startsWith('src/components/'));
  const functionNames = allFiles
    .filter((file) => /^base44[\\/]functions[\\/][^\\/]+[\\/]entry\.ts$/.test(file))
    .map((file) => toPosix(file).split('/')[2])
    .filter((name) => name !== '_lib');
  const entityFiles = allFiles.filter((file) => /^base44[\\/]entities[\\/].+\.jsonc$/.test(file));

  const largeFiles = details.filter((item) => item.lines > 600).sort((a, b) => b.lines - a.lines);
  const encodingFiles = details.filter((item) => item.encodingIssue);
  const legacyCandidates = details.filter((item) => item.legacyCandidate);
  const historicalArtifacts = details.filter((item) => item.historicalArtifact);
  const artifactPaths = new Set(historicalArtifacts.map((item) => item.path.replace(/\.(?:js|jsx|ts|tsx|mjs|cjs)$/i, '')));
  const historicalArtifactsImportedByRuntime = details
    .filter((item) => !item.historicalArtifact)
    .flatMap((item) => item.imports.map((specifier) => ({
      importer: item.path,
      imported: specifier.replace(/^@\//, 'src/').replace(/\.(?:js|jsx|ts|tsx|mjs|cjs)$/i, ''),
    })))
    .filter((item) => artifactPaths.has(item.imported));
  const totals = details.reduce((acc, item) => ({
    controls: acc.controls + item.controls,
    actions: acc.actions + item.actions,
    permissions: acc.permissions + item.permissions,
    emptyCatches: acc.emptyCatches + item.emptyCatches,
  }), { controls: 0, actions: 0, permissions: 0, emptyCatches: 0 });
  const filesWithEmptyCatches = details
    .filter((item) => !item.historicalArtifact && item.emptyCatches > 0)
    .sort((a, b) => b.emptyCatches - a.emptyCatches);

  return {
    generatedAt: new Date().toISOString(),
    root: path.resolve(root),
    summary: {
      pages: pageFiles.length,
      components: componentFiles.length,
      functions: new Set(functionNames).size,
      entitiesWithLocalSchema: entityFiles.length,
      sourceFiles: details.length,
      filesOver600Lines: largeFiles.length,
      filesWithEncodingMarkers: encodingFiles.length,
      legacyCandidates: legacyCandidates.length,
      historicalArtifacts: historicalArtifacts.length,
      historicalArtifactsImportedByRuntime: historicalArtifactsImportedByRuntime.length,
      interactiveControls: totals.controls,
      controlsWithActionMarker: totals.actions,
      controlsWithPermissionMarker: totals.permissions,
      operationalEmptyCatches: filesWithEmptyCatches.reduce((sum, item) => sum + item.emptyCatches, 0),
    },
    priorities: {
      largeFiles: largeFiles.slice(0, 30).map(({ path: file, lines }) => ({ path: file, lines })),
      encodingFiles: encodingFiles.slice(0, 100).map((item) => item.path),
      legacyCandidates: legacyCandidates.slice(0, 100).map((item) => item.path),
      historicalArtifacts: historicalArtifacts.map((item) => item.path),
      historicalArtifactImports: historicalArtifactsImportedByRuntime,
      emptyCatchFiles: filesWithEmptyCatches.map((item) => ({ path: item.path, count: item.emptyCatches })),
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const inventory = await buildInventory(process.cwd());
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}
