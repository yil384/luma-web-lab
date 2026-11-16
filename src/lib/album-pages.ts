/** Index arithmetic for a two-photo book spread. Preserves the selected photo on the left. */
export function bookPageIndex(index: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return ((Math.trunc(index) % count) + count) % count;
}

/** The last page wraps to the first photo when the count is odd. */
export function bookPagePair(index: number, count: number): [number, number] {
  const first = bookPageIndex(index, count);
  return [first, bookPageIndex(first + 1, count)];
}
