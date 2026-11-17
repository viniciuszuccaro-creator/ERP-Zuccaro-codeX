#!/usr/bin/env python3
"""Verify public ITI root CRLs against the already pinned official catalog; never activate trust."""
import datetime
import hashlib
import json
import pathlib
import ssl
import sys
import tempfile
import urllib.request

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('redirect refused')


def verify(catalog, entry, now, opener):
    version = next(v for v in (5, 6, 10, 11, 12)
                   if entry['subject'].endswith('Brasileira v' + str(v)))
    source = 'https://acraiz.icpbrasil.gov.br/LCRacraizv' + str(version) + '.crl'
    path = catalog / 'catalog-input' / entry['file']
    if path.parent != catalog / 'catalog-input' or path.is_symlink():
        raise ValueError('invalid catalog path')
    raw = path.read_bytes()
    root = x509.load_pem_x509_certificate(raw) if b'-----BEGIN' in raw else x509.load_der_x509_certificate(raw)
    if root.fingerprint(hashes.SHA256()).hex() != entry['fingerprint']:
        raise ValueError('catalog fingerprint mismatch')
    with opener.open(source, timeout=20) as response:
        if response.status != 200 or response.url != source:
            raise ValueError('unexpected HTTP response')
        data = response.read(4000001)
    if not 0 < len(data) <= 4000000:
        raise ValueError('CRL size limit')
    crl = x509.load_der_x509_crl(data)
    if crl.issuer != root.subject or not crl.is_signature_valid(root.public_key()):
        raise ValueError('CRL signature or issuer rejected')
    start = crl.last_update.replace(tzinfo=datetime.timezone.utc)
    end = crl.next_update.replace(tzinfo=datetime.timezone.utc) if crl.next_update else None
    if end is None or not start <= now < end or end - start > datetime.timedelta(days=90):
        raise ValueError('CRL outside official publication interval')
    pem = crl.public_bytes(serialization.Encoding.PEM)
    return data, pem, {'version': version, 'source': source, 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(), 'rootFingerprint': entry['fingerprint'],
        'thisUpdate': start.isoformat(), 'nextUpdate': end.isoformat(),
        'issuerAndSignatureVerified': True}


def main():
    catalog = pathlib.Path(sys.argv[1]).resolve(strict=True)
    destination = pathlib.Path(sys.argv[2])
    if not destination.is_absolute() or destination.exists():
        raise ValueError('new absolute destination required')
    manifest = json.loads((catalog / 'catalog-chains.private.json').read_text())
    roots = [e for e in manifest['entries'] if e['fingerprint'] in manifest['roots']]
    if len(roots) != 5 or len(set(e['fingerprint'] for e in roots)) != 5:
        raise ValueError('expected five reviewed roots')
    now = datetime.datetime.now(datetime.timezone.utc)
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    destination.mkdir(mode=0o700)
    result = {'retrievedAt': now.isoformat(), 'activated': False, 'scope': 'ROOT_CRLS_ONLY',
        'intermediateAndLeafCoverageProven': False, 'verified': [], 'rejected': []}
    for entry in roots:
        try:
            der, pem, receipt = verify(catalog, entry, now, opener)
            stem = 'root-v' + str(receipt['version'])
            for suffix, content in (('.crl', der), ('.pem', pem)):
                with (destination / (stem + suffix)).open('xb') as handle:
                    handle.write(content)
            result['verified'].append(receipt)
        except Exception as error:
            result['rejected'].append({'rootFingerprint': entry['fingerprint'], 'errorType': type(error).__name__})
    with (destination / 'receipt.private.json').open('x') as handle:
        json.dump(result, handle, indent=2)
    print(json.dumps({'verified': len(result['verified']), 'rejected': len(result['rejected']),
        'activated': False, 'scope': result['scope']}))
    return 1 if result['rejected'] else 0


def self_test():
    now = datetime.datetime.now(datetime.timezone.utc)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'SYNTHETIC ROOT NOT ICP')])
    root = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1).not_valid_before(now - datetime.timedelta(days=1)).not_valid_after(now + datetime.timedelta(days=100)).sign(key, hashes.SHA256())
    crl = x509.CertificateRevocationListBuilder().issuer_name(name).last_update(now - datetime.timedelta(days=30)).next_update(now + datetime.timedelta(days=30)).sign(key, hashes.SHA256())
    data = crl.public_bytes(serialization.Encoding.DER)

    class Response:
        status = 200
        url = 'https://acraiz.icpbrasil.gov.br/LCRacraizv11.crl'

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self, limit):
            return data[:limit]

    class Offline:
        def open(self, source, timeout):
            assert source == Response.url and timeout == 20
            return Response()

    with tempfile.TemporaryDirectory(prefix='a1-public-crl-synthetic-') as directory:
        catalog = pathlib.Path(directory)
        (catalog / 'catalog-input').mkdir()
        (catalog / 'catalog-input' / 'root.cert').write_bytes(root.public_bytes(serialization.Encoding.PEM))
        entry = {'subject': 'SYNTHETIC Brasileira v11', 'file': 'root.cert', 'fingerprint': root.fingerprint(hashes.SHA256()).hex()}
        assert verify(catalog, entry, now, Offline())[2]['issuerAndSignatureVerified']
        for bad_entry, at in (({**entry, 'fingerprint': '0' * 64}, now), (entry, now + datetime.timedelta(days=31))):
            try:
                verify(catalog, bad_entry, at, Offline())
            except ValueError:
                pass
            else:
                raise AssertionError('negative accepted')
        data = data[:-1] + bytes([data[-1] ^ 1])
        try:
            verify(catalog, entry, now, Offline())
        except ValueError:
            pass
        else:
            raise AssertionError('altered signature accepted')
    print('A1_ROOT_CRL_SELF_TEST_PASS synthetic offline pin=expiry=signature')
    return 0


if __name__ == '__main__':
    sys.exit(self_test() if sys.argv[1:] == ['--self-test'] else main())
