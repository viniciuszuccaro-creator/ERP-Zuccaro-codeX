import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLASSIFICADOR_EMPRESAS_API_VERSION,
  classificarEmpresasApiLegado,
  normalizarRotulo,
} from '../scripts/legado/classificar-empresas-api-legado.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportPath = path.join(root, 'fixtures/legado/empresas-api-sinteticas/export-sanitizado.json');
const script = path.join(root, 'scripts/legado/classificar-empresas-api-legado.mjs');
const sh = path.join(root, 'scripts/legado/exportar-empresas-api-somente-leitura.sh');

test('normalizarRotulo remove acento', () => {
  assert.equal(normalizarRotulo('CPA Ferro e Aço'), 'cpa ferro e aco');
});

test('classifica CPA/3Z operacionais e terceira linha Grupo CPA sem apagar', () => {
  const exportacao = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const r = classificarEmpresasApiLegado(exportacao);
  assert.equal(r.classificadorVersion, CLASSIFICADOR_EMPRESAS_API_VERSION);
  assert.equal(r.importAuthorized, false);
  assert.equal(r.operationalLoadAuthorized, false);
  assert.equal(r.neverDelete, true);
  assert.equal(r.cadespReused, true);
  assert.equal(r.cadespRedocumentRequested, false);
  assert.equal(r.duasEmpresasOperacionaisIdentificadas, true);
  assert.equal(r.terceiraLinhaInvestigadaSemApagar, true);
  assert.equal(r.counts.empresa_operacional, 2);
  assert.ok(r.counts.agrupamento >= 2);
  assert.ok(r.linhas.every((l) => l.neverDelete === true));
  assert.ok(r.linhas.every((l) => l.cadespRedocumentRequested === false));
  const terceira = r.linhas.find((l) => l.kind === 'empresa' && l.papel === 'agrupamento');
  assert.ok(terceira);
  assert.match(terceira.motivo, /nao_apagar/);
});

test('CLI fixture sintetico sai 0 e nega import', () => {
  const run = spawnSync(process.execPath, [script, '--export', exportPath], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const json = JSON.parse(run.stdout);
  assert.equal(json.importAuthorized, false);
  assert.equal(json.coordenacaoComercial.ausenciaTelaNaoEImportacao, true);
});

test('flag importAuthorized=true e recusada', () => {
  const exportacao = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  exportacao.importAuthorized = true;
  assert.throws(
    () => classificarEmpresasApiLegado(exportacao),
    /LEGACY_API_EXPORT_IMPORT_FLAG/,
  );
});

test('script Web Console e somente leitura e usa nome de arquivo novo', () => {
  const text = fs.readFileSync(sh, 'utf8');
  const body = text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  assert.match(text, /legado-empresas-api-\$\{STAMP\}\.json/);
  assert.match(text, /somente leitura/);
  assert.match(text, /PASTE_TO_GIT_BEGIN/);
  assert.match(text, /cadesp_redocument_requested=false/);
  assert.doesNotMatch(body, /\b(UPDATE|DELETE|INSERT|DROP|TRUNCATE|ALTER)\b/);
  assert.doesNotMatch(body, /tip-port|tipPort/);
});
