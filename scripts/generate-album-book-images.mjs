/**
 * Precompute lightweight, aspect-ratio-preserving book prints from the
 * published original WebP photos. The HD viewer continues to load originals.
 *
 * Run from a checkout containing generated/photo-manifest.json:
 *   node /path/to/scripts/generate-album-book-images.mjs /path/to/pages
 */
import sharp from 'sharp';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';

const root = resolve(process.argv[2] || '.');
const manifest = JSON.parse(await readFile(join(root, 'generated/photo-manifest.json'), 'utf8'));
const items = manifest.photos;
if (!Array.isArray(items) || !items.length) throw new Error('Missing published photos');
const maxEdge = 1280;
const quality = 88;
const details = [];
const seen = new Set();
await mkdir(join(root, 'generated/photos'), { recursive: true });

for (const [i, photo] of items.entries()) {
  if (!photo || typeof photo.id !== 'string' ||
    !/^[0-9a-f]{20}$/.test(photo.id) ||
    photo.src !== `generated/photos/${photo.id}.webp` ||
    seen.has(photo.id)) {
    throw new Error(`Unsafe or duplicated source photo #${i + 1}`);
  }
  seen.add(photo.id);
  const srcPath = join(root, photo.src);
  const bookRelative = `generated/photos/${photo.id}-book.webp`;
  const bookPath = join(root, bookRelative);
  for (const path of [srcPath, bookPath]) {
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe photo path');
  }
  const srcInfo = await stat(srcPath);
  if (!srcInfo.isFile()) throw new Error(`Missing original: ${photo.id}`);
  const original = await sharp(srcPath, { limitInputPixels: 64_000_000 }).metadata();
  if (original.width !== photo.width || original.height !== photo.height) {
    throw new Error(`Manifest dimensions do not match original: ${photo.id}`);
  }
  const expectedWidth = Math.max(1, Math.round(original.width * Math.min(1, maxEdge / Math.max(original.width, original.height))));
  const expectedHeight = Math.max(1, Math.round(original.height * Math.min(1, maxEdge / Math.max(original.width, original.height))));
  let existing;
  try { existing = await sharp(bookPath).metadata(); } catch { /* first build */ }
  if (!existing || existing.width !== expectedWidth || existing.height !== expectedHeight) {
    await sharp(srcPath, { limitInputPixels: 64_000_000 })
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toFile(bookPath);
  }
  const bookInfo = await sharp(bookPath).metadata();
  const bookBytes = (await stat(bookPath)).size;
  if (bookInfo.format !== 'webp' || bookInfo.width !== expectedWidth || bookInfo.height !== expectedHeight ||
    Math.abs(bookInfo.width / bookInfo.height - original.width / original.height) > 0.005) {
    throw new Error(`Wrong book aspect ratio for ${photo.id}`);
  }
  details.push({
    id: photo.id, book: bookRelative,
    width: bookInfo.width, height: bookInfo.height,
    sourcePixels: original.width * original.height,
    bookPixels: bookInfo.width * bookInfo.height,
    sourceBytes: srcInfo.size, bookBytes,
  });
  if ((i + 1) % 15 === 0 || i + 1 === items.length) {
    console.log(`Optimized ${i + 1}/${items.length} photos`);
  }
}
const sum = field => details.reduce((acc, row) => acc + row[field], 0);
const report = {
  version: 'album-book-webp-1280-q88-v1',
  maxEdge, quality, photoCount: details.length,
  sourceBytes: sum('sourceBytes'), bookBytes: sum('bookBytes'),
  sourceDecodedPixels: sum('sourcePixels'), bookDecodedPixels: sum('bookPixels'),
  photos: details,
};
await writeFile(join(root, 'generated/book-photo-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  photos: details.length, sourceMB: +(report.sourceBytes / 1048576).toFixed(1),
  bookMB: +(report.bookBytes / 1048576).toFixed(1),
  decodedPixelReduction: +((1 - report.bookDecodedPixels / report.sourceDecodedPixels) * 100).toFixed(1) + '%',
}));
