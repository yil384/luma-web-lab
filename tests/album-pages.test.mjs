import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/album-pages.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { bookPageIndex, bookPagePair } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('selected photo is the left page, including the final odd photo', () => {
  assert.deepEqual(bookPagePair(26, 95), [26, 27]);
  assert.deepEqual(bookPagePair(94, 95), [94, 0]);
  assert.deepEqual(bookPagePair(0, 1), [0, 0]);
});

test('book indices wrap in both directions without skipping or overflowing', () => {
  assert.equal(bookPageIndex(-2, 95), 93);
  assert.equal(bookPageIndex(96, 95), 1);
  assert.equal(bookPageIndex(94 + 2, 95), 1);
  assert.equal(bookPageIndex(2 - 2, 95), 0);
  assert.equal(bookPageIndex(Infinity, 95), 0);
  assert.equal(bookPageIndex(-1, 0), 0);
});
