import io
import json
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

from backend_bundle import ARCHIVE, MANIFEST, archive_inventory, create_bundle, digest, verify_bundle


class ReleaseBundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("config", "user.name", "Synthetic release fixture")
        self.git("config", "core.autocrlf", "false")
        self.write("backend/prisma/migrations/0_init/migration.sql", "SELECT 1;\n")
        self.write("backend/prisma/migrations/20261123160000_example/migration.sql", "SELECT 2;\n")
        self.write("backend/prisma/migrations/migration_lock.toml", 'provider = "postgresql"\n')
        self.write("backend/prisma/migrations/.gitkeep", "")
        self.write("backend/.env.example", "EXAMPLE=not-a-secret\n")
        self.write("backend/package.json", "{}\n")
        self.base = self.commit()
        self.write("backend/prisma/migrations/20261124120000_new/migration.sql", "SELECT 3;\n")
        self.source = self.commit()
        self.out = self.root / "bundle"

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args])

    def write(self, name, content):
        p = self.repo / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(content.encode())

    def commit(self):
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "Synthetic change")
        return self.git("rev-parse", "HEAD").decode().strip()

    def package(self, source=None):
        return create_bundle(self.repo, self.base, source or self.source, self.out)

    def verify(self, sha, base=None, source=None):
        return verify_bundle(self.out, base or self.base, source or self.source, sha)

    def test_exact_bundle_with_append_only_migration(self):
        # Dirty working tree does not become part of the immutable Git archive.
        self.write("backend/package.json", "UNCOMMITTED")
        sha = self.package()
        result = self.verify(sha)
        self.assertEqual(result["files"]["backend/package.json"], digest(b"{}\n"))
        self.assertEqual(result["source_sha"], self.source)
        self.assertEqual(result["added_migrations"], [{
            "path": "backend/prisma/migrations/20261124120000_new/migration.sql",
            "sha256": digest(b"SELECT 3;\n"),
        }])

    def test_windows_autocrlf_does_not_change_archive(self):
        self.git("config", "core.autocrlf", "true")
        sha = self.package()
        self.assertEqual(self.verify(sha)["files"]["backend/package.json"], digest(b"{}\n"))

    def test_no_change_release(self):
        sha = self.package(self.base)
        self.assertEqual(self.verify(sha, source=self.base)["added_migrations"], [])

    def test_modified_historical_migration_rejected(self):
        self.write("backend/prisma/migrations/0_init/migration.sql", "SELECT 99;\n")
        with self.assertRaisesRegex(ValueError, "Historical migration"):
            self.package(self.commit())

    def test_deleted_historical_migration_rejected(self):
        (self.repo / "backend/prisma/migrations/0_init/migration.sql").unlink()
        with self.assertRaisesRegex(ValueError, "Historical migration"):
            self.package(self.commit())

    def test_older_inserted_migration_rejected(self):
        self.write("backend/prisma/migrations/20260101000000_older/migration.sql", "SELECT 4;\n")
        with self.assertRaisesRegex(ValueError, "not appended"):
            self.package(self.commit())

    def test_unsupported_migration_file_rejected(self):
        self.write("backend/prisma/migrations/20261125120000_extra/note.txt", "unexpected")
        with self.assertRaisesRegex(ValueError, "Unexpected new migration"):
            self.package(self.commit())

    def test_private_env_rejected(self):
        self.write("backend/.env", "SYNTHETIC=fixture-only\n")
        with self.assertRaisesRegex(ValueError, "excluded path"):
            self.package(self.commit())

    def test_archive_tamper_rejected(self):
        sha = self.package()
        with (self.out / ARCHIVE).open("ab") as f:
            f.write(b"tampering")
        with self.assertRaisesRegex(ValueError, "Archive checksum"):
            self.verify(sha)

    def test_manifest_tamper_rejected(self):
        sha = self.package()
        path = self.out / MANIFEST
        data = json.loads(path.read_bytes())
        data["source_sha"] = self.base
        path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Manifest checksum"):
            self.verify(sha)

    def test_wrong_expected_source_rejected(self):
        sha = self.package()
        with self.assertRaisesRegex(ValueError, "Release identity"):
            self.verify(sha, source=self.base)

    def test_wrong_expected_base_rejected(self):
        sha = self.package()
        with self.assertRaisesRegex(ValueError, "Release identity"):
            self.verify(sha, base=self.source)

    def test_short_sha_rejected(self):
        with self.assertRaisesRegex(ValueError, "Full lowercase"):
            self.package(self.source[:7])

    def test_unsafe_tar_paths_rejected_without_extraction(self):
        for name in ("../outside", "backend/../outside", "/backend/file", "backend/.env"):
            path = self.root / "bad.tar.gz"
            with tarfile.open(path, "w:gz") as tar:
                entry = tarfile.TarInfo(name)
                entry.size = 1
                tar.addfile(entry, io.BytesIO(b"x"))
            with self.subTest(name=name), self.assertRaises(ValueError):
                archive_inventory(path)

    def test_tar_symlinks_rejected(self):
        path = self.root / "bad.tar.gz"
        with tarfile.open(path, "w:gz") as tar:
            entry = tarfile.TarInfo("backend/unsafe")
            entry.type = tarfile.SYMTYPE
            entry.linkname = "../outside"
            tar.addfile(entry)
        with self.assertRaisesRegex(ValueError, "nonregular"):
            archive_inventory(path)

    def test_duplicate_tar_member_rejected(self):
        path = self.root / "bad.tar.gz"
        with tarfile.open(path, "w:gz") as tar:
            for _ in range(2):
                entry = tarfile.TarInfo("backend/file")
                entry.size = 1
                tar.addfile(entry, io.BytesIO(b"x"))
        with self.assertRaisesRegex(ValueError, "Duplicate archive"):
            archive_inventory(path)


if __name__ == "__main__":
    unittest.main()
