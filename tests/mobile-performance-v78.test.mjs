import test from 'node:test';
import assert from 'node:assert/strict';
import {createMobilePerformance} from '../src/scene/princess-kitten/mobile-performance.mjs';

test('high-DPR phone lowers GPU pixels during gestures, then restores its idle quality', () => {
  const controller = createMobilePerformance({mobile: true, nativeDpr: 3});
  const idle = controller.resize(390, 844);
  const gesture = controller.setGesture(true);
  assert.equal(idle.dpr, 1.5);
  assert.equal(gesture.dpr, 1);
  assert.ok(gesture.dpr ** 2 / 1.65 ** 2 < .37);
  assert.equal(controller.setGesture(false).dpr, idle.dpr);
  const large = controller.resize(844, 390);
  assert.ok(844 * 390 * large.dpr ** 2 <= large.budget);
});

test('sustained slow frames reduce quality with hysteresis; isolated stalls do not', () => {
  const controller = createMobilePerformance({mobile: true, nativeDpr: 3});
  controller.resize(390, 844);
  let now = 0;
  for (; now < 3000; now += 16.7) controller.sample(16.7, now);
  controller.sample(1000, now += 1000);
  for (let i = 0; i < 70; i++) controller.sample(16.7, now += 16.7);
  assert.equal(controller.getState().level, 2);
  for (let i = 0; i < 100; i++) controller.sample(45, now += 45);
  assert.equal(controller.getState().level, 0);
  const low = controller.getState().dpr;
  for (let i = 0; i < 100; i++) controller.sample(16.7, now += 16.7);
  assert.equal(controller.getState().dpr, low, 'No rapid oscillation back to full quality.');
  for (let i = 0; i < 1000; i++) controller.sample(16.7, now += 16.7);
  assert.equal(controller.getState().level, 2);
});

test('startup/background reset, native DPR and desktop bounds are respected', () => {
  const phone = createMobilePerformance({mobile: true, nativeDpr: 1});
  phone.resize(390, 844);
  assert.equal(phone.getState().dpr, 1);
  for (let t = 0; t < 1800; t += 100) phone.sample(100, t);
  assert.equal(phone.getState().level, 2);
  phone.resetSamples();
  for (let t = 2000; t < 3700; t += 100) phone.sample(100, t);
  assert.equal(phone.getState().level, 2);
  const desktop = createMobilePerformance({nativeDpr: 2});
  assert.equal(desktop.resize(1280, 800).dpr, 2);
  assert.equal(desktop.setGesture(true).dpr, 2);
  assert.equal(desktop.sample(200, 6000), null);
});
