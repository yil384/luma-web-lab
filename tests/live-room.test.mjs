import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'public/live/index.html'), 'utf8');
const existingRoute = readFileSync(resolve(root, 'src/lib/experience-route.ts'), 'utf8');

test('live page preserves Xiaomiao identity and the actual site favicon', () => {
  assert.match(html, /<title>集美小喵直播间<\/title>/);
  assert.match(html, /xiaomiao-mark-v2\.svg/);
  assert.match(html, /xiaomiao-wordmark\.webp/);
  assert.match(html, /156324/);
  assert.ok(existsSync(resolve(root, 'public/icons/xiaomiao-mark-v2.svg')));
});

test('portrait navigation, public snapshot age and truthful heat labels', () => {
  assert.match(html, /class="bottom"/);
  assert.match(html, /\.bottom\{position:fixed;bottom:0/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /\/live\/data\/room\.json/);
  assert.match(html, /历史快照/);
  assert.match(html, /不是实际在线人数/);
  assert.doesNotMatch(html, /DEMO_MODE=1|眸镜|今天，小喵在播什么/);
});

test('real chat and gift tabs and clearly identified external destination', () => {
  assert.match(html, /data-tab="chat"/);
  assert.match(html, /data-tab="gifts"/);
  assert.match(html, /wss:\/\/wsapi\.huya\.com\//);
  assert.match(html, /decodeHuyaItem/);
  assert.match(html, /kind===6501/);
  assert.ok(!html.includes('href="/" aria-label="返回小喵主页"'));
  assert.ok(html.includes('href="https://www.huya.com/156324"'));
});

test('HTTPS collector is opt-in and main-site routes remain unchanged', () => {
  assert.match(html, /name="xiaomiao-monitor-api-base" content=""/);
  assert.match(html, /u\.protocol!=='https:'/);
  assert.match(html, /\.endsWith\('\/api'\)/);
  assert.match(existingRoute, /if \(path === '\/letter'\) return 'letter'/);
  assert.match(existingRoute, /return 'christmas'/);
});
