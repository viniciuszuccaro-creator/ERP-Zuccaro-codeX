"""Private HML backup helper for the existing backup entry point; no operational defaults."""
import argparse
import contextlib
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import selectors
import shutil
import subprocess
import tarfile
import tempfile
import uuid

NAME = re.compile(r'hml-\d{8}T\d{6}Z-[a-f0-9]{8}')
IDENT = re.compile(r'[a-z][a-z0-9_]*')


def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)


def digest(file):
    h = hashlib.sha256()
    with open(file, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def private(file, uid=None):
    p = pathlib.Path(file)
    s = p.lstat()
    require(p.resolve() == p and p.is_file() and not p.is_symlink(), 'PRIVATE_FILE_PATH')
    require(s.st_uid == (os.getuid() if uid is None else uid) and s.st_mode & 0o077 == 0,
            'PRIVATE_FILE_MODE_OWNER')
    return p


def write_json(file, value):
    fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf8') as stream:
        json.dump(value, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())


def validate_config(c):
    require(set(c) == {'container', 'containerId', 'image', 'database', 'schema', 'cluster',
                       'adminEnv', 'appConfig', 'backupDir', 'pgdata', 'keep'}, 'CONFIG_KEYS')
    require(c['container'] == 'erp-hml-pg' and re.fullmatch('[a-f0-9]{64}', c['containerId']), 'HML_CONTAINER')
    require(re.fullmatch('sha256:[a-f0-9]{64}', c['image']), 'IMAGE_PIN')
    for key in ['database', 'schema']:
        require(re.fullmatch('hml[a-z0-9_]+', c[key]), 'HML_DATABASE_SCHEMA')
    require(re.fullmatch('[0-9]+', c['cluster']), 'CLUSTER_PIN')
    require(type(c['keep']) is int and 2 <= c['keep'] <= 30, 'RETENTION_LIMIT')
    root = pathlib.PurePosixPath('/root/erp-private/hml-recovery-20261114')
    for key in ['adminEnv', 'appConfig', 'backupDir', 'pgdata']:
        p = pathlib.PurePosixPath(c[key])
        require(root in p.parents and '..' not in p.parts and str(p) == c[key], 'PRIVATE_TARGET_PATH')
    require(pathlib.Path(c['backupDir']).name == 'scheduled-backups', 'MANAGED_BACKUP_DIR')
    require(pathlib.Path(c['pgdata']).name == 'pgdata-restored', 'HML_VOLUME')
    return c


def read_config(file):
    c = validate_config(json.loads(private(file).read_text()))
    for key in ['adminEnv', 'appConfig', 'backupDir', 'pgdata']:
        p = pathlib.Path(c[key])
        require(p.resolve() == p and not p.is_symlink(), 'PRIVATE_TARGET_PATH')
    return c


def command(args, data=None, output=None):
    p = subprocess.run(args, input=data, stdout=output if output is not None else subprocess.PIPE,
                       stderr=subprocess.PIPE, timeout=180)
    require(p.returncode == 0, 'BACKUP_COMMAND_FAILED_' + pathlib.Path(args[0]).name)
    return p.stdout


class Database:
    def __init__(self, config):
        self.c = config
        v = json.loads(command(['docker', 'inspect', config['container']]))[0]
        require(v['Id'] == config['containerId'] and v['Image'] == config['image']
                and v['State']['Running'], 'CONTAINER_IDENTITY')
        require(v['HostConfig']['NetworkMode'] == 'none' and not v['HostConfig']['PortBindings'], 'PG_ISOLATION')
        require(0 < v['HostConfig']['Memory'] <= 1073741824
                and 0 < v['HostConfig']['NanoCpus'] <= 400000000, 'PG_RESOURCE_LIMITS')
        require(any(m['Destination'] == '/var/lib/postgresql/data' and m['Source'] == config['pgdata']
                    for m in v['Mounts']), 'PG_VOLUME_IDENTITY')
        env = dict(line.split('=', 1) for line in private(config['adminEnv']).read_text().splitlines()
                   if line and not line.startswith('#') and '=' in line)
        self.user, self.password = env['POSTGRES_USER'], env['POSTGRES_PASSWORD']
        require(IDENT.fullmatch(self.user) and '\n' not in self.password, 'ADMIN_CONFIG')
        require(self.sql(config['database'], "SELECT system_identifier::text FROM pg_control_system()")
                == config['cluster'], 'PG_PHYSICAL_IDENTITY')

    def args(self, program, extra):
        return ['docker', 'exec', '-i', self.c['container'], 'sh', '-c',
                'IFS= read -r PGPASSWORD; export PGPASSWORD; '
                'export PGOPTIONS="-c statement_timeout=120000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=120000"; '
                'exec "$@"', '_', program,
                '-w', '-h', '/run/hml-pg', '-U', self.user, *extra]

    def run(self, program, extra, data=b'', output=None):
        return command(self.args(program, extra), (self.password + '\n').encode() + data, output)

    def sql(self, db, sql):
        return self.run('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db,
                                 '-c', sql]).decode().strip()


