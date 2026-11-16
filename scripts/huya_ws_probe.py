#!/usr/bin/env python3
"""One-off, bounded probe of public Huya room 156324 WebSocket commands.

No usernames, raw frames, chat content, cookies, payment IDs or user IDs
are logged, uploaded or published. Zero messages is NOT a protocol pass.
"""
from __future__ import annotations
import argparse
import asyncio
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services' / 'huya-monitor'))
from app.tars import HEARTBEAT, HUYA_WS_URL, inspect_frame, topic_join_request  # noqa: E402


def room_uid():
    published = json.loads((ROOT / 'public/live/data/room.json').read_text('utf-8'))
    if published.get('room_id') != '156324':
        raise RuntimeError('Room identity mismatch')
    uid = published.get('topic_uid')
    if not isinstance(uid, int) or uid <= 0:
        raise RuntimeError('Missing verified topic_uid; refresh room snapshot before probing')
    return uid


async def run_probe(duration: int):
    import websockets
    uid = room_uid()
    counters = Counter()
    started = time.monotonic()
    transport = 'connecting'
    error = None
    try:
        async with websockets.connect(HUYA_WS_URL, origin='https://www.huya.com',
                                      open_timeout=12, ping_interval=25, ping_timeout=25,
                                      max_size=2_000_000, max_queue=32) as ws:
            transport = 'connected'
            await ws.send(topic_join_request(uid))
            await ws.send(HEARTBEAT)
            next_hb = time.monotonic() + 20
            while time.monotonic()-started < duration:
                remaining = min(duration-(time.monotonic()-started), max(0.2, next_hb-time.monotonic()))
                if remaining <= 0:
                    break
                try:
                    frame = await asyncio.wait_for(ws.recv(), timeout=remaining)
                except asyncio.TimeoutError:
                    if time.monotonic() >= next_hb:
                        await ws.send(HEARTBEAT)
                        next_hb = time.monotonic()+20
                    continue
                if not isinstance(frame, bytes):
                    continue
                counters['frames'] += 1
                inspected = inspect_frame(frame, expected_presenter_uid=uid)
                command = inspected['command']
                if isinstance(command, int):
                    counters[f'command_{command}'] += 1
                for event in inspected['events']:
                    kind = event['kind']
                    counters[kind] += 1
                    if kind == 'unparsed':
                        counters[f'unknown_uri_{event.get("uri")}'] += 1
    except (Exception, KeyboardInterrupt) as exc:
        transport = 'error'
        # Avoid printing remote data or paths in network exception messages.
        error = type(exc).__name__
    return {
        'room_id': '156324', 'probe_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'duration_seconds': round(time.monotonic()-started, 1),
        'transport': transport, 'chat_verified': counters['chat'] > 0,
        'gift_verified': counters['gift'] > 0,
        'counters': dict(sorted(counters.items())), 'error_type': error,
        'privacy': 'no user content, raw packets or usernames logged'
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--seconds',type=int,default=45)
    p.add_argument('--out',type=Path,default=Path('huya-probe-result.json'))
    args=p.parse_args()
    if not 5 <= args.seconds <= 90:
        p.error('Duration must be 5..90 seconds')
    result=asyncio.run(run_probe(args.seconds))
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as out:
            out.write('## Huya 156324 protocol probe\n\n')
            out.write(f"- Transport: **{result['transport']}**\n")
            out.write(f"- Frames: **{result['counters'].get('frames',0)}**\n")
            out.write(f"- Chat notices: **{result['counters'].get('chat',0)}**\n")
            out.write(f"- Gift notices: **{result['counters'].get('gift',0)}**\n")
            out.write('- No usernames, content or raw frames were stored.\n')
            if not result['chat_verified'] and not result['gift_verified']:
                out.write('- **No real chat/gift message was verified in this probe.**\n')
    return 0 if result['transport'] == 'connected' else 1

if __name__=='__main__': raise SystemExit(main())
