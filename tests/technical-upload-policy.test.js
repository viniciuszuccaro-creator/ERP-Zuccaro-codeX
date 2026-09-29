import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertConfirmedTechnicalUploadUrl,
  assertTechnicalUploadAllowed,
  TECHNICAL_UPLOAD_MAX_BYTES,
} from '../src/lib/technicalUploadPolicy.js';

const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpeg = [0xff, 0xd8, 0xff];

function file(name, type, signature, size = signature.length) {
  return {
    name,
    type,
    size,
    slice: (_start, end) => ({ arrayBuffer: async () => Uint8Array.from(signature.slice(0, end)).buffer }),
  };
}

test('upload tecnico aceita PDF, PNG e JPEG somente com MIME e assinatura coerentes', async () => {
  assert.equal(await assertTechnicalUploadAllowed(file('projeto.pdf', 'application/pdf', pdf), 'remote'), 'PDF');
  assert.equal(await assertTechnicalUploadAllowed(file('planta.png', 'image/png', png), 'local'), 'PNG');
  assert.equal(await assertTechnicalUploadAllowed(file('vista.JPEG', 'image/jpeg', jpeg), 'remote'), 'JPG');
});

test('modo HTTP bloqueia antes de ler arquivo ou acionar storage legado', async () => {
  const forbidden = { get name() { throw new Error('arquivo foi lido'); } };
  await assert.rejects(assertTechnicalUploadAllowed(forbidden, 'http'), /armazenamento canônico/);
});

test('CAD, executável, nome inseguro, MIME divergente e assinatura falsa falham fechado', async () => {
  for (const extension of ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs']) {
    await assert.rejects(assertTechnicalUploadAllowed(file(`peca.${extension}`, 'application/octet-stream', pdf), 'remote'), /CAD aguarda/);
  }
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.exe', 'application/octet-stream', pdf), 'remote'), /não autorizado/);
  await assert.rejects(assertTechnicalUploadAllowed(file('../peca.pdf', 'application/pdf', pdf), 'remote'), /Nome de arquivo inválido/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'image/png', pdf), 'remote'), /Tipo do arquivo/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'application/pdf', png), 'remote'), /Assinatura/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'application/pdf', pdf, 0), 'remote'), /vazio/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'application/pdf', pdf, TECHNICAL_UPLOAD_MAX_BYTES + 1), 'remote'), /10 MB/);
});

test('upload só confirma URL HTTPS externa, sem credencial ou placeholder local', () => {
  assert.equal(assertConfirmedTechnicalUploadUrl('https://storage.example.test/projects/p.pdf'), 'https://storage.example.test/projects/p.pdf');
  for (const value of [undefined, '', 'local://projects/p.pdf', 'http://storage.example.test/p.pdf', 'https://user:secret@storage.example.test/p.pdf', 'https://localhost/p.pdf', 'https://127.0.0.1/p.pdf', 'https://storage.example.test/p.pdf?token=temporary']) {
    assert.throws(() => assertConfirmedTechnicalUploadUrl(value), /Upload sem confirmação/);
  }
});

test('Pedido, Corte e Dobra e Portal usam a mesma validação antes de confirmar anexo', () => {
  for (const path of [
    'src/components/comercial/ArquivosProjetosTab.jsx',
    'src/components/comercial/CorteDobraIATab.jsx',
    'src/components/portal/UploadProjetos.jsx',
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /assertTechnicalUploadAllowed\(file\)/);
    assert.match(source, /assertConfirmedTechnicalUploadUrl\(file_url\)/);
  }
  const corte = readFileSync(new URL('../src/components/comercial/CorteDobraIATab.jsx', import.meta.url), 'utf8');
  assert.match(corte, /tipo_arquivo: tipoArquivo/);
});
