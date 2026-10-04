import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertConfirmedTechnicalUploadUrl,
  assertTechnicalUploadAllowed,
  assertTechnicalAiProcessingAllowed,
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
  assert.equal(await assertTechnicalUploadAllowed(file('projeto.pdf', 'application/pdf', pdf), 'local'), 'PDF');
  assert.equal(await assertTechnicalUploadAllowed(file('planta.png', 'image/png', png), 'local'), 'PNG');
  assert.equal(await assertTechnicalUploadAllowed(file('vista.JPEG', 'image/jpeg', jpeg), 'local'), 'JPG');
});

test('modos HTTP e remoto bloqueiam antes de ler arquivo ou acionar storage legado', async () => {
  const forbidden = { get name() { throw new Error('arquivo foi lido'); } };
  for (const mode of ['http', 'remote']) {
    await assert.rejects(assertTechnicalUploadAllowed(forbidden, mode), /armazenamento canônico/);
  }
  assert.throws(() => assertTechnicalAiProcessingAllowed(), /revisão humana/);
});

test('CAD, executável, nome inseguro, MIME divergente e assinatura falsa falham fechado', async () => {
  for (const extension of ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs']) {
    await assert.rejects(assertTechnicalUploadAllowed(file(`peca.${extension}`, 'application/octet-stream', pdf), 'local'), /CAD aguarda/);
  }
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.exe', 'application/octet-stream', pdf), 'local'), /não autorizado/);
  await assert.rejects(assertTechnicalUploadAllowed(file('../peca.pdf', 'application/pdf', pdf), 'local'), /Nome de arquivo inválido/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'image/png', pdf), 'local'), /Tipo do arquivo/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'application/pdf', png), 'local'), /Assinatura/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'application/pdf', pdf, 0), 'local'), /vazio/);
  await assert.rejects(assertTechnicalUploadAllowed(file('peca.pdf', 'application/pdf', pdf, TECHNICAL_UPLOAD_MAX_BYTES + 1), 'local'), /10 MB/);
});

test('upload exige origem explícita e rejeita destinos internos e URL temporária', () => {
  assert.equal(assertConfirmedTechnicalUploadUrl('https://storage.example.test/projects/p.pdf', ['https://storage.example.test']), 'https://storage.example.test/projects/p.pdf');
  assert.throws(() => assertConfirmedTechnicalUploadUrl('https://storage.example.test/projects/p.pdf'), /Upload sem confirmação/);
  for (const value of [undefined, '', 'local://projects/p.pdf', 'http://storage.example.test/p.pdf', 'https://user:secret@storage.example.test/p.pdf', 'https://localhost/p.pdf', 'https://127.0.0.1/p.pdf', 'https://172.16.0.1/p.pdf', 'https://0.0.0.0/p.pdf', 'https://[::1]/p.pdf', 'https://[fd00::1]/p.pdf', 'https://metadata.google.internal/p.pdf', 'https://storage.example.test/signed/token/p.pdf', 'https://storage.example.test/p.pdf?token=temporary']) {
    assert.throws(() => assertConfirmedTechnicalUploadUrl(value, ['https://storage.example.test', new URL(value || 'https://invalid.test').origin]), /Upload sem confirmação/);
  }
});

test('Pedido, Corte e Dobra e Portal usam a mesma validação antes de confirmar anexo', () => {
  for (const path of [
    'src/components/comercial/ArquivosProjetosTab.jsx',
    'src/components/comercial/CorteDobraIATab.jsx',
    'src/components/portal/UploadProjetos.jsx',
    'src/components/portal/SolicitarOrcamento.jsx',
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /assertTechnicalUploadAllowed\(file\)/);
    assert.match(source, /assertConfirmedTechnicalUploadUrl\(file_url\)/);
  }
  const corte = readFileSync(new URL('../src/components/comercial/CorteDobraIATab.jsx', import.meta.url), 'utf8');
  assert.match(corte, /tipo_arquivo: tipoArquivo/);
  assert.match(corte, /assertTechnicalAiProcessingAllowed\(\)/);
  const tabs = readFileSync(new URL('../src/components/comercial/pedido/PedidoTabsContainer.jsx', import.meta.url), 'utf8');
  assert.match(tabs, /<ProtectedSection module="Comercial" section="Pedidos" action="editar"/);
  const site = readFileSync(new URL('../src/components/site/OrcamentoAutomaticoIA.jsx', import.meta.url), 'utf8');
  assert.match(site, /await assertTechnicalUploadAllowed\(dados\.arquivo\);\s*assertTechnicalAiProcessingAllowed\(\);\s*const uploadResult/);
  assert.match(site, /assertConfirmedTechnicalUploadUrl\(uploadResult\.file_url\)/);
});
