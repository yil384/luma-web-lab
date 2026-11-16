"""Read only public room-page information; no private endpoints or credentials."""
from __future__ import annotations
import html
import re
from datetime import datetime, timezone
from bs4 import BeautifulSoup

ROOM_ID = '156324'
ROOM_URL = f'https://www.huya.com/{ROOM_ID}'


def _match(text: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        found = re.search(pattern, text, re.I | re.S)
        if found:
            return html.unescape(found.group(1)).strip()
    return None


def _script_int(text: str, key: str) -> int | None:
    for p in [rf'["\\]?{re.escape(key)}["\\]?\s*:\s*["\\]?(\d+)',
              rf'{re.escape(key)}\s*=\s*["\']?(\d+)']:
        m = re.search(p, text)
        if m:
            return int(m.group(1))
    return None


def parse_room_page(html_text: str, room_id: str = ROOM_ID):
    soup = BeautifulSoup(html_text, 'html.parser')
    title = soup.title.get_text(' ', strip=True) if soup.title else ''
    meta = soup.find('meta', attrs={'name': 'keywords'})
    keywords = (meta.get('content', '') if meta else '')
    anchor = _match(keywords, [r'^\s*([^,，]+)']) or _match(title, [r'^(.+?)官方直播间', r'^(.+?)的直播间'])
    anchor = anchor or None
    # HTML-based status parsing is intentionally strict: unknown is not "live".
    visible = soup.get_text(' ', strip=True)
    if re.search(r'上次开播', visible):
        status = 'offline'
    elif re.search(r'直播中|正在直播', visible[:4000]) and not re.search(r'上次开播', visible[:4000]):
        status = 'live'
    else:
        status = 'unknown'
    # Prefer embedded structured fields when available.
    raw_status = _match(html_text, [r'["\'](?:isOn|isLive)["\']\s*:\s*(true|false)',
                                     r'["\']liveStatus["\']\s*:\s*["\']?(ON|OFF|1|0)'])
    if raw_status:
        status = 'live' if raw_status.lower() in ('true', 'on', '1') else 'offline'
    room_title = _match(html_text, [r'["\'](?:sLiveTitle|liveTitle|roomTitle)["\']\s*:\s*["\']([^"\']+)'])
    category = _match(title, [r'官方直播间-(.+?)-虎牙']) or _match(keywords, [r'([^,，]+)直播'])
    # Visible count is a platform display metric; never call it real viewers.
    followers = _match(visible, [r'关注\s+([\d.,]+(?:万|亿)?)'])
    heat = _match(visible, [rf'\b{re.escape(room_id)}\s+([\d.,]+(?:万|亿)?)\s+(?:上次开播|(?:正在|目前)?直播)'])
    cover = _match(html_text, [r'<meta[^>]+(?:og:image|name="image")[^>]+content="([^"]+)"'])
    if cover and cover.startswith('//'):
        cover = 'https:' + cover
    if cover and not cover.startswith('https://'):
        cover = None
    return {
        'room_id': room_id,
        'anchor': anchor,
        'room_title': room_title,
        'category': category,
        'status': status,
        'display_heat': heat,
        'followers_display': followers,
        'cover_url': cover,
        'last_live_text': _match(visible, [r'(上次开播\s*(?:今天|昨天|\d+[月\-/日]+)?\s*\d{1,2}:\d{2})']),
        'yyuid': _script_int(html_text, 'lYyid'),
        'channel_id': _script_int(html_text, 'lChannelId'),
        'sub_channel_id': _script_int(html_text, 'lSubChannelId'),
        'source_url': ROOM_URL,
        'observed_at': datetime.now(timezone.utc).isoformat(),
    }
