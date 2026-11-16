import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'public/live/index.html'), 'utf8');
const existingRoute = readFileSync(resolve(root, 'src/lib/experience-route.ts'), 'utf8');

test('live page preserves main-site name, favicon and room identity', () => {
  assert.match(html, /<title>集美小喵直播间<\/title>/);
  assert.match(html, /xiaomiao-mark-v2\.svg/);
  assert.match(html, /156324/);
  assert.ok(existsSync(resolve(root, 'public/icons/xiaomiao-mark-v2.svg')));
});

test('phone-first responsive tab navigation and trustworthy fallback', () => {
  assert.match(html, /mobile-nav/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /\/live\/data\/room\.json/);
  assert.match(html, /数据已过期|快照已超过两小时/);
  assert.match(html, /非真实在线人数/);
  assert.doesNotMatch(html, /DEMO_MODE=1|眸镜/);
});

test('live API endpoints remain opt-in, main routes remain unchanged', () => {
  assert.match(html, /xiaomiao-monitor-api-base/);
  assert.match(html, /https:\/\/域名\/api/);
  assert.match(existingRoute, /if \(path === '\/letter'\) return 'letter'/);
  assert.match(existingRoute, /return 'christmas'/);
});
