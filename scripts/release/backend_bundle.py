"""Offline AZM backend release packaging and verification. No deploy or DB access."""
import argparse
import hashlib
import hmac
import json
import re
import subprocess
import tarfile
from pathlib import Path

REPO = "xxsoloxxleveling-sketch/AZMNEW"
PREFIX = "backend/prisma/migrations/"
HEX40 = re.compile(r"[0-9a-f]{40}\Z")
HEX64 = re.compile(r"[0-9a-f]{64}\Z")
NEW_MIGRATION = re.compile(r"(\d{14}_[a-z0-9_]+)/migration\.sql\Z")
MAX_BYTES = 64 * 1024 * 1024
MAX_FILES = 5000
ARCHIVE = "backend-release.tar.gz"
MANIFEST = "backend-release.json"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args])


def exact_commit(root, value):
    require(isinstance(value, str) and HEX40.fullmatch(value), "Full lowercase commit SHA required")
    require(git(root, "rev-parse", "--verify", value + "^{commit}").decode().strip() == value,
            "Commit identity mismatch")
    return value


def safe_path(name):
    require(isinstance(name, str) and name.startswith("backend/"), "Non-backend file")
    require("\\" not in name and not any(ord(c) < 32 or ord(c) == 127 for c in name),
            "Unsafe path characters")
    parts = name.split("/")
    require(all(p not in ("", ".", "..") for p in parts), "Unsafe path components")
    for part in parts:
        low = part.lower()
        require(low not in (".git", "node_modules") and
                (not low.startswith(".env") or low == ".env.example") and
                not low.endswith((".key", ".pem", ".p12", ".pfx", ".dump", ".bak")),
                "Credential or excluded path: " + name)
    return name


def tree(root, commit, path="backend"):
    entries = {}
    for row in git(root, "ls-tree", "-rz", commit, "--", path).split(b"\0"):
        if not row:
            continue
        meta, raw_name = row.split(b"\t", 1)
        mode, kind, blob = meta.decode("ascii").split()
        name = safe_path(raw_name.decode("utf-8"))
        require(kind == "blob" and mode in ("100644", "100755"), "Nonregular Git file: " + name)
        require(name not in entries, "Duplicate Git path")
        entries[name] = blob
    return entries


def archive_inventory(path):
    require(path.is_file() and 0 < path.stat().st_size <= MAX_BYTES, "Archive size out of range")
    hashes, git_blobs, seen = {}, {}, set()
    total = 0
    with tarfile.open(path, "r:gz") as tar:
        for member in tar:
            name = member.name.rstrip("/") if member.isdir() else member.name
            require(name == "backend" and member.isdir() or name.startswith("backend/"),
                    "Archive member outside backend")
            if name != "backend":
                safe_path(name)
            require(name not in seen, "Duplicate archive member")
            seen.add(name)
            require(len(seen) <= MAX_FILES, "Archive has too many members")
            if member.isdir():
                continue
            require(member.isfile() and not member.issparse(), "Archive contains a nonregular file")
            require(0 <= member.size <= MAX_BYTES - total, "Uncompressed archive exceeds size limit")
            stream = tar.extractfile(member)
            require(stream is not None, "Missing archive data")
            with stream:
                raw = stream.read(member.size + 1)
            require(len(raw) == member.size, "Truncated archive member")
            total += len(raw)
            hashes[name] = digest(raw)
            git_blobs[name] = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    require(bool(hashes), "Empty archive")
    for name in seen:
        parents = name.split("/")[:-1]
        for i in range(1, len(parents) + 1):
            require("/".join(parents[:i]) not in hashes, "File/directory collision")
    return hashes, git_blobs


def migrations(files):
    return {path: checksum for path, checksum in files.items() if path.startswith(PREFIX)}


def migration_plan(base, candidate):
    require(PREFIX + "0_init/migration.sql" in base and PREFIX + "migration_lock.toml" in base,
            "Missing baseline migration chain")
    for path, checksum in base.items():
        require(candidate.get(path) == checksum, "Historical migration changed or removed: " + path)
    previous = [p[len(PREFIX):].split("/", 1)[0] for p in base if p.endswith("/migration.sql")]
    added = sorted(set(candidate) - set(base))
    for path in added:
        match = NEW_MIGRATION.fullmatch(path[len(PREFIX):])
        require(match is not None, "Unexpected new migration file: " + path)
        require(match.group(1) > max(previous), "Migration is not appended after the historical chain")
    return [{"path": p, "sha256": candidate[p]} for p in added]


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def load_json(raw):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, "Duplicate manifest key")
            value[key] = item
        return value
    return json.loads(raw, object_pairs_hook=unique)


