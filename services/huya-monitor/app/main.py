"""Huya Room 156324 monitor -- self-hosted, public-data only.

Run: python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
Demo: DEMO_MODE=1 python -m uvicorn app.main:app --port 8765
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import random
import sqlite3
from collections import Counter, defaultdict
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import httpx
import websockets
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

from .scraper import ROOM_ID, ROOM_URL, parse_room_page
from .tars import join_request, parse_push

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv('DATA_DIR', str(ROOT / 'data')))
DB_PATH = DATA_DIR / 'monitor.sqlite3'
DEMO_MODE = os.getenv('DEMO_MODE', '0') == '1'
INGEST_TOKEN = os.getenv('INGEST_TOKEN', '')
CORS_ORIGINS = [x.strip().rstrip('/') for x in os.getenv('CORS_ORIGINS', 'https://tanchensiyi.com').split(',') if x.strip()]
POLL_SECONDS = max(20, int(os.getenv('POLL_SECONDS', '45')))
CHAT_ENABLED = os.getenv('HUYA_CHAT_ENABLED', '1') == '1'
LOGGER = logging.getLogger('huya-monitor')
UTC = timezone.utc

state = {
    'page': {'state': 'starting', 'last_success': None, 'last_attempt': None, 'error': None},
    'chat': {'state': 'starting' if CHAT_ENABLED else 'disabled', 'last_success': None, 'last_attempt': None, 'error': None},
    'unknown_uris': {},
    'demo': DEMO_MODE,
}
latest_room = {
    'room_id': ROOM_ID, 'anchor': '集美小喵【ZKL】', 'room_title': None,
    'category': '户外', 'status': 'unknown', 'display_heat': None,
    'cover_url': None, 'last_live_text': None, 'followers_display': None, 'source_url': ROOM_URL,
    'observed_at': None, 'yyuid': None, 'channel_id': None, 'sub_channel_id': None,
}
clients: set[asyncio.Queue] = set()


def iso_now():
    return datetime.now(UTC).isoformat(timespec='seconds')


@contextmanager
def sql():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA busy_timeout=5000')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with sql() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL, kind TEXT NOT NULL,
          user_name TEXT, content TEXT, gift_name TEXT,
          gift_count INTEGER NOT NULL DEFAULT 0,
          noble_level INTEGER, fans_level INTEGER,
          amount_cents INTEGER, source TEXT NOT NULL,
          raw_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
        CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, ts DESC);
        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL, status TEXT NOT NULL,
          anchor TEXT, room_title TEXT, category TEXT,
          display_heat TEXT, cover_url TEXT,
          last_live_text TEXT, followers_display TEXT, source TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(ts DESC);
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at TEXT NOT NULL, ended_at TEXT,
          title TEXT, observed_start INTEGER DEFAULT 1
        );
        ''')
        columns = {r[1] for r in db.execute('PRAGMA table_info(snapshots)')}
        if 'followers_display' not in columns:
            db.execute('ALTER TABLE snapshots ADD COLUMN followers_display TEXT')


def add_event(kind, user_name=None, content=None, gift_name=None,
              gift_count=0, noble_level=None, fans_level=None,
              amount_cents=None, source='huya-websocket', ts=None, raw=None):
    if kind not in ('chat', 'gift', 'entry', 'system', 'follow', 'noble'):
        raise ValueError('Unsupported event kind')
    timestamp = ts or iso_now()
    with sql() as db:
        cur = db.execute('''INSERT INTO events
            (ts,kind,user_name,content,gift_name,gift_count,noble_level,fans_level,amount_cents,source,raw_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
            (timestamp,kind,user_name,content,gift_name,max(0,int(gift_count or 0)),
             noble_level,fans_level,amount_cents,source,
             json.dumps(raw,ensure_ascii=False)[:20000] if raw is not None else None))
        event_id = cur.lastrowid
    event = {'id': event_id, 'ts': timestamp, 'kind': kind,
             'user_name': user_name, 'content': content,
             'gift_name': gift_name, 'gift_count': gift_count,
             'noble_level': noble_level, 'fans_level': fans_level,
             'amount_cents': amount_cents, 'source': source}
    publish({'type':'event','data':event})
    return event


def save_snapshot(room, source='huya-page'):
    ts = room.get('observed_at') or iso_now()
    with sql() as db:
        prev = db.execute('SELECT status FROM snapshots ORDER BY id DESC LIMIT 1').fetchone()
        db.execute('''INSERT INTO snapshots
          (ts,status,anchor,room_title,category,display_heat,cover_url,last_live_text,followers_display,source)
          VALUES (?,?,?,?,?,?,?,?,?,?)''',
          (ts,room['status'],room.get('anchor'),room.get('room_title'),
           room.get('category'),room.get('display_heat'),room.get('cover_url'),
           room.get('last_live_text'),room.get('followers_display'),source))
        old_status = prev['status'] if prev else None
        if room['status']=='live' and old_status!='live':
            db.execute('INSERT INTO sessions (started_at,title) VALUES (?,?)',
                       (ts,room.get('room_title')))
        if room['status']=='offline' and old_status=='live':
            db.execute('UPDATE sessions SET ended_at=? WHERE ended_at IS NULL', (ts,))
    publish({'type':'snapshot','data':room})


def publish(message):
    for queue in tuple(clients):
        if queue.full():
            try: queue.get_nowait()
            except asyncio.QueueEmpty: pass
        try: queue.put_nowait(message)
        except asyncio.QueueFull: pass


def since_for(window):
    return (datetime.now(UTC) - {'1h':timedelta(hours=1),
                                  '24h':timedelta(days=1),
                                  '7d':timedelta(days=7),
                                  '30d':timedelta(days=30)}[window]).isoformat(timespec='seconds')


def heat_number(value):
    if not value: return None
    try:
        s = value.replace(',', '').strip()
        multiplier = 100_000_000 if '亿' in s else 10_000 if '万' in s else 1
        return float(s.replace('亿','').replace('万','')) * multiplier
    except (ValueError,AttributeError): return None


async def poll_room():
    while True:
        state['page']['last_attempt'] = iso_now()
        try:
            # No forbidden browser automation, cookie sharing, or rate-limit circumvention.
            async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                 headers={'User-Agent':'Mozilla/5.0 (compatible; RoomMonitor/1.0; +local dashboard)',
                          'Accept-Language':'zh-CN,zh;q=0.9,en;q=0.7'}) as client:
                response = await client.get(ROOM_URL)
                response.raise_for_status()
                room = parse_room_page(response.text)
                if not room.get('anchor'):
                    raise ValueError('Missing anchor in room page (layout changed or blocked)')
                latest_room.update({k:v for k,v in room.items() if v is not None or k in ('status','display_heat')})
                save_snapshot(dict(latest_room))
                state['page'].update(state='connected',last_success=iso_now(),error=None)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOGGER.warning('Room status unavailable: %s',str(exc)[:180])
            state['page'].update(state='error',error=str(exc)[:180])
            # Do not keep showing old status as if it were current.
            latest_room['status'] = 'unknown'
            latest_room['display_heat'] = None
            publish({'type':'sources','data':state})
        await asyncio.sleep(POLL_SECONDS)


async def collect_chat():
    """Best-effort anonymous room WebSocket listener for public chat only.

    Gift data cannot be claimed unless verified or sent via the authenticated
    integration endpoint. This is not an official / guaranteed public API.
    """
    backoff = 3
    while True:
        state['chat']['last_attempt'] = iso_now()
        try:
            ids = [latest_room.get(key) for key in ('yyuid','channel_id','sub_channel_id')]
            if not all(isinstance(v,int) and v > 0 for v in ids):
                state['chat'].update(state='waiting',error='等待页面提供可用的连接标识（yyuid/channel/subchannel）')
                await asyncio.sleep(15)
                continue
            state['chat'].update(state='connecting',error=None)
            async with websockets.connect('wss://cdnws.api.huya.com/',
                    open_timeout=15, ping_interval=25, ping_timeout=25,
                    max_size=2_000_000) as ws:
                await ws.send(join_request(*ids))
                state['chat'].update(state='transport_connected',error=None)
                backoff = 3
                async for packet in ws:
                    if not isinstance(packet, bytes): continue
                    parsed = parse_push(packet)
                    if not parsed: continue
                    if parsed.get('kind') == 'chat':
                        add_event('chat', parsed['user_name'],parsed['content'],source='huya-websocket')
                        state['chat']['state'] = 'connected'
                        state['chat']['last_success'] = iso_now()
                    elif parsed.get('kind') == 'unparsed':
                        k = str(parsed.get('uri'))[:20]
                        state['unknown_uris'][k] = state['unknown_uris'].get(k,0)+1
                state['chat'].update(state='disconnected',error='WebSocket closed; reconnecting')
                await asyncio.sleep(backoff)
        except asyncio.CancelledError: raise
        except Exception as exc:
            state['chat'].update(state='error',error=str(exc)[:180])
            LOGGER.warning('Huya chat WebSocket disconnected: %s',str(exc)[:180])
            await asyncio.sleep(backoff)
            backoff = min(backoff*2,60)


def seed_demo():
    """Only when explicitly enabled; data is tagged demo everywhere."""
    with sql() as db:
        db.execute('DELETE FROM events')
        db.execute('DELETE FROM snapshots')
        db.execute('DELETE FROM sessions')
    now = datetime.now(UTC)
    latest_room.update(anchor='集美小喵【ZKL】',status='live',
        room_title='周末户外直播 · 现场互动',category='户外',display_heat='43.1万',
        observed_at=iso_now(),last_live_text=None)
    for step in range(72, -1, -1):
        at = now - timedelta(minutes=step*10)
        room = dict(latest_room)
        room['display_heat'] = f'{round(39 + 4.5 * (1+__import__("math").sin(step/5)),1)}万'
        room['observed_at']=at.isoformat(timespec='seconds')
        save_snapshot(room,source='demo')
    names=['追风少年','橙子汽水','山海有信','小羊晚安','星月旅行者','凌晨一点','可乐加冰','海边散步','青团','不熬夜','飞鸟','暖橘']
    sentences=['哈哈哈哈今天太好笑了','这段真的精彩！','今晚是在杭州吗？','坐等下一场活动','这镜头也太清晰了','主播晚上好～','可以再来一首吗','今天大家辛苦了','这个场面太有意思了','支持支持！']
    rnd = random.Random(156324)
    for i in range(218):
        at = (now-timedelta(minutes=rnd.random()*12*60)).isoformat(timespec='seconds')
        kind = rnd.choices(['chat','gift','entry','follow'],[85,7,5,3])[0]
        person = rnd.choice(names)
        if kind=='chat':
            add_event(kind,person,rnd.choice(sentences),ts=at,source='demo')
        elif kind=='gift':
            add_event(kind,person,gift_name=rnd.choice(['荧光棒','小心心','鲜花']),gift_count=rnd.randint(1,8),ts=at,source='demo')
        elif kind=='entry':
            add_event(kind,person,content='进入直播间',ts=at,source='demo')
        else:
            add_event(kind,person,content='关注了主播',ts=at,source='demo')
    state['page'].update(state='demo',last_success=iso_now(),error=None)
    state['chat'].update(state='demo',last_success=iso_now(),error=None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    tasks=[]
    if DEMO_MODE:
        seed_demo()
    else:
        tasks.append(asyncio.create_task(poll_room(),name='room-poller'))
        if CHAT_ENABLED:
            tasks.append(asyncio.create_task(collect_chat(),name='chat-collector'))
    yield
    for task in tasks: task.cancel()
    await asyncio.gather(*tasks,return_exceptions=True)


app = FastAPI(title='集美小喵直播间 · 采集 API',version='0.2.0',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=CORS_ORIGINS,allow_credentials=False,allow_methods=['GET'],allow_headers=['Accept','Content-Type'])


@app.get('/')
def index():
    return {'service':'集美小喵直播间采集 API', 'room_id':ROOM_ID, 'dashboard':'https://tanchensiyi.com/live/', 'health':'/api/health'}


@app.get('/api/health')
def health():
    return {'ok': True,'room_id':ROOM_ID,'demo':DEMO_MODE,'timestamp':iso_now(),
            'collectors':state}


@app.get('/api/overview')
def overview(window: Literal['1h','24h','7d','30d']='24h'):
    start=since_for(window)
    with sql() as db:
        count_rows = db.execute('''SELECT kind,COUNT(*) AS n,
                 COALESCE(SUM(gift_count),0) AS gift_count FROM events
                 WHERE ts>=? GROUP BY kind''',(start,)).fetchall()
        n_users=db.execute('''SELECT COUNT(DISTINCT user_name) AS n FROM events
                 WHERE ts>=? AND user_name IS NOT NULL AND source != 'demo' ''',(start,)).fetchone()['n']
        if DEMO_MODE:
            n_users=db.execute('''SELECT COUNT(DISTINCT user_name) AS n FROM events WHERE ts>=?''',(start,)).fetchone()['n']
        n_sessions=db.execute('SELECT COUNT(*) AS n FROM sessions WHERE started_at>=?',(start,)).fetchone()['n']
        last=db.execute('SELECT * FROM snapshots ORDER BY id DESC LIMIT 1').fetchone()
    counts={r['kind']:r['n'] for r in count_rows}
    gift_count=sum(r['gift_count'] for r in count_rows)
    room=dict(latest_room)
    if last and state['page']['state'] in ('demo','connected'):
        room.update({k:last[k] for k in ('anchor','room_title','category','display_heat','cover_url','last_live_text','status','followers_display')})
    return {'room':room,'window':window,'demo':DEMO_MODE,
            'metrics':{'chats':counts.get('chat',0),'gifts':counts.get('gift',0),
                       'gift_items':gift_count,'participants':n_users,
                       'entries':counts.get('entry',0),'follows':counts.get('follow',0),
                       'sessions':n_sessions,'all_events':sum(counts.values())},
            'sources':state,'server_time':iso_now()}


@app.get('/api/events')
def events(kind: Literal['all','chat','gift','entry','system','follow','noble']='all',
           window: Literal['1h','24h','7d','30d']='24h',q: str='',
           limit: int=Query(100,ge=1,le=500),offset:int=Query(0,ge=0),
           min_noble:int=Query(0,ge=0,le=100)):
    where=['ts>=?']
    args=[since_for(window)]
    if kind!='all': where.append('kind=?'); args.append(kind)
    if min_noble: where.append('noble_level >= ?'); args.append(min_noble)
    if q.strip():
        where.append('(user_name LIKE ? ESCAPE "\\" OR content LIKE ? ESCAPE "\\" OR gift_name LIKE ? ESCAPE "\\")')
        term='%'+q.strip()[:100].replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%'
        args.extend([term]*3)
    clause=' AND '.join(where)
    with sql() as db:
        total=db.execute('SELECT COUNT(*) AS n FROM events WHERE '+clause,args).fetchone()['n']
        rows=db.execute('SELECT id,ts,kind,user_name,content,gift_name,gift_count,noble_level,fans_level,amount_cents,source FROM events WHERE '+clause+' ORDER BY ts DESC,id DESC LIMIT ? OFFSET ?',args+[limit,offset]).fetchall()
    return {'items':[dict(r) for r in rows],'total':total,'offset':offset,'limit':limit}


@app.get('/api/trend')
def trend(window: Literal['1h','24h','7d','30d']='24h'):
    start=since_for(window)
    now=datetime.now(UTC)
    hours={'1h':1,'24h':24,'7d':168,'30d':720}[window]
    num=12 if window=='1h' else 24 if window=='24h' else 28 if window=='7d' else 30
    span=timedelta(hours=hours/num)
    beginning=now-timedelta(hours=hours)
    buckets=[{'ts':(beginning+span*i).isoformat(timespec='seconds'),
              'label':(beginning+span*i).strftime('%H:%M' if hours<=24 else '%m/%d'),
              'chats':0,'gifts':0,'heat':None,'heat_label':None} for i in range(num)]
    with sql() as db:
        rows=db.execute('SELECT ts,kind FROM events WHERE ts>=? ORDER BY ts ASC',(start,)).fetchall()
        snaps=db.execute('SELECT ts,display_heat FROM snapshots WHERE ts>=? ORDER BY ts ASC',(start,)).fetchall()
    def place(ts):
        try:
            at=datetime.fromisoformat(ts).replace(tzinfo=UTC) if datetime.fromisoformat(ts).tzinfo is None else datetime.fromisoformat(ts).astimezone(UTC)
            i=int((at-beginning).total_seconds()/span.total_seconds())
            return i if 0<=i<num else None
        except (ValueError,TypeError):return None
    for row in rows:
        i=place(row['ts'])
        if i is not None:
            key='chats' if row['kind']=='chat' else 'gifts' if row['kind']=='gift' else None
            if key: buckets[i][key]+=1
    for row in snaps:
        i=place(row['ts'])
        if i is not None:
            buckets[i]['heat']=heat_number(row['display_heat'])
            buckets[i]['heat_label']=row['display_heat']
    return {'window':window,'points':buckets,'heat_metric':'虎牙页面展示热度（非真实在线人数）'}


@app.get('/api/ranking')
def ranking(window: Literal['1h','24h','7d','30d']='24h',metric: Literal['chat','gift']='chat'):
    where='kind=? AND ts>=? AND user_name IS NOT NULL'
    with sql() as db:
        rows=db.execute('''SELECT user_name,COUNT(*) AS messages,COALESCE(SUM(gift_count),0) AS items
                 FROM events WHERE '''+where+''' GROUP BY user_name ORDER BY '''+
                 ('messages' if metric=='chat' else 'items')+''' DESC LIMIT 12''',(metric,since_for(window))).fetchall()
    return {'items':[dict(r) for r in rows],'metric':metric}


@app.get('/api/sessions')
def sessions(limit: int=Query(30,ge=1,le=100)):
    with sql() as db:
        rows=db.execute('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?',(limit,)).fetchall()
    return {'items':[dict(r) for r in rows]}


@app.get('/api/sources')
def sources():
    return {'sources':state,'room_ids':{k:latest_room.get(k) for k in ('yyuid','channel_id','sub_channel_id')},
            'scope':'公开房间页 + 尝试匿名弹幕 WebSocket；礼物等事件需另接入获授权数据源',
            'official_api':'虎牙旧开放 API 于 2026-10-31 下线；本程序不使用该接口'}


def safe_csv_cell(v):
    s='' if v is None else str(v)
    return "'"+s if s.startswith(('=','+','-','@','\t','\r')) else s


@app.get('/api/export')
def export(window: Literal['1h','24h','7d','30d']='24h',
           kind: Literal['all','chat','gift','entry','system','follow','noble']='all'):
    start=since_for(window)
    where='WHERE ts >= ? '+('AND kind=?' if kind!='all' else '')
    args=[start]+([kind] if kind!='all' else [])
    keys=['ts','kind','user_name','content','gift_name','gift_count','noble_level','fans_level','amount_cents','source']
    def produce_csv():
        buf=io.StringIO()
        writer=csv.writer(buf)
        writer.writerow(keys)
        yield '\ufeff'+buf.getvalue()
        with sql() as db:
            cursor=db.execute('''SELECT ts,kind,user_name,content,gift_name,gift_count,
                            noble_level,fans_level,amount_cents,source FROM events '''+where+
                            ''' ORDER BY ts DESC''',args)
            while True:
                rows=cursor.fetchmany(500)
                if not rows:
                    break
                buf=io.StringIO()
                writer=csv.writer(buf)
                for row in rows:
                    writer.writerow([safe_csv_cell(row[k]) for k in keys])
                yield buf.getvalue()
    filename=f'huya-{ROOM_ID}-{kind}-{window}.csv'
    return StreamingResponse(produce_csv(),media_type='text/csv; charset=utf-8',
                             headers={'Content-Disposition':f'attachment; filename="{filename}"'})



class IngestEvent(BaseModel):
    kind: Literal['chat','gift','entry','system','follow','noble']
    user_name: str | None = Field(default=None,max_length=128)
    content: str | None = Field(default=None,max_length=2000)
    gift_name: str | None = Field(default=None,max_length=200)
    gift_count: int = Field(default=0,ge=0,le=100000)
    noble_level: int | None = Field(default=None,ge=0,le=100)
    fans_level: int | None = Field(default=None,ge=0,le=1000)
    amount_cents: int | None = Field(default=None,ge=0)


@app.post('/api/ingest')
async def ingest(data: IngestEvent,authorization: str | None=Header(None)):
    # Require explicit integration setup. It is never unauthenticated.
    if not INGEST_TOKEN or authorization != f'Bearer {INGEST_TOKEN}':
        raise HTTPException(status_code=401,detail='Authenticated integration not configured')
    if DEMO_MODE:
        raise HTTPException(status_code=403,detail='Demo does not accept external events')
    return add_event(source='authorized-integration',raw=data.model_dump(),**data.model_dump())


@app.get('/api/stream')
async def stream(request: Request):
    queue=asyncio.Queue(maxsize=100)
    clients.add(queue)
    async def gen():
        try:
            yield f'event: welcome\ndata: {json.dumps({"time":iso_now(),"demo":DEMO_MODE})}\n\n'
            while True:
                if await request.is_disconnected(): break
                try:
                    message=await asyncio.wait_for(queue.get(),timeout=15)
                    yield 'data: '+json.dumps(message,ensure_ascii=False)+'\n\n'
                except asyncio.TimeoutError:
                    yield ': heartbeat\n\n'
        finally:
            clients.discard(queue)
    return StreamingResponse(gen(),media_type='text/event-stream',
       headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})


# Dashboard is served by the tanchensiyi.com static Site, not this API process.
