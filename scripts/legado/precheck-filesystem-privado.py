"""Metadata-only inspection of the already-authorized private staging filesystem."""
import argparse
import json
import os
from pathlib import Path
import socket
import stat


def inspect_private_filesystem(root, expected_host, allowed_parent='/root/erp-private', application='/opt/erp-zuccaro'):
    if socket.gethostname() != expected_host:
        raise ValueError('HOST_IDENTITY_MISMATCH')
    source = Path(root)
    if not source.is_absolute() or source == Path(allowed_parent):
        raise ValueError('PRIVATE_DESTINATION_REQUIRED')
    for part in [source, *source.parents]:
        if part.is_symlink():
            raise ValueError('SYMLINK_DESTINATION_DENIED')
    resolved = source.resolve(strict=True)
    parent = Path(allowed_parent).resolve(strict=True)
    app = Path(application).resolve()
    if parent not in resolved.parents or app == resolved or app in resolved.parents:
        raise ValueError('PRIVATE_DESTINATION_SCOPE_DENIED')
    info = resolved.stat()
    if not stat.S_ISDIR(info.st_mode):
        raise ValueError('PRIVATE_DIRECTORY_REQUIRED')
    if info.st_mode & 0o077:
        raise ValueError('PRIVATE_DIRECTORY_PERMISSIONS_REQUIRED')
    if (resolved / '.git').exists():
        raise ValueError('PRIVATE_DATA_NOT_GIT_REQUIRED')
    capacity = os.statvfs(resolved)
    return {'status': 'READ_ONLY_VERIFIED', 'hostIdentityMatched': True,
            'destination': str(resolved), 'mode': oct(stat.S_IMODE(info.st_mode)),
            'ownerUid': info.st_uid, 'device': info.st_dev,
            'freeBytes': str(capacity.f_bavail * capacity.f_frsize),
            'freeInodes': str(capacity.f_favail), 'outsideApplication': True,
            'gitAbsent': True, 'inspectedDirectories': 1,
            'capacityScope': 'PRIVATE_STAGING_FILESYSTEM_ONLY',
            'operationalDatabaseCapacityVerified': False, 'databaseAccess': False,
            'writeProbePerformed': False, 'filesRead': 0, 'filesChanged': 0,
            'serviceChanges': 0, 'recoveryEvidence': 'REUSE_PREVIOUS_VERIFIED_RECEIPT'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--expected-host', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(inspect_private_filesystem(args.root, args.expected_host)))
    except (OSError, ValueError) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error) if isinstance(error, ValueError) else 'FILESYSTEM_UNAVAILABLE'}))
        raise SystemExit(1)
