"""Read only public room-page information; no private endpoints or credentials."""
from __future__ import annotations
import html
import re
import json
from datetime import datetime, timezone
from urllib.parse import urlsplit
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
    heat = _match(visible, [rf'\b{re.escape(room_id)}\s+([\d.,]+(?:万|亿)?)\s+(?:上次开播|(?:正在|目前)?直播|{re.escape(category or "户外")})'])
    cover = _match(html_text, [r'<meta[^>]+(?:og:image|name="image")[^>]+content="([^"]+)"'])
    # The page may expose the current official cover via image metadata or
    # an inline room payload, not only OpenGraph markup. Accept only a known
    # Huya media host so we never publish arbitrary external image URLs.
    if not cover:
        for meta_tag in soup.find_all('meta'):
            key = (meta_tag.get('name') or meta_tag.get('property') or '').lower()
            if key in ('image', 'og:image', 'twitter:image'):
                cover = meta_tag.get('content')
                if cover:
                    break
    if not cover:
        normalized = html_text.replace(r'\/', '/')
        cover = _match(normalized, [r'((?:https?:)?//live-cover\.msstatic\.com/[^\s\"\'<>{}]{8,900})'])
    if cover:
        cover = html.unescape(str(cover).strip())
        if cover.startswith('//'):
            cover = 'https:' + cover
        parsed_cover = urlsplit(cover)
        if parsed_cover.scheme != 'https' or parsed_cover.hostname != 'live-cover.msstatic.com' or len(cover) > 1000:
            cover = None
    topic_uid = (_script_int(html_text, 'lp') or _script_int(html_text, 'ayyuid')
                 or _script_int(html_text, 'lYyid') or _script_int(html_text, 'yyuid'))
    return {
        'topic_uid': topic_uid,
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
