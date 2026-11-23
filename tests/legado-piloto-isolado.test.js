import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolationDescriptor } from '../scripts/legado/pilot-isolated.mjs';

const root = '/private/synthetic-pilot';
const expected = { name: 'synthetic', batchId: 'synthetic-batch', image: 'sha256:synthetic', privateRoot: root };
const descriptor = () => ({ Name: '/synthetic', Image: expected.image,
  Config: { Labels: { 'erp.legacy.pilot': expected.batchId } },
  HostConfig: { NetworkMode: 'none', Privileged: false, ReadonlyRootfs: true, PortBindings: {} },
  Mounts: [{ Type: 'bind', Source: root + '/pgdata' }, { Type: 'bind', Source: root + '/socket' }] });

test('piloto aceita somente descritor isolado', () => {
  assert.deepEqual(assertIsolationDescriptor(descriptor(), expected), {
    network: 'none', publishedPorts: 0, privileged: false, readOnlyRoot: true,
    privateMountsOnly: true, imagePinned: true,
  });
});

for (const [name, change] of [
  ['rede', d => { d.HostConfig.NetworkMode = 'bridge'; }],
  ['porta', d => { d.HostConfig.PortBindings = { '5432/tcp': [{}] }; }],
  ['privilegio', d => { d.HostConfig.Privileged = true; }],
  ['root gravavel', d => { d.HostConfig.ReadonlyRootfs = false; }],
  ['montagem externa', d => { d.Mounts[0].Source = '/operational'; }],
  ['montagem com separador Windows', d => { d.Mounts[0].Source = root.replaceAll('/', '\\') + '\\pgdata'; }],
  ['montagem adicional', d => { d.Mounts.push({ Type: 'volume', Source: '/other' }); }],
  ['imagem diferente', d => { d.Image = 'sha256:other'; }],
  ['lote diferente', d => { d.Config.Labels['erp.legacy.pilot'] = 'other'; }],
  ['container diferente', d => { d.Name = '/other'; }],
]) {
  test('piloto rejeita ' + name, () => {
    const d = descriptor(); change(d);
    assert.throws(() => assertIsolationDescriptor(d, expected), /ISOLATION_DESCRIPTOR_INVALID/);
  });
}
