import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomBytes, verify, X509Certificate } from 'node:crypto';

// Run only in a disposable canonical runtime image: no database, Auth secrets, ports or real certificate.
async function main() {
  assert.equal(process.platform, 'linux');
  assert.equal(process.getuid(), 1000);
  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(process.env.AUTH_DATABASE_URL, undefined);
  const { inspectA1Pkcs12, signValidatedA1Pkcs12 } = await import('/app/dist/services/a1Pkcs12Inspection.js');
  const { A1VaultEncryption } = await import('/app/dist/services/a1VaultEncryption.js');
  const { A1FileProtectionKeys } = await import('/app/dist/services/a1FileProtectionKeys.js');
  const directory = mkdtempSync(join(tmpdir(), 'erp-a1-runtime-synthetic-'));
  const password = Buffer.from('SYNTHETIC-RUNTIME-ONLY');
  const key = randomBytes(32);
  let pfx;
  try {
    const run = (args, input) => {
      const result = spawnSync('/usr/bin/openssl', args, { input, timeout: 15000, maxBuffer: 262144 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
    };
    run(['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1',
      '-subj', '/CN=SYNTHETIC-NOT-ICP-BRASIL', '-addext', 'basicConstraints=critical,CA:FALSE',
      '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem')]);
    run(['pkcs12', '-export', '-inkey', join(directory, 'key.pem'), '-in', join(directory, 'cert.pem'),
      '-out', join(directory, 'container.p12'), '-passout', 'stdin'], Buffer.concat([password, Buffer.from('\n')]));
    pfx = readFileSync(join(directory, 'container.p12'));
    const inspected = await inspectA1Pkcs12(pfx, password);
    assert.equal(inspected.trustVerified, false);
    assert.equal(inspected.identityVerified, false);
    assert.equal(inspected.revocationVerified, false);
    assert.equal(inspected.keyAlgorithm, 'rsa');
    const keyDirectory = join(directory, 'separate-key-mount-synthetic');
    mkdirSync(keyDirectory, { mode: 0o700 });
    writeFileSync(join(keyDirectory, 'synthetic.key'), key, { mode: 0o400 });
    const vault = new A1VaultEncryption(new A1FileProtectionKeys(keyDirectory, 'synthetic'));
    const scope = { groupId: '11111111-1111-4111-8111-111111111111', empresaId: '22222222-2222-4222-8222-222222222222',
      certificateId: '33333333-3333-4333-8333-333333333333', issuerCnpj: '00000000000000' };
    const envelope = await vault.seal(scope, pfx, password);
    const result = await vault.use(scope, envelope, async material => {
      assert.equal((await inspectA1Pkcs12(material.certificate, material.password)).fingerprintSha256, inspected.fingerprintSha256);
    });
    assert.equal(result, undefined);
    chmodSync(join(keyDirectory, 'synthetic.key'), 0o644);
    await assert.rejects(vault.use(scope, envelope, async () => assert.fail('unsafe permissions')));
    mkdirSync(join(directory, 'issued'));
    writeFileSync(join(directory, 'index'), ''); writeFileSync(join(directory, 'serial'), '1000\n');
    writeFileSync(join(directory, 'ca.cnf'), `[ca]\ndefault_ca=authority\n[authority]\ndatabase=${directory}/index\nnew_certs_dir=${directory}/issued\ncertificate=${directory}/root.pem\nprivate_key=${directory}/root.key\nserial=${directory}/serial\ndefault_md=sha256\ndefault_days=1\ndefault_crl_days=1\npolicy=subject\n[subject]\ncommonName=supplied\n`);
    run(['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-days', '1', '-subj', '/CN=SYNTHETIC-TRUST-NOT-ICP-BRASIL',
      '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
      '-addext', 'subjectKeyIdentifier=hash', '-keyout', join(directory, 'root.key'), '-out', join(directory, 'root.pem')]);
    run(['req', '-new', '-key', join(directory, 'key.pem'), '-subj', '/CN=SYNTHETIC-LEGAL-ENTITY', '-out', join(directory, 'leaf.csr')]);
    writeFileSync(join(directory, 'leaf.ext'), '[leaf]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\nsubjectAltName=otherName:2.16.76.1.3.3;PRINTABLESTRING:11222333000181\ncertificatePolicies=2.16.76.1.2.1.999999\n');
    run(['ca', '-batch', '-config', join(directory, 'ca.cnf'), '-in', join(directory, 'leaf.csr'), '-out', join(directory, 'leaf.pem'),
      '-notext', '-extfile', join(directory, 'leaf.ext'), '-extensions', 'leaf']);
    run(['ca', '-config', join(directory, 'ca.cnf'), '-gencrl', '-out', join(directory, 'root.crl')]);
    run(['pkcs12', '-export', '-inkey', join(directory, 'key.pem'), '-in', join(directory, 'leaf.pem'), '-certfile', join(directory, 'root.pem'),
      '-out', join(directory, 'trusted.p12'), '-passout', 'stdin'], Buffer.concat([password, Buffer.from('\n')]));
    pfx.fill(0); pfx = readFileSync(join(directory, 'trusted.p12'));
    const rootsPem = readFileSync(join(directory, 'root.pem'));
    const validation = { issuerCnpj: '11222333000181', trust: { version: 'synthetic-only', rootsPem,
      rootFingerprints: [new X509Certificate(rootsPem).fingerprint256.replaceAll(':', '').toLowerCase()],
      crlsPem: readFileSync(join(directory, 'root.crl')), allowedPolicies: ['2.16.76.1.2.1.999999'],
      validUntil: new Date(Date.now() + 86400000).toISOString(), maxCrlAgeMs: 86400000 } };
    const checked = await inspectA1Pkcs12(pfx, password, { validation });
    assert.ok(checked.identityVerified && checked.trustVerified && checked.revocationVerified);
    const payload = Buffer.from('SYNTHETIC-SIGNED-DOCUMENT');
    const signed = await signValidatedA1Pkcs12(pfx, password, payload, { validation });
    assert.ok(verify('RSA-SHA256', payload, new X509Certificate(readFileSync(join(directory, 'leaf.pem'))).publicKey, signed.signature));
    run(['ca', '-config', join(directory, 'ca.cnf'), '-revoke', join(directory, 'leaf.pem')]);
    run(['ca', '-config', join(directory, 'ca.cnf'), '-gencrl', '-out', join(directory, 'root.crl')]);
    validation.trust.crlsPem = readFileSync(join(directory, 'root.crl'));
    await assert.rejects(inspectA1Pkcs12(pfx, password, { validation }));
    console.log('A1_RUNTIME_SMOKE_PASS user=node parser=file_key=chain=crl=signature=real revoked=deny trust=SYNTHETIC_ONLY');
  } finally {
    password.fill(0); key.fill(0); pfx?.fill(0);
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(directory.includes('erp-a1-runtime-synthetic-'));
    rmSync(directory, { recursive: true });
  }
}
main().catch(() => { console.error('A1_RUNTIME_SMOKE_FAILED'); process.exitCode = 1; });
