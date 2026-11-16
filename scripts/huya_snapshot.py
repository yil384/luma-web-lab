#!/usr/bin/env python3
"""Fetch one public Huya room snapshot for the static GitHub Pages fallback.

This is *not* real-time chat. It never authenticates, bypasses rate limits or
turns displayed heat into a current viewer count. A failed fetch does not
clobber last-known-good data.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services' / 'huya-monitor'))
from app.scraper import parse_room_page, ROOM_ID, ROOM_URL  # noqa: E402

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36'


def build_snapshot(html_text: str, recorded_at: str | None = None) -> dict:
    parsed = parse_room_page(html_text)
    if not parsed.get('anchor') or ROOM_ID not in html_text:
        raise ValueError('Room page identity not confirmed; refusing to publish stale/foreign page')
    fields = ('room_id','anchor','room_title','category','status','display_heat',
              'followers_display','last_live_text','cover_url','topic_uid','source_url')
    snapshot = {name: parsed.get(name) for name in fields}
    snapshot['observed_at'] = recorded_at or datetime.now(timezone.utc).isoformat(timespec='seconds')
    snapshot['type'] = 'public_page_snapshot'
    snapshot['display_heat_meaning'] = 'platform_display_heat_not_real_viewers'
    snapshot['status_meaning'] = 'inferred_from_public_page_not_guaranteed_live'
    return snapshot


def fetch_snapshot() -> dict:
    with httpx.Client(timeout=httpx.Timeout(18.0, connect=8.0), follow_redirects=True,
                      headers={'User-Agent': UA,
                               'Accept-Language': 'zh-CN,zh;q=0.9',
                               'Referer': 'https://www.huya.com/'}) as client:
        last = None
        for attempt in range(3):
            try:
                response = client.get(ROOM_URL)
                response.raise_for_status()
                if not (20 <= len(response.text) <= 6_000_000):
                    raise ValueError('Unexpected page size')
                return build_snapshot(response.text)
            except (httpx.HTTPError, ValueError) as exc:
                last = exc
                if attempt < 2:
                    time.sleep(attempt + 1)
        raise RuntimeError(f'Huya public snapshot failed after 3 attempts: {type(last).__name__}') from last


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        snapshot = fetch_snapshot()
    except Exception as exc:
        print(f'snapshot failed: {exc}', file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.output.with_suffix('.tmp')
    tmp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(args.output)
    print(f'Room {ROOM_ID}: public snapshot {snapshot["status"]}, {snapshot["observed_at"]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
