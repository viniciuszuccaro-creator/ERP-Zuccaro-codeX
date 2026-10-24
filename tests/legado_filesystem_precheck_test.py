import importlib.util
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('precheck', Path(__file__).parents[1] / 'scripts' / 'legado' / 'precheck-filesystem-privado.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrivateFilesystemTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.parent = Path(self.temp.name)
        self.root = self.parent / 'private'
        self.root.mkdir(mode=0o700)
        self.app = self.parent / 'application'

    def tearDown(self):
        self.temp.cleanup()

    def run_check(self, root=None):
        return module.inspect_private_filesystem(str(root or self.root), socket.gethostname(), str(self.parent), str(self.app))

    def test_real_filesystem_capacity_without_reading_contents_or_writing(self):
        secret = self.root / '.env'
        secret.write_text('SYNTHETIC_ONLY')
        before = secret.stat()
        with patch('builtins.open', side_effect=AssertionError('CONTENTS_MUST_NOT_BE_READ')):
            result = self.run_check()
        self.assertGreater(int(result['freeBytes']), 0)
        self.assertEqual(result['filesRead'], 0)
        self.assertEqual(result['filesChanged'], 0)
        self.assertFalse(result['operationalDatabaseCapacityVerified'])
        self.assertEqual(secret.stat().st_mtime_ns, before.st_mtime_ns)

    def test_host_identity_must_match_before_filesystem_access(self):
        with self.assertRaisesRegex(ValueError, 'HOST_IDENTITY_MISMATCH'):
            module.inspect_private_filesystem(str(self.root), 'SYNTHETIC_WRONG_HOST')

    def test_foreign_destination_is_denied(self):
        with tempfile.TemporaryDirectory() as foreign:
            with self.assertRaisesRegex(ValueError, 'SCOPE_DENIED'):
                self.run_check(Path(foreign))

    def test_application_destination_is_denied(self):
        self.app.mkdir(mode=0o700)
        with self.assertRaisesRegex(ValueError, 'SCOPE_DENIED'):
            self.run_check(self.app)

    def test_symlink_and_group_readable_paths_are_denied(self):
        link = self.parent / 'link'
        link.symlink_to(self.root)
        with self.assertRaisesRegex(ValueError, 'SYMLINK'):
            self.run_check(link)
        self.root.chmod(0o750)
        with self.assertRaisesRegex(ValueError, 'PERMISSIONS'):
            self.run_check()

    def test_private_staging_cannot_be_git_checkout(self):
        (self.root / '.git').mkdir()
        with self.assertRaisesRegex(ValueError, 'NOT_GIT'):
            self.run_check()


if __name__ == '__main__':
    unittest.main()
