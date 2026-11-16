from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from backup_sqlite import backup_db


def test_backup_database_with_uncheckpointed_wal(tmp_path):
    database = tmp_path / 'monitor.sqlite3'
    backups = tmp_path / 'backups'
    db = sqlite3.connect(database)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA wal_autocheckpoint=0')
    db.execute('CREATE TABLE rows (value TEXT NOT NULL)')
    db.execute('INSERT INTO rows VALUES (?)', ('猫咪🍡',))
    db.commit()
    assert database.with_suffix('.sqlite3-wal').exists()
    saved = backup_db(database, backups)
    with sqlite3.connect(saved) as snapshot:
        assert snapshot.execute('SELECT value FROM rows').fetchall() == [('猫咪🍡',)]
        assert snapshot.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    db.close()


def test_refuses_missing_database_without_artifact(tmp_path):
    try:
        backup_db(tmp_path / 'missing.sqlite3', tmp_path / 'backups')
        assert False, 'Expected FileNotFoundError'
    except FileNotFoundError:
        pass
    assert not list(tmp_path.rglob('*.sqlite3'))


def test_pruning_keeps_recent_backups(tmp_path):
    database = tmp_path / 'monitor.sqlite3'
    with sqlite3.connect(database) as db:
        db.execute('CREATE TABLE x (n INTEGER)')
    backups = tmp_path / 'backups'
    backups.mkdir()
    for day in range(1, 8):
        (backups / f'huya-156324-202611{day:02d}T000000Z.sqlite3').write_bytes(b'old')
    saved = backup_db(database, backups, keep=3)
    assert saved.exists()
    assert len(list(backups.glob('huya-156324-*.sqlite3'))) == 3
    assert sorted(backups.glob('huya-156324-*.sqlite3'), reverse=True)[0] == saved