class Snapshot:
    def __init__(self, db):
        self.process = subprocess.Popen(db.args('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1',
            '-d', db.c['database']]), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True)
        try:
            self.process.stdin.write(db.password + '\n')
            self.token = self.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '
                                   "SET LOCAL statement_timeout='30s'; SELECT pg_export_snapshot()")
            require(re.fullmatch('[A-F0-9]+-[A-F0-9]+-[0-9]+', self.token), 'SNAPSHOT_TOKEN')
        except Exception:
            self.close()
            raise

    def query(self, sql):
        self.process.stdin.write(sql + ';\n')
        self.process.stdin.flush()
        with selectors.DefaultSelector() as selector:
            selector.register(self.process.stdout, selectors.EVENT_READ)
            require(selector.select(35), 'SNAPSHOT_READ_TIMEOUT')
        line = self.process.stdout.readline().strip()
        require(line, 'SNAPSHOT_READ_FAILED')
        return line

    def close(self):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()
        self.process.stdout.close()


def table_query(schema, table):
    require(IDENT.fullmatch(schema) and IDENT.fullmatch(table), 'TABLE_IDENTIFIER')
    return ("SELECT json_build_object('count',count(*),'content',md5(COALESCE("
            "jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'null'))) "
            f'FROM "{schema}"."{table}" t')


def verify_comparison(expected, actual):
    require(expected == actual, 'RESTORED_CONTENT_MISMATCH')


def items(root):
    found = []
    for file in sorted(root.glob('hml-*.json')):
        if file.name.endswith('.external.json'):
            continue
        name = file.stem
        require(NAME.fullmatch(name), 'BACKUP_NAME')
        m = json.loads(private(file).read_text())
        archive = private(root / (name + '.tar'))
        require(m['name'] == name and m['restoreVerified'] is True and archive.stat().st_size == m['bytes']
                and digest(archive) == m['sha256'], 'MANAGED_BACKUP_INTEGRITY')
        found.append(m)
    return found


def prune(root, keep):
    all_items = items(root)
    for item in all_items[:-keep]:
        ack = root / (item['name'] + '.external.json')
        if not ack.exists():
            continue
        a = json.loads(private(ack).read_text())
        require(a['sha256'] == item['sha256'] and a['bytes'] == item['bytes'], 'EXTERNAL_RECEIPT_MISMATCH')
        for suffix in ['.tar', '.external.json', '.json']:
            private(root / (item['name'] + suffix)).unlink()


