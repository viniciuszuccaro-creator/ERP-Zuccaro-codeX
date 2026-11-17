"""Synthetic transport and checksum tests; no database or credentials required."""
import hashlib
import importlib.util
import io
import os
import pathlib
import threading
import tracemalloc
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', pathlib.Path('scripts/vps/hml-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class StreamingProof(unittest.TestCase):
    def test_historical_array_and_empty_checksums(self):
        rows = [b'{"a": null}', '{"a": "á, 001"}'.encode(), b'{"a": [true, 1.20]}']
        expected = hashlib.md5(b'[' + b', '.join(rows) + b']', usedforsecurity=False).hexdigest()
        self.assertEqual(backup.row_proof(iter(rows)), {'count': 3, 'content': expected})
        self.assertEqual(backup.row_proof(iter([])), {'count': 0, 'content': hashlib.md5(b'null', usedforsecurity=False).hexdigest()})
        with self.assertRaisesRegex(RuntimeError, 'ROW_INVALID'):
            backup.row_proof(iter([b'ERROR: incomplete response']))
        with self.assertRaisesRegex(RuntimeError, 'TABLE_IDENTIFIER'):
            backup.table_rows_query('hml_test', 'x;drop table y')

    def test_large_iterator_does_not_materialize(self):
        row = b'{"value":"' + b'x' * 4096 + b'"}'
        tracemalloc.start()
        result = backup.row_proof(row for _ in range(10000))
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        self.assertEqual(result['count'], 10000)
        self.assertLess(peak, 1024 * 1024)

    def transport(self, payload):
        reader, writer = os.pipe()
        snapshot = backup.Snapshot.__new__(backup.Snapshot)
        snapshot.buffer = bytearray()
        snapshot.process = types.SimpleNamespace(stdin=io.BytesIO(), stdout=os.fdopen(reader, 'rb', buffering=0))
        def send():
            try:
                # Arbitrary chunks may split UTF-8 and line boundaries.
                for start in range(0, len(payload), 3):
                    os.write(writer, payload[start:start + 3])
            finally:
                os.close(writer)
        thread = threading.Thread(target=send)
        thread.start()
        return snapshot, thread

    def test_marker_and_buffered_following_line(self):
        row = '{"value": "á"}'.encode()
        snapshot, thread = self.transport(row + b'\nERP_PROOF_fixed\nTAIL\n')
        try:
            with patch.object(backup.uuid, 'uuid4', return_value=types.SimpleNamespace(hex='fixed')):
                self.assertEqual(list(snapshot.rows('SELECT synthetic')), [row])
            self.assertEqual(snapshot.line(), b'TAIL')
        finally:
            snapshot.process.stdout.close()
            thread.join(timeout=2)
        self.assertFalse(thread.is_alive())

    def test_eof_without_marker_is_not_empty_success(self):
        snapshot, thread = self.transport(b'{"value": 1}\n')
        try:
            with self.assertRaisesRegex(RuntimeError, 'SNAPSHOT_READ_FAILED'):
                list(snapshot.rows('SELECT synthetic'))
        finally:
            snapshot.process.stdout.close()
            thread.join(timeout=2)
        self.assertFalse(thread.is_alive())


if __name__ == '__main__':
    unittest.main()
