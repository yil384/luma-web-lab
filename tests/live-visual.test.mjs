import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const page = readFileSync(new URL('../public/live/index.html', import.meta.url), 'utf8');
const snapshot = JSON.parse(readFileSync(new URL('../public/live/data/room.json', import.meta.url), 'utf8'));

test('mobile-first visual page uses illustrated Xiaomiao branding and truthful public numbers', () => {
  assert.match(page, /xiaomiao-wordmark\.webp/);
  assert.match(page, /xiaomiao-cat\.webp/);
  assert.match(page, /position:fixed;bottom:0/);
  assert.match(page, /156324/);
  assert.ok(!page.includes('今天，小喵在播什么？'));
  assert.ok(!page.includes('连接采集服务后，才能查看实际接收的弹幕'));
  assert.ok(!page.includes('演示数据'));
  assert.equal(snapshot.room_id, '156324');
  assert.equal(snapshot.display_heat_meaning, 'platform_display_heat_not_real_viewers');
  assert.ok(snapshot.observed_at);
  assert.ok(existsSync(new URL('../public/live/assets/xiaomiao-wordmark.webp', import.meta.url)));
});
test('header has no surprising navigation back to the unrelated main site', () => {
  assert.ok(!page.includes('href="/" aria-label="返回小喵主页"'));
  assert.ok(!page.includes('class="round-link"'));
  assert.match(page, /class="top-right"/);
  assert.match(page, /href="https:\/\/www\.huya\.com\/156324"/);
});

test('live fallback is validated and uses HTTPS-only user-configured API', () => {
  assert.match(page, /knownCover/);
  assert.match(page, /room_id!==['"]156324['"]/);
  assert.match(page, /\/live\/data\/history\.json/);
  assert.match(page, /const ws=new WebSocket\('wss:\/\/wsapi\.huya\.com\/'\)/);
  assert.match(page, /apiBase\(raw\)/);
  assert.match(page, /data-tab=\"gifts\"/);
  assert.match(page, /decodeHuyaItem/);
  assert.match(page, /6501/);
  assert.match(page, /startApiStream/);
});
