import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import { assetUrl, type Photo } from '../lib/content';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import PhotoViewer from './PhotoViewer';
import { bookPageIndex, bookPagePair } from '../lib/album-pages';
import './MemoryAlbum.css';

type Direction = -1 | 1;
type Turn = { direction: Direction; from: number; to: number; startProgress: number };
type CornerDrag = { id: number; direction: Direction; startX: number; progress: number };

const FLIP_MS = 740;

type PhotoGalleryProps = {
  photos: Photo[];
  initialIndex: number;
  handNavigation?: { sequence: number; direction: Direction };
  handMode?: boolean;
  onCloseHandMode?: () => void;
};

function PhotoPrint({ photo, onOpen, inert = false }: { photo: Photo; onOpen?: () => void; inert?: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = <span className="memory-album-print">
    {failed
      ? <span className="memory-album-print-fallback" aria-hidden="true"><Icon name="photos" /></span>
      : <img src={assetUrl(photo.thumbnail || photo.src)} width={photo.width} height={photo.height}
        alt="" draggable={false} decoding="async" onError={() => setFailed(true)} />}
    <span className="memory-album-photo-corners" aria-hidden="true" />
  </span>;

  if (inert) return <span className="memory-album-photo-mount" aria-hidden="true">{image}</span>;
  return <button type="button" className="memory-album-photo-mount" aria-label={`查看高清照片：${photo.alt || '照片'}`}
    onClick={onOpen} title="查看高清照片">{image}</button>;
}

function BookPage({ photo, side, onOpen }: { photo: Photo; side: 'left' | 'right'; onOpen: () => void }) {
  return <div className={`memory-album-sheet memory-album-sheet--${side}`}>
    <div className="memory-album-paper-grain" aria-hidden="true" />
    <PhotoPrint key={photo.id} photo={photo} onOpen={onOpen} />
    <span className="memory-album-paper-gilt" aria-hidden="true" />
  </div>;
}

export default function PhotoGallery({ photos, initialIndex, handNavigation, handMode, onCloseHandMode }: PhotoGalleryProps) {
  const count = photos.length;
  const [index, setIndex] = useState(() => bookPageIndex(initialIndex, count));
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnMoving, setTurnMoving] = useState(false);
  const [turnHalf, setTurnHalf] = useState(false);
  const [corner, setCorner] = useState<CornerDrag | null>(null);
  const cornerRef = useRef<CornerDrag | null>(null);
  const skipCornerClick = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressPhotoTapUntil = useRef(0);
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const navigationSeq = useRef(handNavigation?.sequence ?? 0);

  useEffect(() => {
    setIndex(bookPageIndex(initialIndex, count));
    setTurn(null);
    setCorner(null);
    cornerRef.current = null;
  }, [initialIndex, count]);

  useEffect(() => {
    if (!handNavigation || handNavigation.sequence === navigationSeq.current) return;
    navigationSeq.current = handNavigation.sequence;
    if (count < 2) return;
    setTurn(null);
    setCorner(null);
    cornerRef.current = null;
    setIndex(value => bookPageIndex(value + handNavigation.direction * 2, count));
  }, [handNavigation, count]);

  const requestTurn = useCallback((direction: Direction, progress = 0) => {
    if (count < 2 || turn) return;
    const to = bookPageIndex(index + direction * 2, count);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIndex(to);
      setCorner(null);
      return;
    }
    setTurnHalf(false);
    setTurnMoving(false);
    setTurn({ direction, from: index, to, startProgress: Math.max(0, Math.min(1, progress)) });
    setCorner(null);
  }, [count, index, turn]);

  useEffect(() => {
    if (!turn) return;
    // A separate frame allows the book leaf to visibly travel from its
    // initial angle (or the user's drag angle) to the opposite page.
    const raf = window.requestAnimationFrame(() => setTurnMoving(true));
    const halfway = window.setTimeout(() => setTurnHalf(true), FLIP_MS / 2);
    const finished = window.setTimeout(() => {
      setIndex(turn.to);
      setTurn(null);
      setTurnMoving(false);
      setTurnHalf(false);
    }, FLIP_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(halfway);
      window.clearTimeout(finished);
    };
  }, [turn]);

  useEffect(() => {
    if (enlarged !== null || count < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      requestTurn(event.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [count, enlarged, requestTurn]);

  const beginCorner = (event: ReactPointerEvent<HTMLButtonElement>, direction: Direction) => {
    if (turn || count < 2 || event.button !== 0) return;
    const drag = { id: event.pointerId, direction, startX: event.clientX, progress: 0 };
    cornerRef.current = drag;
    setCorner(drag);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveCorner = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = cornerRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const inward = drag.direction === 1 ? drag.startX - event.clientX : event.clientX - drag.startX;
    const progress = Math.max(0, Math.min(0.98, inward / 160));
    const next = { ...drag, progress };
    cornerRef.current = next;
    setCorner(next);
  };

  const finishCorner = (event: ReactPointerEvent<HTMLButtonElement>, cancel = false) => {
    const drag = cornerRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    cornerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    skipCornerClick.current = !cancel;
    if (cancel) { setCorner(null); return; }
    // A tap folds the page; a dragged corner completes the fold once released.
    requestTurn(drag.direction, drag.progress);
  };

  const onCornerClick = (direction: Direction) => {
    if (skipCornerClick.current) { skipCornerClick.current = false; return; }
    requestTurn(direction);
  };

  const openPrint = (photoIndex: number) => {
    if (turn || performance.now() < suppressPhotoTapUntil.current) return;
    setEnlarged(photoIndex);
  };

  const startSwipe = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1 || turn || corner) { swipeStart.current = null; return; }
    swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const endSwipe = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1 || turn) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    suppressPhotoTapUntil.current = performance.now() + 450;
    event.preventDefault();
    requestTurn(dx < 0 ? 1 : -1);
  };

  if (!count) return <div className="memory-album-empty" role="status" aria-label="暂无照片"><Icon name="photos" /></div>;

  const [leftAtRest, rightAtRest] = bookPagePair(index, count);
  const [nextLeft, nextRight] = turn ? bookPagePair(turn.to, count) : [leftAtRest, rightAtRest];
  const leftIndex = turn
    ? (turn.direction === 1 ? (turnHalf ? nextLeft : leftAtRest) : nextLeft)
    : leftAtRest;
  const rightIndex = turn
    ? (turn.direction === 1 ? nextRight : (turnHalf ? nextRight : rightAtRest))
    : rightAtRest;
  const activeLeaf = turn?.direction ?? corner?.direction;
  const leafFrom = turn?.from ?? index;
  const leafTo = turn?.to ?? bookPageIndex(index + (activeLeaf ?? 1) * 2, count);
  const [leafCurrentLeft, leafCurrentRight] = bookPagePair(leafFrom, count);
  const [leafNextLeft, leafNextRight] = bookPagePair(leafTo, count);
  const startProgress = turn?.startProgress ?? corner?.progress ?? 0;
  const angle = (activeLeaf === 1 ? -1 : 1) * (turnMoving ? 179.9 : startProgress * 179.9);
  const leafStyle = { '--memory-turn-angle': `${angle}deg` } as CSSProperties;

  return <div className="memory-album" aria-label="立体相册">
    <div className="memory-album-stage">
      <div className="memory-album-ground-shadow" aria-hidden="true" />
      <div className="memory-album-book" role="group" aria-label="翻开的相册，点击照片查看高清大图">
        <div className="memory-album-cover" aria-hidden="true" />
        <div className="memory-album-cover-emboss" aria-hidden="true" />
        <div className="memory-album-page-block" aria-hidden="true" />
        <div className="memory-album-page-spine" aria-hidden="true" />
        <div className="memory-album-spread" onTouchStart={startSwipe} onTouchEnd={endSwipe}
          onTouchCancel={() => { swipeStart.current = null; }}>
          <BookPage key={`left-${photos[leftIndex].id}`} photo={photos[leftIndex]} side="left" onOpen={() => openPrint(leftIndex)} />
          <BookPage key={`right-${photos[rightIndex].id}`} photo={photos[rightIndex]} side="right" onOpen={() => openPrint(rightIndex)} />
        </div>
        {activeLeaf && <div className={`memory-album-leaf memory-album-leaf--${activeLeaf === 1 ? 'forward' : 'backward'}${turnMoving ? ' is-moving' : ''}`}
          style={leafStyle} aria-hidden="true">
          <div className="memory-album-leaf-face memory-album-leaf-front">
            <PhotoPrint key={`front-${leafFrom}-${activeLeaf}`} photo={photos[activeLeaf === 1 ? leafCurrentRight : leafCurrentLeft]} inert />
          </div>
          <div className="memory-album-leaf-face memory-album-leaf-back">
            <PhotoPrint key={`back-${leafTo}-${activeLeaf}`} photo={photos[activeLeaf === 1 ? leafNextLeft : leafNextRight]} inert />
          </div>
        </div>}
        <div className="memory-album-binding" aria-hidden="true" />
        <div className="memory-album-corner-foil memory-album-corner-foil--tl" aria-hidden="true" />
        <div className="memory-album-corner-foil memory-album-corner-foil--tr" aria-hidden="true" />
        <div className="memory-album-corner-foil memory-album-corner-foil--bl" aria-hidden="true" />
        <div className="memory-album-corner-foil memory-album-corner-foil--br" aria-hidden="true" />
      </div>

      {count > 1 && <>
        <button type="button" className="memory-album-turn memory-album-turn--previous" aria-label="向前翻页"
          disabled={!!turn} onPointerDown={event => beginCorner(event, -1)} onPointerMove={moveCorner}
          onPointerUp={finishCorner} onPointerCancel={event => finishCorner(event, true)}
          onClick={() => onCornerClick(-1)}><Icon name="left" /></button>
        <button type="button" className="memory-album-turn memory-album-turn--next" aria-label="向后翻页"
          disabled={!!turn} onPointerDown={event => beginCorner(event, 1)} onPointerMove={moveCorner}
          onPointerUp={finishCorner} onPointerCancel={event => finishCorner(event, true)}
          onClick={() => onCornerClick(1)}><Icon name="left" /></button>
      </>}
    </div>
    {handMode && onCloseHandMode && <button type="button" className="memory-album-camera-off" onClick={onCloseHandMode}
      aria-label="关闭摄像头手势模式" title="关闭摄像头手势模式"><Icon name="hand" /><Icon name="close" /></button>}
    {enlarged !== null && <Dialog title="高清照片" className="memory-album-zoom-dialog" onClose={() => setEnlarged(null)}>
      <PhotoViewer key={photos[enlarged].id} photo={photos[enlarged]} onStep={count > 1
        ? direction => setEnlarged(value => value === null ? null : bookPageIndex(value + direction, count))
        : undefined} />
    </Dialog>}
  </div>;
}
