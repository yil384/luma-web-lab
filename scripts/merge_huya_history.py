#!/usr/bin/env python3
"""Merge only genuinely observed room snapshots into a small, bounded public timeline.

The file is public GitHub Pages data: no viewers, private tokens, raw messages or
cookies are added, and a failed collector never inserts fabricated points.
"""
from __future__ import annotations
import argparse
import json
from datetime import datetime
from pathlib import Path

MAX_ITEMS = 672  # 7 days at 15-minute resolution, bounded JSON size
FIELDS = ('observed_at', 'display_heat', 'followers_display', 'status')


def merge_history(existing: dict | None, snapshot: dict) -> dict:
    if snapshot.get('room_id') != '156324':
        raise ValueError('Room mismatch')
    timestamp = snapshot.get('observed_at')
    if not isinstance(timestamp, str):
        raise ValueError('Missing observation time')
    datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    previous = []
    if isinstance(existing, dict) and existing.get('room_id') == '156324':
        previous = existing.get('items', [])
    if not isinstance(previous, list):
        previous = []
    records = {}
    for value in [*previous, snapshot]:
        if not isinstance(value, dict):
            continue
        ts = value.get('observed_at')
        if not isinstance(ts, str):
            continue
        try:
            datetime.fromisoformat(ts.replace('Z', '+00:00'))
        except ValueError:
            continue
        records[ts] = {k: value.get(k) for k in FIELDS}
    return {'room_id': '156324', 'items': [records[k] for k in sorted(records)[-MAX_ITEMS:]]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--history', type=Path, required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    args = parser.parse_args()
    snap = json.loads(args.snapshot.read_text(encoding='utf-8'))
    old = json.loads(args.history.read_text(encoding='utf-8')) if args.history.exists() else None
    updated = merge_history(old, snap)
    args.history.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.history.with_suffix('.tmp')
    tmp.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(args.history)
    print('Historical public observations:', len(updated['items']))


if __name__ == '__main__':
    main()
