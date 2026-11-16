import csv
import io
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.scraper import parse_room_page
from app.tars import (TYPE_END, TYPE_STRUCT, Reader, blob, find, head,
                      integer, join_request, parse_push, parse_push_events, topic_join_request, string, TYPE_LIST)


@pytest.fixture(autouse=True)
def test_db(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'DATA_DIR', tmp_path)
    monkeypatch.setattr(main, 'DB_PATH', tmp_path / 'test.sqlite3')
    monkeypatch.setattr(main, 'DEMO_MODE', False)
    monkeypatch.setattr(main, 'INGEST_TOKEN', '')
    monkeypatch.setitem(main.state['page'], 'state', 'starting')
    main.init_db()


def test_room_page_offline_with_public_counts():
    page = '''<html><head><title>集美小喵【ZKL】官方直播间-户外-虎牙直播</title>
     <meta name="keywords" content="集美小喵【ZKL】, 户外直播, 虎牙直播,156324,35184708705880"></head>
    <body>关注 3.2万 集美小喵【ZKL】 156324 43.1万 上次开播 今天 00:38
    <script>const j={"lYyid":1199660059462,"lChannelId":234567,"lSubChannelId":45678}</script></body></html>'''
    result = parse_room_page(page)
    assert result['anchor'] == '集美小喵【ZKL】'
    assert result['category'] == '户外'
    assert result['status'] == 'offline'
    assert result['display_heat'] == '43.1万'
    assert result['followers_display'] == '3.2万'
    assert result['yyuid'] == 1199660059462
    assert result['channel_id'] == 234567


def test_missing_status_is_unknown():
    page = '<title>集美小喵【ZKL】官方直播间-户外-虎牙直播</title>'
    data = parse_room_page(page)
    assert data['status'] == 'unknown'
    assert data['display_heat'] is None


def test_tars_registration_and_chat_frame():
    register = Reader(join_request(1199660059462, 111, 222)).parse()
    assert find(register, 0) == 1
    inner = Reader(find(register, 1)).parse()
    assert find(inner, 0) == 1199660059462
    assert find(inner, 4) == 111
    assert find(inner, 5) == 222

    user = head(0, TYPE_STRUCT) + integer(0, 12) + string(2, '测试用户') + head(0, TYPE_END)
    payload = user + string(3, '大家晚上好！')
    wrap = integer(1, 1400) + blob(2, payload)
    packet = integer(0, 7) + blob(1, wrap)
    assert parse_push(packet) == {'kind': 'chat', 'user_name': '测试用户', 'content': '大家晚上好！'}
    other = integer(0, 7) + blob(1, integer(1, 8888) + blob(2, payload))
    assert parse_push(other) == {'kind': 'unparsed', 'uri': 8888}
    assert parse_push(b'not valid') is None


def test_db_events_filters_rank_exports():
    main.add_event('chat', user_name='甲', content='虎牙测试')
    main.add_event('chat', user_name='乙', content='=IMPORTXML(1)')
    main.add_event('gift', user_name='甲', gift_name='荧光棒', gift_count=5,
                   noble_level=3, amount_cents=100, source='authorized-integration')
    client = TestClient(main.app)
    overview = client.get('/api/overview').json()
    assert overview['metrics']['chats'] == 2
    assert overview['metrics']['gifts'] == 1
    assert overview['metrics']['gift_items'] == 5
    assert overview['metrics']['participants'] == 2
    search = client.get('/api/events', params={'q':'荧光棒','kind':'gift'}).json()
    assert search['total'] == 1
    level = client.get('/api/events', params={'min_noble':3}).json()
    assert level['total'] == 1
    no_level = client.get('/api/events', params={'min_noble':4}).json()
    assert no_level['total'] == 0
    ranked = client.get('/api/ranking', params={'metric':'gift'}).json()['items']
    assert ranked[0]['user_name'] == '甲'
    assert ranked[0]['items'] == 5
    exported = client.get('/api/export').text.lstrip('\ufeff')
    rows = list(csv.DictReader(io.StringIO(exported)))
    assert len(rows) == 3
    assert any(row['content']=="'=IMPORTXML(1)" for row in rows)


def test_snapshot_session_status_changes():
    base = dict(main.latest_room)
    base.update(status='unknown', observed_at='2026-11-16T01:00:00+00:00')
    main.save_snapshot(base)
    base.update(status='live', observed_at='2026-11-16T01:01:00+00:00', room_title='室外活动')
    main.save_snapshot(base)
    base.update(status='live', observed_at='2026-11-16T01:02:00+00:00')
    main.save_snapshot(base)
    base.update(status='offline', observed_at='2026-11-16T01:03:00+00:00')
    main.save_snapshot(base)
    items = TestClient(main.app).get('/api/sessions').json()['items']
    assert len(items)==1
    assert items[0]['started_at']=='2026-11-16T01:01:00+00:00'
    assert items[0]['ended_at']=='2026-11-16T01:03:00+00:00'


def test_ingest_requires_token(monkeypatch):
    client=TestClient(main.app)
    payload={'kind':'chat','user_name':'甲','content':'hello'}
    assert client.post('/api/ingest',json=payload).status_code==401
    monkeypatch.setattr(main,'INGEST_TOKEN','test-secret-for-unit-test')
    assert client.post('/api/ingest',json=payload,headers={'Authorization':'Bearer wrong'}).status_code==401
    r=client.post('/api/ingest',json=payload,headers={'Authorization':'Bearer test-secret-for-unit-test'})
    assert r.status_code==200
    assert r.json()['source']=='authorized-integration'


def test_health_and_source_state():
    client=TestClient(main.app)
    assert client.get('/api/health').json()['room_id']=='156324'
    assert client.get('/api/sources').status_code==200
    assert client.get('/').status_code==200


def test_huya_topic_join_and_batch_parser():
    from app.tars import Reader, find, head, TYPE_STRUCT, TYPE_END, blob, integer, string
    reg = Reader(topic_join_request(1199660059462)).parse()
    assert find(reg, 0) == 16
    subscribed = Reader(find(reg, 1)).parse()
    topics = find(subscribed, 0)
    assert [x.value for x in topics] == ['live:1199660059462', 'chat:1199660059462']
    first = head(0, TYPE_STRUCT) + integer(0, 0) + string(1, '小喵一号') + string(2, '晚上好') + head(0, TYPE_END)
    second = head(0, TYPE_STRUCT) + string(1, '小喵二号') + string(2, '喜欢小猫') + head(0, TYPE_END)
    payload = head(4, TYPE_LIST) + integer(0, 2) + first + second
    packet = integer(0, 7) + blob(1, integer(1, 888) + blob(2, payload))
    parsed = parse_push_events(packet)
    assert len(parsed) == 2
    assert [x['content'] for x in parsed] == ['晚上好', '喜欢小猫']
    assert all(x['format'] == 'topic-batch' for x in parsed)
    assert parse_push_events(b'\x01\x02') == []

def test_topic_uid_is_anchor_uid_not_room_id():
    page = '<title>集美小喵【ZKL】官方直播间-户外-虎牙直播</title>' \
           '<script>const TT_PROFILE_INFO={"lp":123456789,"ayyuid":987654321}</script>'
    info = parse_room_page(page)
    assert info['topic_uid'] == 123456789