def backup(c):
    root = pathlib.Path(c['backupDir'])
    lease = root.parent / 'deployment.lock'
    if lease.exists():
        require(json.loads(private(lease).read_text()).get('task') == 'hml-backup-retention', 'DEPLOYMENT_WRITER_ACTIVE')
    require(root.is_dir() and root.resolve() == root and root.stat().st_mode & 0o077 == 0
            and root.stat().st_uid == os.getuid(), 'BACKUP_DIRECTORY')
    require(shutil.disk_usage(root).free > 20 * 1024**3 + 256 * 1024**2, 'FREE_SPACE_RESERVE')
    import fcntl
    with open(root / '.writer.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        db = Database(c)
        size = int(db.sql(c['database'], "SELECT pg_database_size(current_database())"))
        require(shutil.disk_usage(root).free > 20 * 1024**3 + max(256 * 1024**2, size * 3), 'RECOVERY_SPACE_RESERVE')
        roles_query = ("SELECT md5(jsonb_build_object('roles',"
            "(SELECT jsonb_agg(to_jsonb(r) ORDER BY rolname) FROM pg_authid r), 'memberships',"
            "(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m))::text)")
        roles_before = db.sql(c['database'], roles_query)
        globals_sql = db.run('pg_dumpall', ['--globals-only'])
        name = 'hml-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
        verify_db = 'hml_backup_verify_' + uuid.uuid4().hex
        with tempfile.TemporaryDirectory(prefix='.building-', dir=root) as temp:
            temp = pathlib.Path(temp)
            with contextlib.closing(Snapshot(db)) as snapshot:
                schema = c['schema']
                tables = json.loads(snapshot.query("SELECT COALESCE(json_agg(table_name ORDER BY table_name),'[]') "
                    f"FROM information_schema.tables WHERE table_schema='{schema}' AND table_type='BASE TABLE'"))
                require(tables, 'NO_HML_TABLES')
                proofs = {t: json.loads(snapshot.query(table_query(schema, t))) for t in tables}
                with open(temp / 'database.dump', 'xb') as out:
                    db.run('pg_dump', ['-d', c['database'], '-Fc', '--lock-wait-timeout=5000',
                                      '--snapshot=' + snapshot.token], output=out)
            (temp / 'globals.sql').write_bytes(globals_sql)
            private(c['appConfig'], uid=1000)
            shutil.copyfile(c['appConfig'], temp / 'api-config.private.json')
            db.run('createdb', [verify_db])
            # Restore only a database just created by this run in the pinned isolated PG.
            db.run('pg_restore', ['-d', verify_db, '--single-transaction', '--exit-on-error'],
                   (temp / 'database.dump').read_bytes())
            for table, proof in proofs.items():
                verify_comparison(proof, json.loads(db.sql(verify_db, table_query(schema, table))))
            require(db.sql(c['database'], roles_query) == roles_before, 'GLOBAL_ROLES_CHANGED')
            db.run('dropdb', [verify_db])
            write_json(temp / 'recovery.private.json', {'database': c['database'], 'schema': schema,
                'cluster': c['cluster'], 'image': c['image'], 'proofs': proofs,
                'sourceSnapshot': snapshot.token, 'restoreVerified': True})
            pending = root / ('.' + name + '.partial')
            with tarfile.open(pending, 'w') as tar:
                for file in sorted(temp.iterdir()):
                    os.chmod(file, 0o600)
                    tar.add(file, arcname=file.name, recursive=False)
            os.chmod(pending, 0o600)
            archive = root / (name + '.tar')
            require(not archive.exists(), 'BACKUP_ALREADY_EXISTS')
            pending.rename(archive)
            receipt = {'name': name, 'bytes': archive.stat().st_size, 'sha256': digest(archive),
                       'restoreVerified': True, 'tables': len(proofs), 'source': 'isolated-hml',
                       'externalVerified': False}
            write_json(root / (name + '.json'), receipt)
        prune(root, c['keep'])
        print(json.dumps({'status': 'BACKUP_RESTORE_VERIFIED', 'name': name, 'tables': len(proofs),
                          'bytes': receipt['bytes'], 'externalVerified': False}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['--backup', '--list', '--ack'])
    parser.add_argument('config')
    parser.add_argument('name', nargs='?')
    parser.add_argument('sha256', nargs='?')
    # Operation names are positional to keep the private SSH command strict.
    args = parser.parse_args(['--', *(__import__('sys').argv[1:])])
    os.umask(0o077)
    c = read_config(args.config)
    root = pathlib.Path(c['backupDir'])
    if args.action == '--backup':
        backup(c)
    elif args.action == '--list':
        print(json.dumps(items(root)))
    else:
        require(NAME.fullmatch(args.name or '') and re.fullmatch('[a-f0-9]{64}', args.sha256 or ''), 'ACK_ARGUMENTS')
        match = [i for i in items(root) if i['name'] == args.name and i['sha256'] == args.sha256]
        require(len(match) == 1, 'ACK_UNKNOWN_BACKUP')
        ack = root / (args.name + '.external.json')
        value = {'sha256': args.sha256, 'bytes': match[0]['bytes'], 'destination': 'private-external-desktop'}
        if ack.exists():
            require(json.loads(private(ack).read_text()) == value, 'ACK_CONFLICT')
        else:
            write_json(ack, value)
        print('EXTERNAL_ACK_VERIFIED')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        reason = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print('HML_BACKUP_BLOCKED:' + reason, file=__import__('sys').stderr)
        raise SystemExit(1)