def create_bundle(root, base, source, out):
    exact_commit(root, base)
    exact_commit(root, source)
    subprocess.check_call(["git", "-C", str(root), "merge-base", "--is-ancestor", base, source])
    baseline = {p: digest(git(root, "show", base + ":" + p)) for p in tree(root, base, PREFIX)}
    source_tree = tree(root, source)
    require(bool(source_tree), "Backend tree missing")
    out.mkdir(parents=True, exist_ok=False)
    archive = out / ARCHIVE
    subprocess.check_call(["git", "-C", str(root), "-c", "core.autocrlf=false", "-c", "core.eol=lf",
                           "archive", "--format=tar.gz",
                           "--output=" + str(archive.resolve()), source, "backend"])
    files, blobs = archive_inventory(archive)
    require(blobs == source_tree, "Archive does not exactly match committed backend blobs")
    manifest = {
        "version": 1, "repository": REPO, "source_sha": source, "base_sha": base,
        "archive_sha256": digest(archive.read_bytes()), "files": files,
        "base_migrations": baseline,
        "added_migrations": migration_plan(baseline, migrations(files)),
    }
    raw = json_bytes(manifest)
    (out / MANIFEST).write_bytes(raw)
    return digest(raw)


def verify_bundle(directory, expected_base, expected_source, expected_manifest_sha):
    require(HEX40.fullmatch(expected_base) and HEX40.fullmatch(expected_source), "Exact expected SHAs required")
    require(HEX64.fullmatch(expected_manifest_sha), "Expected manifest SHA-256 required")
    manifest_path = directory / MANIFEST
    require(manifest_path.is_file() and 0 < manifest_path.stat().st_size <= MAX_BYTES, "Invalid manifest size")
    raw = manifest_path.read_bytes()
    require(hmac.compare_digest(digest(raw), expected_manifest_sha), "Manifest checksum mismatch")
    m = load_json(raw)
    require(isinstance(m, dict) and set(m) == {
        "version", "repository", "source_sha", "base_sha", "archive_sha256", "files",
        "base_migrations", "added_migrations"}, "Unexpected manifest fields")
    require(type(m["version"]) is int and m["version"] == 1 and m["repository"] == REPO,
            "Unsupported release manifest")
    require(m["source_sha"] == expected_source and m["base_sha"] == expected_base, "Release identity mismatch")
    archive = directory / ARCHIVE
    require(archive.is_file() and 0 < archive.stat().st_size <= MAX_BYTES, "Invalid archive size")
    require(isinstance(m["archive_sha256"], str) and HEX64.fullmatch(m["archive_sha256"]) and
            hmac.compare_digest(digest(archive.read_bytes()), m["archive_sha256"]), "Archive checksum mismatch")
    files, _ = archive_inventory(archive)
    require(files == m["files"], "File inventory mismatch")
    baseline = m["base_migrations"]
    require(isinstance(baseline, dict) and all(
        p.startswith(PREFIX) and isinstance(v, str) and HEX64.fullmatch(v)
        for p, v in baseline.items()), "Invalid baseline migration inventory")
    require(migration_plan(baseline, migrations(files)) == m["added_migrations"], "Migration plan mismatch")
    return m


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    for action in ("package", "verify"):
        cmd = sub.add_parser(action)
        cmd.add_argument("--base", required=True)
        cmd.add_argument("--source", required=True)
        cmd.add_argument("--directory", required=True, type=Path)
        if action == "package":
            cmd.add_argument("--repo", type=Path, default=Path.cwd())
        else:
            cmd.add_argument("--expected-manifest-sha256", required=True)
    args = parser.parse_args()
    if args.action == "package":
        print(create_bundle(args.repo, args.base, args.source, args.directory))
    else:
        m = verify_bundle(args.directory, args.base, args.source, args.expected_manifest_sha256)
        print("VERIFIED_OFFLINE", m["source_sha"], "new migrations:", len(m["added_migrations"]))


if __name__ == "__main__":
    main()
