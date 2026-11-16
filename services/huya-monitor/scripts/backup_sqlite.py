#!/usr/bin/env python3
"""Consistent SQLite backups, including rows committed in WAL mode.

The source database is never modified. If backup/integrity verification fails,
the partial copy is deleted. Keeps the latest N daily backups.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def backup_db(database: Path, directory: Path, keep: int = 14) -> Path:
    if not database.is_file():
        raise FileNotFoundError(f"Database does not exist: {database}")
    if keep < 1 or keep > 365:
        raise ValueError('keep must be 1..365')
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    final = directory / f'huya-156324-{stamp}.sqlite3'
    if final.exists():
        raise FileExistsError(f"Backup already exists: {final}")
    fd, temp_name = tempfile.mkstemp(prefix='.huya-backup-', suffix='.sqlite3', dir=directory)
    os.close(fd)
    partial = Path(temp_name)
    try:
        with sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True, timeout=15) as src:
            with sqlite3.connect(partial, timeout=15) as dest:
                src.backup(dest, pages=256, sleep=0.1)
                integrity = dest.execute('PRAGMA integrity_check').fetchone()[0]
                if integrity != 'ok':
                    raise RuntimeError(f'SQLite integrity_check: {integrity}')
        os.chmod(partial, 0o600)
        partial.replace(final)
        for old in sorted(directory.glob('huya-156324-*.sqlite3'), reverse=True)[keep:]:
            old.unlink()
        return final
    finally:
        partial.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--directory', required=True, type=Path)
    parser.add_argument('--keep', type=int, default=14)
    args = parser.parse_args()
    result = backup_db(args.database, args.directory, args.keep)
    print(f'Consistent backup: {result}')


if __name__ == '__main__':
    main()
