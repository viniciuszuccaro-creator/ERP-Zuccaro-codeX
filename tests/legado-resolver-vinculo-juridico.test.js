import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DESTINO_CANONICO,
  detectarInferenciaProibida,
  indexarContratoAliases,
  normalizarCodigoLegado,
  resolverLoteVinculosJuridicos,
  resolverVinculoJuridico,
  RESOLVER_VINCULO_VERSION,
} from '../scripts/legado/resolver-vinculo-juridico-legado.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'fixtures/legado/vinculos-juridicos-sinteticos');
const contratoPath = path.join(fixtureDir, 'contrato-aliases-aprovados.json');
const candidatosPath = path.join(fixtureDir, 'candidatos-sinteticos.json');
const script = path.join(root, 'scripts/legado/resolver-vinculo-juridico-legado.mjs');

const contrato = () => JSON.parse(fs.readFileSync(contratoPath, 'utf8'));
const candidatos = () => JSON.parse(fs.readFileSync(candidatosPath, 'utf8')).candidatos;

test('normaliza codigo seletor preservando zeros', () => {
  assert.equal(normalizarCodigoLegado('1'), '001');
  assert.equal(normalizarCodigoLegado('002'), '002');
  assert.equal(normalizarCodigoLegado('3'), '003');
  assert.equal(normalizarCodigoLegado('0'), '0');
});

test('contrato sintetico indexa CPA/3Z operacionais e Grupo como agrupamento', () => {
  const index = indexarContratoAliases(contrato());
  assert.equal(index.empresas, 2);
  assert.equal(index.grupos, 1);
  assert.equal(index.importAuthorized, false);
  assert.equal(index.byCodigo.get('001').destino.destinoKey, DESTINO_CANONICO.CPA_FERRO_E_ACO.destinoKey);
  assert.equal(index.byCodigo.get('002').destino.destinoKey, DESTINO_CANONICO.EMPRESA_3Z_LTDA.destinoKey);
  assert.equal(index.byCodigo.get('003').destino.emissor, false);
  assert.equal(index.byCodigo.get('003').destino.scopeType, 'group');
});

test('resolve CPA e 3Z como empresas emissoras comprovadas', () => {
  const index = indexarContratoAliases(contrato());
  const cpa = resolverVinculoJuridico({ codigoEmpresaLegado: '1', requerEmissor: true }, index);
  const z = resolverVinculoJuridico({ codigoEmpresaLegado: '002', entidade: 'nota_fiscal' }, index);
  assert.equal(cpa.status, 'VINCULO_COMPROVADO');
  assert.equal(cpa.label, 'CPA Ferro e Aço');
  assert.equal(cpa.emissor, true);
  assert.equal(cpa.importAuthorized, false);
  assert.equal(z.label, '3Z LTDA');
  assert.equal(z.scopeType, 'empresa');
});

test('003/Grupo CPA nao e empresa emissora', () => {
  const index = indexarContratoAliases(contrato());
  const grupoCadastro = resolverVinculoJuridico({ codigoSeletor: '003', entidade: 'cliente' }, index);
  assert.equal(grupoCadastro.status, 'VINCULO_COMPROVADO');
  assert.equal(grupoCadastro.papel, 'agrupamento');
  assert.equal(grupoCadastro.emissor, false);

  const grupoEmissor = resolverVinculoJuridico({
    codigoEmpresaLegado: '003',
    entidade: 'nota_fiscal',
    requerEmissor: true,
  }, index);
  assert.equal(grupoEmissor.status, 'QUARENTENA');
  assert.ok(grupoEmissor.motivos.includes('codigo_grupo_nao_e_emissor'));
});

test('EMP03/pasta sozinha nao prova empresa', () => {
  assert.ok(detectarInferenciaProibida({ pasta: 'EMP03' }).some((m) => m.includes('EMP03')));
  const index = indexarContratoAliases(contrato());
  const r = resolverVinculoJuridico({ pasta: 'EMP03', pista: 'TID_EMP03' }, index);
  assert.equal(r.status, 'QUARENTENA');
  assert.ok(r.motivos.includes('inferencia_somente_pasta') || r.motivos.some((m) => m.startsWith('inferencia_proibida_pista')));
});

test('pedido explicito de inferir por pasta falha fechado mesmo com codigo 001', () => {
  const index = indexarContratoAliases(contrato());
  const r = resolverVinculoJuridico({
    codigoEmpresaLegado: '001',
    pasta: 'EMP03',
    inferirPorPasta: true,
  }, index);
  assert.equal(r.status, 'QUARENTENA');
  assert.ok(r.motivos.includes('politica_proibe_inferir_por_pasta'));
});

test('codigo 004 sem alias aprovado vai para quarentena', () => {
  const index = indexarContratoAliases(contrato());
  const r = resolverVinculoJuridico({ codigoEmpresaLegado: '4', requerEmissor: true }, index);
  assert.equal(r.status, 'QUARENTENA');
  assert.ok(r.motivos.includes('codigo_sem_alias_aprovado'));
});

test('lote fixture: contagens e selo estavel; sem PII; import negado', () => {
  const a = resolverLoteVinculosJuridicos(contrato(), candidatos());
  const b = resolverLoteVinculosJuridicos(contrato(), candidatos());
  assert.equal(a.resolverVersion, RESOLVER_VINCULO_VERSION);
  assert.equal(a.origem, 7);
  assert.equal(a.comprovados, 3); // CPA, 3Z, Grupo cadastro
  assert.equal(a.quarentena, 4); // grupo-emissor, pasta, inferir pasta, 004
  assert.equal(a.empresasOperacionais, 2);
  assert.equal(a.agrupamentos, 1);
  assert.equal(a.importAuthorized, false);
  assert.equal(a.blockedRealHdMap, true);
  assert.equal(a.seloSha256, b.seloSha256);
  const blob = JSON.stringify(a);
  assert.doesNotMatch(blob, /\d{14}|@cpa|senha|password|Bearer /i);
  assert.doesNotMatch(blob, /DELL-VINI|TID_EMP03\.mdf/i);
});

test('contrato marcando Grupo como empresa operacional e rejeitado', () => {
  const bad = contrato();
  bad.aliases[2].scopeType = 'empresa';
  bad.aliases[2].papel = 'empresa_operacional';
  bad.aliases[2].destinoKey = 'DEST_CPA_FERRO_E_ACO';
  assert.throws(() => indexarContratoAliases(bad), /LEGACY_VINCULO_GRUPO_COMO_EMPRESA/);
});

test('CLI do lote sai 0 e nao autoriza carga', () => {
  const run = spawnSync(process.execPath, [
    script, '--contrato', contratoPath, '--candidatos', candidatosPath,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /"comprovados": 3/);
  assert.match(run.stdout, /"importAuthorized": false/);
  assert.match(run.stdout, /codigo_grupo_nao_e_emissor|inferencia_somente_pasta|politica_proibe_inferir_por_pasta/);
});

test('fixture contrato nao contem PII tipica', () => {
  const blob = [
    fs.readFileSync(contratoPath, 'utf8'),
    fs.readFileSync(candidatosPath, 'utf8'),
  ].join('\n');
  assert.match(blob, /"synthetic": true/);
  assert.doesNotMatch(blob, /@cpa|cpf|cnpj\s*[:=]|senha|password|Bearer /i);
});
