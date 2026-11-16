"""Minimal original Tars/JCE reader/writer used by Huya's public live chat socket.

This is a deliberately small protocol implementation, not a copy of any third-party library.
Huya can change its transport or fields without warning; integration is best-effort.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass

TYPE_INT8 = 0
TYPE_INT16 = 1
TYPE_INT32 = 2
TYPE_INT64 = 3
TYPE_FLOAT = 4
TYPE_DOUBLE = 5
TYPE_STRING1 = 6
TYPE_STRING4 = 7
TYPE_MAP = 8
TYPE_LIST = 9
TYPE_STRUCT = 10
TYPE_END = 11
TYPE_ZERO = 12
TYPE_BYTES = 13


def head(tag: int, kind: int) -> bytes:
    if not 0 <= tag <= 255:
        raise ValueError("tag out of range")
    return bytes([(min(tag, 15) << 4) | kind]) + (bytes([tag]) if tag >= 15 else b"")


def integer(tag: int, value: int) -> bytes:
    if value == 0:
        return head(tag, TYPE_ZERO)
    for kind, fmt, lo, hi in [
        (TYPE_INT8, ">b", -128, 127),
        (TYPE_INT16, ">h", -32768, 32767),
        (TYPE_INT32, ">i", -(2**31), 2**31 - 1),
        (TYPE_INT64, ">q", -(2**63), 2**63 - 1),
    ]:
        if lo <= value <= hi:
            return head(tag, kind) + struct.pack(fmt, value)
    raise ValueError("int64 overflow")


def string(tag: int, value: str) -> bytes:
    raw = value.encode("utf-8")
    if len(raw) <= 255:
        return head(tag, TYPE_STRING1) + bytes([len(raw)]) + raw
    return head(tag, TYPE_STRING4) + struct.pack(">I", len(raw)) + raw


def blob(tag: int, value: bytes) -> bytes:
    return head(tag, TYPE_BYTES) + head(0, TYPE_INT8) + integer(0, len(value)) + value


def join_request(yyuid: int, channel_id: int, sub_channel_id: int) -> bytes:
    """Encode anonymous WSRegisterReq wrapped in a WSCommand (command type 1)."""
    payload = b"".join([
        integer(0, yyuid), integer(1, 1), string(2, ""), string(3, ""),
        integer(4, channel_id), integer(5, sub_channel_id),
        integer(6, 0), integer(7, 0),
    ])
    return integer(0, 1) + blob(1, payload)


@dataclass
class Field:
    tag: int
    kind: int
    value: object


class Reader:
    def __init__(self, data: bytes, pos: int = 0):
        self.data = data
        self.pos = pos

    def take(self, count: int) -> bytes:
        if count < 0 or self.pos + count > len(self.data):
            raise ValueError("Truncated JCE message")
        value = self.data[self.pos:self.pos + count]
        self.pos += count
        return value

    def read_head(self):
        byte = self.take(1)[0]
        tag, kind = byte >> 4, byte & 0xF
        if tag == 15:
            tag = self.take(1)[0]
        return tag, kind

    def parse(self, stop_on_end=False, max_fields=500):
        out = []
        count = 0
        while self.pos < len(self.data):
            count += 1
            if count > max_fields:
                raise ValueError("Excessive Tars field count")
            tag, kind = self.read_head()
            if kind == TYPE_END:
                if stop_on_end:
                    return out
                continue
            out.append(Field(tag, kind, self.value(kind)))
        return out

    def value(self, kind):
        if kind in (TYPE_INT8, TYPE_INT16, TYPE_INT32, TYPE_INT64):
            n = {TYPE_INT8: 1, TYPE_INT16: 2, TYPE_INT32: 4, TYPE_INT64: 8}[kind]
            fmt = {1: ">b", 2: ">h", 4: ">i", 8: ">q"}[n]
            return struct.unpack(fmt, self.take(n))[0]
        if kind == TYPE_ZERO:
            return 0
        if kind in (TYPE_FLOAT, TYPE_DOUBLE):
            n = 4 if kind == TYPE_FLOAT else 8
            return struct.unpack(">f" if n == 4 else ">d", self.take(n))[0]
        if kind == TYPE_STRING1:
            return self.take(self.take(1)[0]).decode("utf-8", errors="replace")
        if kind == TYPE_STRING4:
            n = struct.unpack(">I", self.take(4))[0]
            if n > 2_000_000:
                raise ValueError("Overlarge Tars string")
            return self.take(n).decode("utf-8", errors="replace")
        if kind == TYPE_BYTES:
            _, inner_kind = self.read_head()
            if inner_kind != TYPE_INT8:
                raise ValueError("Invalid Tars byte-list element type")
            _, length_kind = self.read_head()
            n = self.value(length_kind)
            if not isinstance(n, int) or n < 0 or n > 8_000_000:
                raise ValueError("Invalid Tars blob size")
            return self.take(n)
        if kind == TYPE_STRUCT:
            return self.parse(stop_on_end=True)
        if kind in (TYPE_LIST, TYPE_MAP):
            _, size_kind = self.read_head()
            count = self.value(size_kind)
            if not isinstance(count, int) or count < 0 or count > 50_000:
                raise ValueError("Invalid Tars list size")
            items = []
            for _ in range(count * (2 if kind == TYPE_MAP else 1)):
                tag, item_kind = self.read_head()
                items.append(Field(tag, item_kind, self.value(item_kind)))
            return items
        raise ValueError(f"Unsupported Tars wire type {kind}")


def find(fields, tag, default=None):
    return next((x.value for x in fields if x.tag == tag), default)


def parse_push(packet: bytes) -> dict | None:
    """Decode known chat event (URI 1400) from Huya push envelope.

    Other URIs are counted but never guessed to be gift or user activity.
    """
    try:
        outer = Reader(packet).parse()
        command_type = find(outer, 0)
        if command_type != 7:
            return None
        pushed = find(outer, 1)
        if not isinstance(pushed, bytes):
            return None
        wrap = Reader(pushed).parse()
        uri = find(wrap, 1)
        contents = find(wrap, 2)
        if uri != 1400 or not isinstance(contents, bytes):
            return {"kind": "unparsed", "uri": uri}
        data = Reader(contents).parse()
        user = find(data, 0, [])
        name = find(user, 2, "") if isinstance(user, list) else ""
        content = find(data, 3, "")
        if name and content:
            return {"kind": "chat", "user_name": str(name), "content": str(content)}
    except (ValueError, TypeError, struct.error):
        pass
    return None

# Topic subscriptions are used by recent anonymous web clients. This is
# distinct from the older anonymous WSRegisterReq. Implement both rather than
# silently treating a successful TCP/WebSocket handshake as chat success.
HUYA_WS_URL = 'wss://cdnws.api.huya.com/'
HEARTBEAT = bytes.fromhex(
    '00 03 1d 00 00 69 00 00 00 69 10 03 2c 3c 4c 56 '
    '08 6f 6e 6c 69 6e 65 75 69 66 0f 4f 6e 55 73 65 '
    '72 48 65 61 72 74 42 65 61 74 7d 00 00 3c 08 00 '
    '01 06 04 74 52 65 71 1d 00 00 2f 0a 0a 0c 16 00 '
    '26 00 36 07 61 64 72 5f 77 61 70 46 00 0b 12 03 '
    'ae f0 0f 22 03 ae f0 0f 3c 42 6d 52 02 60 5c 60 '
    '01 7c 82 00 0b b0 1f 9c ac 0b 8c 98 0c a8 0c'
)


def topic_join_request(uid: int) -> bytes:
    """Subscribe to public live/chat room groups (WS command 16)."""
    if uid <= 0:
        raise ValueError('Topic UID must be positive')
    topic_list = (head(0, TYPE_LIST) + integer(0, 2)
                  + string(0, f'live:{uid}') + string(0, f'chat:{uid}'))
    return integer(0, 16) + blob(1, topic_list + string(1, ''))


def parse_push_events(packet: bytes) -> list[dict]:
    """Parse both legacy URI=1400 and newer list-of-struct chat pushes.

    Other command types, unknown URIs and malformed packets are not fabricated
    into chat/gift events. All fields are protocol-derived rather than inferred.
    """
    try:
        if not isinstance(packet, bytes) or len(packet) > 2_000_000:
            return []
        outer = Reader(packet).parse()
        if find(outer, 0) != 7:
            return []
        body = find(outer, 1)
        if not isinstance(body, bytes):
            return []
        pushed = Reader(body).parse()
        uri = find(pushed, 1)
        inner = find(pushed, 2)
        if not isinstance(inner, bytes):
            return []
        fields = Reader(inner).parse()
        results = []
        # Modern list of structs: tag 4 -> repeated {1: nick, 2: text}.
        items = find(fields, 4)
        if isinstance(items, list):
            for item in items[:250]:
                obj = item.value if isinstance(item, Field) else item
                if not isinstance(obj, list):
                    continue
                user = find(obj, 1)
                content = find(obj, 2)
                if isinstance(user, str) and isinstance(content, str) and user.strip() and content.strip():
                    results.append({'kind': 'chat', 'user_name': user[:128],
                                    'content': content[:2000], 'transport_uri': uri,
                                    'format': 'topic-batch'})
            if results:
                return results
        # Older chat notification, URI 1400.
        if uri == 1400:
            person = find(fields, 0)
            user = find(person, 2, '') if isinstance(person, list) else ''
            content = find(fields, 3, '')
            if isinstance(user, str) and isinstance(content, str) and user.strip() and content.strip():
                return [{'kind': 'chat', 'user_name': user[:128],
                         'content': content[:2000], 'transport_uri': uri,
                         'format': 'legacy-1400'}]
        return [{'kind': 'unparsed', 'uri': uri}]
    except (ValueError, TypeError, struct.error, IndexError, RecursionError):
        return []
