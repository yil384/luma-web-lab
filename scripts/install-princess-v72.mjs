#!/usr/bin/env node
/** Stage the exact Gemini V72 GLB locally without deploying. */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { PRINCESS_V72, validatePrincessV72 } from './princess-v72-contract.mjs';

const supplied = process.argv[2];
if (!supplied) {
  console.error('Usage: npm run princess:install -- /absolute/path/princess-eyes-candidate-v72.glb');
  process.exit(2);
}
const source = resolve(supplied);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(projectRoot, PRINCESS_V72.assetPath);
try {
  const sourceBuffer = await readFile(source);
  const report = validatePrincessV72(sourceBuffer);
  if (source === target) {
    console.log('Princess V72 already installed at ' + target);
  } else {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  validatePrincessV72(await readFile(target));
  console.log('Verified and installed V72: ' + target);
  console.log(JSON.stringify(report, null, 2));
  console.log('To preview locally: VITE_PRINCESS_V72_PREVIEW=true npm run dev');
  console.log('This command DOES NOT merge or publish the site.');
} catch (error) {
  console.error('V72 installation failed: ' + error.message);
  process.exitCode = 1;
}
