import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const entry = readFileSync(resolve(root, 'public/live/index.html'), 'utf8');
const route = readFileSync(resolve(root, 'src/lib/experience-route.ts'), 'utf8');

test('/live/ has independent static HTML and the site favicon', () => {
  assert.ok(entry.startsWith('<!doctype html>'));
  assert.match(entry, /<title>集美小喵直播间/);
  assert.match(entry, /\/icons\/xiaomiao-mark-v2\.svg/);
  assert.match(entry, /\/icons\/xiaomiao-mark-v2\.ico/);
  assert.match(entry, /https:\/\/www\.huya\.com\/156324/);
  assert.ok(existsSync(resolve(root, 'public/icons/xiaomiao-mark-v2.svg')));
});

test('static dashboard does not fake live information without a collector', () => {
  assert.match(entry, /采集服务未连接/);
  assert.match(entry, /尚未连接实时采集服务/);
  assert.match(entry, /xiaomiao-monitor-api-base/);
  assert.match(entry, /公开站点只能连接 HTTPS 服务/);
  assert.doesNotMatch(entry, /DEMO_MODE=1|Math\.random\(\).*gift/);
});

test('existing seasonal routing is untouched', () => {
  assert.match(route, /if \(path === '\/letter'\) return 'letter'/);
  assert.match(route, /return 'christmas'/);
  assert.ok(existsSync(resolve(root, 'scripts/finalize-build.mjs')));
});
