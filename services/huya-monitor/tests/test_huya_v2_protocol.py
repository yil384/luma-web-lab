"""Contract tests based on the public Huya Tars field schema, not a fake real run."""
from __future__ import annotations

from app import main
from app.tars import (
    HEARTBEAT, HUYA_WS_URL, Reader, find, parse_push_events, inspect_frame,
    head, integer, string, blob, TYPE_LIST, TYPE_STRUCT, TYPE_END,
)
from fastapi.testclient import TestClient

UID = 1199660059462
ROOM = 156324


def chat_notice(nick='喵友', content='小喵晚上好！'):
    sender = head(0, TYPE_STRUCT) + integer(0, 42) + string(2, nick) + head(0, TYPE_END)
    return sender + string(3, content)


def gift_notice(gift_name='星光', presenter=UID, count=3):
    return (integer(0, 10031) + string(1, 'payment-id-ignored') +
            integer(2, count) + integer(3, presenter) +
            integer(4, 42) + string(6, '星河') +
            string(20, gift_name) + integer(24, ROOM) +
            integer(41, 999999999))  # lPayTotal is not a verified CNY figure


def push_item(uri, payload, msg_id):
    return (head(0, TYPE_STRUCT) + integer(0, uri) + blob(1, payload) +
            integer(2, msg_id) + head(0, TYPE_END))


def v2(*messages):
    inner = string(0, f'chat:{UID}') + head(1, TYPE_LIST) + integer(0, len(messages)) + b''.join(messages)
    return integer(0, 22) + blob(1, inner)


def test_v2_mixed_chat_gift_with_message_ids():
    frame = v2(push_item(1400, chat_notice(), 105), push_item(6501, gift_notice(), 106))
    decoded = inspect_frame(frame, expected_presenter_uid=UID)
    assert decoded['command'] == 22
    assert decoded['group'] == f'chat:{UID}'
    assert [evt['kind'] for evt in decoded['events']] == ['chat', 'gift']
    assert decoded['events'][0]['content'] == '小喵晚上好！'
    assert decoded['events'][0]['message_id'] == 105
    gift = decoded['events'][1]
    assert gift['user_name'] == '星河'
    assert gift['gift_name'] == '星光'
    assert gift['gift_id'] == 10031
    assert gift['gift_count'] == 3
    assert gift['message_id'] == 106
    assert 'amount_cents' not in gift  # do not present raw lPayTotal as income


def test_gift_with_unknown_display_name_uses_id_without_guessing():
    result = parse_push_events(v2(push_item(6501, gift_notice(gift_name=''), 5)), UID)
    assert result[0]['kind'] == 'gift'
    assert result[0]['gift_name'] is None
    assert result[0]['gift_id'] == 10031


def test_gift_wrong_presenter_does_not_leak_into_room():
    parsed = parse_push_events(v2(push_item(6501, gift_notice(presenter=UID + 1), 107)), UID)
    assert parsed == [{'kind': 'unparsed', 'uri': 6501, 'reason': 'missing_or_unverified_fields'}]


def test_v2_unknown_uri_does_not_fabricate_event():
    parsed = parse_push_events(v2(push_item(77777, string(2,'some data'), 90)), UID)
    assert parsed[0]['kind'] == 'unparsed'


def test_v2_limits_and_malformed_packets():
    assert inspect_frame(b'')['events'] == []
    assert inspect_frame(b'\x01\x02')['events'] == []
    assert inspect_frame(b'0' * 2_000_001)['events'] == []
    assert parse_push_events(v2(push_item(6501, gift_notice(count=0), 1)), UID)[0]['kind']=='unparsed'


def test_protocol_endpoint_and_application_heartbeat():
    assert HUYA_WS_URL == 'wss://wsapi.huya.com/'
    hb = Reader(HEARTBEAT).parse()
    assert find(hb, 0) == 20
    assert find(hb, 1) == b''


def test_event_idempotency_and_gift_api_fields(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DATA_DIR', tmp_path)
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'events.sqlite3')
    main.init_db()
    main.add_event('gift', user_name='星河', gift_name='星光', gift_count=3,
                   source='huya-public-websocket', event_key='huya-156324:6501:106')
    assert main.add_event('gift', user_name='星河', gift_name='星光', gift_count=3,
                   source='huya-public-websocket', event_key='huya-156324:6501:106') is None
    main.add_event('chat', user_name='喵友', content='晚上好',source='huya-public-websocket')
    api = TestClient(main.app)
    gifts = api.get('/api/events',params={'kind':'gift'}).json()
    assert gifts['total'] == 1
    assert gifts['items'][0]['amount_cents'] is None
    assert gifts['items'][0]['gift_count'] == 3
    assert api.get('/api/overview').json()['metrics']['gift_items'] == 3
