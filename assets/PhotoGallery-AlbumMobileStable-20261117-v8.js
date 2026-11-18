import{r as u,a as W,j as t}from"./index-CJX_PAH8.js";import{I as D,D as Dg}from"./App-BJDn6o_4.js";function U(n,a,c,f){const g=M=>Number.isFinite(M)&&M>0?M:1,l=g(n),p=g(a),h=g(c),r=g(f),w=Math.min(1,h/l,r/p);return{width:h,height:r,fittedWidth:l*w,fittedHeight:p*w,maxScale:1/w}}function I(n,a){const c=p=>Number.isFinite(p)?p:0,f=Math.max(1,Math.min(n.maxScale,c(a.scale))),g=Math.max(0,(n.fittedWidth*f-n.width)/2),l=Math.max(0,(n.fittedHeight*f-n.height)/2);return{scale:f,x:Math.max(-g,Math.min(g,c(a.x)))||0,y:Math.max(-l,Math.min(l,c(a.y)))||0}}function q(n,a,c,f){const g=I(n,{...a,scale:c}).scale,l=g/a.scale;return I(n,{scale:g,x:f.x-(f.x-a.x)*l,y:f.y-(f.y-a.y)*l})}function B(n,a,c,f,g){const l=I(n,{...a,scale:a.scale*g}).scale,p=l/a.scale;return I(n,{scale:l,x:f.x-(c.x-a.x)*p,y:f.y-(c.y-a.y)*p})}const $={scale:1,x:0,y:0};function O({photo:n,onStep:a}){const c=u.useRef(null),[f,g]=u.useState({width:1,height:1}),[l,p]=u.useState($),h=u.useRef(l),r=U(n.width,n.height,f.width,f.height),w=u.useRef(r);w.current=r;const[M,E]=u.useState(0),[C,z]=u.useState("loading"),d=u.useRef(new Map),o=u.useRef(null),x=u.useRef(null),T=u.useRef("mouse"),K=new URL(W(n.src),window.location.href);M&&K.searchParams.set("retry",String(M));const k=u.useCallback(e=>{const i=I(w.current,e);h.current=i,p(s=>s.scale===i.scale&&s.x===i.x&&s.y===i.y?s:i)},[]);u.useLayoutEffect(()=>{const e=c.current;if(!e)return;const i=()=>g({width:e.clientWidth,height:e.clientHeight});i();const s=typeof ResizeObserver=="function"?new ResizeObserver(i):null;return s==null||s.observe(e),window.addEventListener("resize",i),()=>{s==null||s.disconnect(),window.removeEventListener("resize",i)}},[]),u.useLayoutEffect(()=>{k(h.current)},[r.width,r.height,r.maxScale,k]);const N=u.useCallback((e,i={x:0,y:0})=>{k(q(w.current,h.current,e,i))},[k]),H=e=>{const i=c.current.getBoundingClientRect();return{x:e.clientX-i.left-i.width/2,y:e.clientY-i.top-i.height/2}},A=e=>{h.current.scale>1.01?k($):N(Math.min(3,w.current.maxScale),e)};u.useEffect(()=>{const e=c.current;if(!e)return;let i=!1;const s=y=>{if(y.preventDefault(),i)return;x.current=null;const j=e.getBoundingClientRect(),R=y.deltaMode===1?16:y.deltaMode===2?j.height:1,L=Math.exp(-Math.max(-600,Math.min(600,y.deltaY*R))*.002);N(h.current.scale*L,{x:y.clientX-j.left-j.width/2,y:y.clientY-j.top-j.height/2})};let b=1;const m=y=>{y.preventDefault(),b=1,i=!0,x.current=null},P=y=>{y.preventDefault();const j=y,R=j.scale??1;if(!(!Number.isFinite(R)||R<=0)){if(d.current.size<2){const L=e.getBoundingClientRect(),X={x:j.clientX===void 0?0:j.clientX-L.left-L.width/2,y:j.clientY===void 0?0:j.clientY-L.top-L.height/2};N(h.current.scale*R/b,X)}b=R}},v=y=>{y.preventDefault(),i=!1};return e.addEventListener("wheel",s,{passive:!1}),e.addEventListener("gesturestart",m,{passive:!1}),e.addEventListener("gesturechange",P,{passive:!1}),e.addEventListener("gestureend",v,{passive:!1}),()=>{e.removeEventListener("wheel",s),e.removeEventListener("gesturestart",m),e.removeEventListener("gesturechange",P),e.removeEventListener("gestureend",v)}},[N]);const F=(e,i=!1)=>{if(!d.current.delete(e.pointerId)||(e.currentTarget.hasPointerCapture(e.pointerId)&&e.currentTarget.releasePointerCapture(e.pointerId),i&&o.current&&(o.current.multi=!0),d.current.size))return;const s=o.current;if(o.current=null,!s||i||s.multi){x.current=null;return}const b=H(e),m=b.x-s.start.x,P=b.y-s.start.y,v=performance.now()-s.at;if(s.type==="touch"&&h.current.scale<=1.01&&v<1e3&&Math.abs(m)>50&&Math.abs(m)>Math.abs(P)*1.25){x.current=null,a==null||a(m<0?1:-1);return}if(s.type!=="touch"||s.moved||Math.hypot(m,P)>8||v>400)return;const y=x.current,j=performance.now();y&&j-y.at<330&&Math.hypot(b.x-y.point.x,b.y-y.point.y)<32?(x.current=null,A(b)):x.current={point:b,at:j}},Y=l.scale>1.01,V=Math.round(l.scale/r.maxScale*100);return t.jsxs("div",{className:"photo-viewer",children:[t.jsxs("div",{className:"gallery-photo",children:[t.jsxs("div",{ref:c,className:`photo-viewport${Y?" is-zoomed":""}`,tabIndex:0,role:"region","aria-label":"高清照片。滚轮、双击或双指缩放，放大后拖动查看。","data-photo-scale":l.scale.toFixed(3),onPointerDown:e=>{if(e.button!==0)return;e.preventDefault(),e.currentTarget.focus({preventScroll:!0}),e.currentTarget.setPointerCapture(e.pointerId);const i=H(e);d.current.set(e.pointerId,i),T.current=e.pointerType,d.current.size===1?o.current={start:i,at:performance.now(),moved:!1,multi:!1,type:e.pointerType}:o.current&&(o.current.multi=!0,x.current=null)},onPointerMove:e=>{const i=d.current.get(e.pointerId);if(!i)return;const s=[...d.current.values()],b=H(e);d.current.set(e.pointerId,b);const m=[...d.current.values()];if(o.current&&Math.hypot(b.x-o.current.start.x,b.y-o.current.start.y)>8&&(o.current.moved=!0,x.current=null),s.length===2&&m.length===2){const P=Math.hypot(s[1].x-s[0].x,s[1].y-s[0].y),v=Math.hypot(m[1].x-m[0].x,m[1].y-m[0].y);P>0&&v>0&&k(B(w.current,h.current,{x:(s[0].x+s[1].x)/2,y:(s[0].y+s[1].y)/2},{x:(m[0].x+m[1].x)/2,y:(m[0].y+m[1].y)/2},v/P))}else m.length===1&&k({...h.current,x:h.current.x+b.x-i.x,y:h.current.y+b.y-i.y})},onPointerUp:e=>F(e),onPointerCancel:e=>F(e,!0),onLostPointerCapture:e=>F(e,!0),onDoubleClick:e=>{T.current!=="touch"&&(e.preventDefault(),A(H(e)))},onKeyDown:e=>{e.altKey||e.ctrlKey||e.metaKey||["+","=","-","0","1","Home"].includes(e.key)&&(e.preventDefault(),e.stopPropagation(),e.key==="0"||e.key==="Home"?k($):N(e.key==="1"?r.maxScale:h.current.scale*(e.key==="-"?1/1.5:1.5)))},children:[C==="loading"&&t.jsx("div",{className:"photo-loading",role:"status",children:"正在加载高清照片…"}),C==="error"?t.jsxs("div",{className:"photo-error",role:"status",children:[t.jsx(D,{name:"photos"}),t.jsx("p",{children:"这张照片暂时没打开。"}),t.jsx("button",{type:"button",className:"more-photos",onPointerDown:e=>e.stopPropagation(),onClick:()=>{z("loading"),E(e=>e+1)},children:"再试一次"})]}):t.jsx("img",{className:"gallery-image",src:K.href,width:n.width,height:n.height,alt:n.alt||"照片",decoding:"async",draggable:!1,"aria-busy":C==="loading",style:{width:r.fittedWidth,height:r.fittedHeight,transform:`translate(-50%, -50%) translate(${l.x}px, ${l.y}px) scale(${l.scale})`},onLoad:()=>z("ready"),onError:()=>z("error")},M)]}),a&&t.jsxs(t.Fragment,{children:[t.jsx("button",{type:"button",className:"gallery-nav previous","aria-label":"上一张照片",onClick:()=>a(-1),children:t.jsx(D,{name:"left"})}),t.jsx("button",{type:"button",className:"gallery-nav next","aria-label":"下一张照片",onClick:()=>a(1),children:t.jsx(D,{name:"left"})})]})]}),t.jsxs("div",{className:"photo-viewer-toolbar","aria-label":"照片缩放",children:[t.jsxs("div",{className:"photo-zoom-buttons",children:[t.jsx("button",{type:"button","aria-label":"缩小照片",title:"缩小照片",disabled:l.scale<=1.001,onClick:()=>N(h.current.scale/1.5),children:"−"}),t.jsxs("output",{"aria-label":"相对原始尺寸",children:[V,"%"]}),t.jsx("button",{type:"button","aria-label":"放大照片",title:"放大照片",disabled:l.scale>=r.maxScale-.001,onClick:()=>N(h.current.scale*1.5),children:"+"})]}),t.jsx("button",{type:"button",className:"photo-size-button",onClick:()=>N(r.maxScale),children:"原始尺寸"}),t.jsx("button",{type:"button",className:"photo-size-button",onClick:()=>k($),children:"还原"}),t.jsxs("span",{className:"photo-native-size",children:[n.width," × ",n.height]})]}),t.jsx("p",{className:"photo-viewer-tip",children:"滚轮 / 双击 / 双指放大，拖动查看细节"})]})}const S=18;function G(n,a){return Number.isFinite(n)?Math.max(0,Math.min(Math.trunc(n),a-1)):0}function Z({photo:n}){const[a,c]=u.useState(!1);return a?t.jsx(D,{name:"photos"}):t.jsx("img",{src:W(n.thumbnail||n.src),width:n.width,height:n.height,alt:"",loading:"lazy",decoding:"async",onError:()=>c(!0)})}
// The runtime is shared with the validated live application; no duplicate React copy.
const {useCallback,useEffect,useRef,useState}=u;
const {_jsx,_jsxs,_Fragment}={_jsx:t.jsx,_jsxs:t.jsxs,_Fragment:t.Fragment};
const assetUrl=W,Icon=D,Dialog=Dg,PhotoViewer=O;

/** Index arithmetic for a two-photo book spread. Preserves the selected photo on the left. */
function bookPageIndex(index, count) {
    if (!Number.isFinite(count) || count <= 0)
        return 0;
    if (!Number.isFinite(index))
        return 0;
    return ((Math.trunc(index) % count) + count) % count;
}
/** The last page wraps to the first photo when the count is odd. */
function bookPagePair(index, count) {
    const first = bookPageIndex(index, count);
    return [first, bookPageIndex(first + 1, count)];
}

const FLIP_MS = 740;
function PhotoPrint({ photo, onOpen, inert = false }) {
    const [failed, setFailed] = useState(false);
    const image = _jsxs("span", { className: "memory-album-print", children: [failed
                ? _jsx("span", { className: "memory-album-print-fallback", "aria-hidden": "true", children: _jsx(Icon, { name: "photos" }) })
                : _jsx("img", { src: assetUrl(photo.src || photo.thumbnail), width: photo.width, height: photo.height, alt: "", draggable: false, decoding: "sync", loading: "eager", onError: () => setFailed(true) }), _jsx("span", { className: "memory-album-photo-corners", "aria-hidden": "true" })] });
    if (inert)
        return _jsx("span", { className: "memory-album-photo-mount", "aria-hidden": "true", children: image });
    return _jsx("button", { type: "button", className: "memory-album-photo-mount", "aria-label": `查看高清照片：${photo.alt || '照片'}`, onClick: onOpen, title: "\u67E5\u770B\u9AD8\u6E05\u7167\u7247", children: image });
}
function BookPage({ photo, side, onOpen }) {
    return _jsxs("div", { className: `memory-album-sheet memory-album-sheet--${side}`, children: [_jsx("div", { className: "memory-album-paper-grain", "aria-hidden": "true" }), _jsx(PhotoPrint, { photo: photo, onOpen: onOpen }, photo.id), _jsx("span", { className: "memory-album-paper-gilt", "aria-hidden": "true" })] });
}
function PhotoGallery({ photos, initialIndex, handNavigation, handMode, onCloseHandMode }) {
    const count = photos.length;
    const [index, setIndex] = useState(() => bookPageIndex(initialIndex, count));
    const [turn, setTurn] = useState(null);
    const [turnMoving, setTurnMoving] = useState(false);
    const [turnHalf, setTurnHalf] = useState(false);
    // Keep the incoming page visible until its new stationary image has
    // decoded and painted. Mobile Safari otherwise flashes the old paper
    // when the transient leaf and reveal unmount in the commit frame.
    const [settling, setSettling] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const pendingTurn = useRef(null);
    const warmed = useRef(new Map());
    const [corner, setCorner] = useState(null);
    const cornerRef = useRef(null);
    const skipCornerClick = useRef(false);
    const swipeStart = useRef(null);
    const suppressPhotoTapUntil = useRef(0);
    const [enlarged, setEnlarged] = useState(null);
    const navigationSeq = useRef(handNavigation?.sequence ?? 0);
    const ensureDecoded = useCallback(photo => {
        if (!photo) return Promise.resolve(false);
        const src = assetUrl(photo.src || photo.thumbnail);
        const cached = warmed.current.get(src);
        if (cached) return cached.ready;
        const image = new Image();
        image.decoding = 'async';
        image.src = src;
        const ready = typeof image.decode === 'function'
            ? image.decode().then(() => true, () => image.complete && image.naturalWidth > 0)
            : new Promise(resolve => {
                if (image.complete) { resolve(image.naturalWidth > 0); return; }
                image.addEventListener('load', () => resolve(true), { once: true });
                image.addEventListener('error', () => resolve(false), { once: true });
            });
        warmed.current.set(src, { image, ready });
        // Bound decoded-image references on phones to prevent unbounded
        // memory use while still holding the current/neighboring spreads.
        while (warmed.current.size > 8) {
            warmed.current.delete(warmed.current.keys().next().value);
        }
        return ready;
    }, []);
    useEffect(() => () => { pendingTurn.current = null; }, []);
    useEffect(() => {
        pendingTurn.current = null;
        setPreparing(false);
        setIndex(bookPageIndex(initialIndex, count));
        setTurn(null);
        setSettling(false);
        setTurnHalf(false);
        setTurnMoving(false);
        setCorner(null);
        cornerRef.current = null;
    }, [initialIndex, count]);
    useEffect(() => {
        if (!handNavigation || handNavigation.sequence === navigationSeq.current)
            return;
        navigationSeq.current = handNavigation.sequence;
        if (count < 2)
            return;
        pendingTurn.current = null;
        setPreparing(false);
        setTurn(null);
        setSettling(false);
        setTurnHalf(false);
        setTurnMoving(false);
        setCorner(null);
        cornerRef.current = null;
        setIndex(value => bookPageIndex(value + handNavigation.direction * 2, count));
    }, [handNavigation, count]);
    const requestTurn = useCallback((direction, progress = 0) => {
        if (count < 2 || turn || settling || pendingTurn.current)
            return;
        const to = bookPageIndex(index + direction * 2, count);
        const token = {};
        pendingTurn.current = token;
        setPreparing(true);
        // Decode BOTH pages of the destination spread before starting the
        // turn. This prevents empty reveal textures on memory-limited phones.
        const targets = bookPagePair(to, count);
        void Promise.all(targets.map(at => ensureDecoded(photos[at]))).then(() => {
            if (pendingTurn.current !== token) return;
            pendingTurn.current = null;
            setPreparing(false);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                setIndex(to);
                setCorner(null);
                return;
            }
            setTurnHalf(false);
            setTurnMoving(false);
            setSettling(false);
            setTurn({ direction, from: index, to, startProgress: Math.max(0, Math.min(1, progress)) });
            setCorner(null);
        }, () => {
            if (pendingTurn.current === token) {
                pendingTurn.current = null;
                setPreparing(false);
            }
        });
    }, [count, index, turn, settling, photos, ensureDecoded]);
    useEffect(() => {
        if (!turn)
            return;
        // A separate frame allows the book leaf to visibly travel from its
        // initial angle (or the user's drag angle) to the opposite page.
        const raf = window.requestAnimationFrame(() => setTurnMoving(true));
        const halfway = window.setTimeout(() => setTurnHalf(true), FLIP_MS * 0.87);
        const finished = window.setTimeout(() => {
            // Commit new stationary images UNDER the fully revealed incoming
            // spread, while leaving that spread mounted during image decode.
            setTurnHalf(true);
            setIndex(turn.to);
            setSettling(true);
        }, FLIP_MS + 80);
        return () => {
            window.cancelAnimationFrame(raf);
            window.clearTimeout(halfway);
            window.clearTimeout(finished);
        };
    }, [turn]);
    // Wait for the new stationary <img> elements to decode and paint before
    // removing the incoming overlay. Preserve it on Safari across several
    // rendering frames, even when the image was cached by the preloader.
    useEffect(() => {
        if (!settling || !turn) return;
        let cancelled = false;
        const frames = [];
        const awaitPaint = () => new Promise(resolve => {
            frames.push(window.requestAnimationFrame(() => {
                frames.push(window.requestAnimationFrame(() => {
                    frames.push(window.requestAnimationFrame(resolve));
                }));
            }));
        });
        const waitForImage = img => {
            if (!img) return Promise.resolve();
            if (img.complete && img.naturalWidth > 0) {
                return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
            }
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        };
        void (async () => {
            const images = [...document.querySelectorAll(
                '.memory-album-spread > .memory-album-sheet .memory-album-print img'
            )];
            await Promise.all(images.map(waitForImage));
            if (cancelled) return;
            await awaitPaint();
            if (cancelled) return;
            setTurn(null);
            setTurnMoving(false);
            setTurnHalf(false);
            setSettling(false);
        })();
        return () => {
            cancelled = true;
            frames.forEach(id => window.cancelAnimationFrame(id));
        };
    }, [turn, settling]);
    // Decode the active spread and immediate neighbors ahead of gestures.
    useEffect(() => {
        if (!count) return;
        for (const at of [index, index + 1, index + 2, index + 3, index - 2, index - 1]) {
            void ensureDecoded(photos[bookPageIndex(at, count)]);
        }
    }, [count, index, photos, ensureDecoded]);
    useEffect(() => {
        if (enlarged !== null || count < 2)
            return;
        const onKeyDown = (event) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
                return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                return;
            if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))
                return;
            event.preventDefault();
            requestTurn(event.key === 'ArrowRight' ? 1 : -1);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [count, enlarged, requestTurn]);
    const beginCorner = (event, direction) => {
        if (turn || preparing || count < 2 || event.button !== 0)
            return;
        const drag = { id: event.pointerId, direction, startX: event.clientX, progress: 0 };
        cornerRef.current = drag;
        setCorner(drag);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    const moveCorner = (event) => {
        const drag = cornerRef.current;
        if (!drag || drag.id !== event.pointerId)
            return;
        const inward = drag.direction === 1 ? drag.startX - event.clientX : event.clientX - drag.startX;
        const progress = Math.max(0, Math.min(0.98, inward / 160));
        const next = { ...drag, progress };
        cornerRef.current = next;
        setCorner(next);
    };
    const finishCorner = (event, cancel = false) => {
        const drag = cornerRef.current;
        if (!drag || drag.id !== event.pointerId)
            return;
        cornerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        skipCornerClick.current = !cancel;
        if (cancel) {
            setCorner(null);
            return;
        }
        // A tap folds the page; a dragged corner completes the fold once released.
        requestTurn(drag.direction, drag.progress);
    };
    const onCornerClick = (direction) => {
        if (skipCornerClick.current) {
            skipCornerClick.current = false;
            return;
        }
        requestTurn(direction);
    };
    const openPrint = (photoIndex) => {
        if (turn || preparing || performance.now() < suppressPhotoTapUntil.current)
            return;
        setEnlarged(photoIndex);
    };
    // Pointer events cover real iOS/Android swipes and desktop drag. Keep
    // quick taps as photo-open actions, and leave vertical scroll untouched.
    const startSwipe = (event) => {
        if (turn || preparing || corner || enlarged !== null || count < 2 ||
            (event.pointerType === "mouse" && event.button !== 0) ||
            (event.pointerType === "touch" && !event.isPrimary)) {
            swipeStart.current = null;
            return;
        }
        swipeStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
    };
    const moveSwipe = (event) => {
        const touch = swipeStart.current;
        if (!touch || touch.id !== event.pointerId || touch.axis === "vertical")
            return;
        const dx = event.clientX - touch.x, dy = event.clientY - touch.y;
        if (!touch.axis && Math.hypot(dx, dy) > 14)
            touch.axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? "horizontal" : "vertical";
        if (touch.axis === "horizontal" && event.pointerType === "touch" && event.cancelable)
            event.preventDefault();
    };
    const endSwipe = (event, cancel = false) => {
        const touch = swipeStart.current;
        if (!touch || touch.id !== event.pointerId) return;
        swipeStart.current = null;
        if (cancel || turn || corner) return;
        const dx = event.clientX - touch.x, dy = event.clientY - touch.y;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.30 || touch.axis === "vertical") return;
        suppressPhotoTapUntil.current = performance.now() + 650;
        event.preventDefault();
        event.stopPropagation();
        requestTurn(dx < 0 ? 1 : -1);
    };
    const suppressSwipeClick = (event) => {
        if (performance.now() < suppressPhotoTapUntil.current) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    if (!count)
        return _jsx("div", { className: "memory-album-empty", role: "status", "aria-label": "\u6682\u65E0\u7167\u7247", children: _jsx(Icon, { name: "photos" }) });
    const [leftAtRest, rightAtRest] = bookPagePair(index, count);
    const [nextLeft, nextRight] = turn ? bookPagePair(turn.to, count) : [leftAtRest, rightAtRest];
    // Keep stationary half pages fixed for the entire flip.
    const leftIndex = turn?.direction === -1 ? nextLeft : leftAtRest;
    const rightIndex = turn?.direction === 1 ? nextRight : rightAtRest;
    const activeLeaf = settling ? null : (turn?.direction ?? corner?.direction);
    const leafFrom = turn?.from ?? index;
    const leafTo = turn?.to ?? bookPageIndex(index + (activeLeaf ?? 1) * 2, count);
    const [leafCurrentLeft, leafCurrentRight] = bookPagePair(leafFrom, count);
    const [leafNextLeft, leafNextRight] = bookPagePair(leafTo, count);
    const startProgress = turn?.startProgress ?? corner?.progress ?? 0;
    const angle = (activeLeaf === 1 ? -1 : 1) * (turnMoving ? 179.9 : startProgress * 179.9);
    const leafStyle = { '--memory-turn-angle': `${angle}deg` };
    return _jsxs("div", { className: "memory-album", "aria-label": "\u7ACB\u4F53\u76F8\u518C", children: [_jsxs("div", { className: "memory-album-stage", children: [_jsx("div", { className: "memory-album-ground-shadow", "aria-hidden": "true" }), _jsxs("div", { className: "memory-album-book", "data-book-phase": settling ? "settling" : turn ? "turning" : preparing ? "loading" : "ready", role: "group", "aria-label": "\u7FFB\u5F00\u7684\u76F8\u518C\uFF0C\u70B9\u51FB\u7167\u7247\u67E5\u770B\u9AD8\u6E05\u5927\u56FE", children: [_jsx("div", { className: "memory-album-cover", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-cover-emboss", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-page-block", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-page-spine", "aria-hidden": "true" }), _jsxs("div", { className: "memory-album-spread", onPointerDownCapture: startSwipe, onPointerMoveCapture: moveSwipe, onPointerUpCapture: endSwipe, onPointerCancelCapture: event => endSwipe(event, true), onClickCapture: suppressSwipeClick, children: [_jsx(BookPage, { photo: photos[leftIndex], side: "left", onOpen: () => openPrint(leftIndex) }, `left-${photos[leftIndex].id}`), _jsx(BookPage, { photo: photos[rightIndex], side: "right", onOpen: () => openPrint(rightIndex) }, `right-${photos[rightIndex].id}`), turn && _jsx("div", { className: `memory-album-reveal memory-album-reveal--${turn.direction === 1 ? 'left' : 'right'}${turnHalf ? ' is-revealed' : ''}${settling ? ' is-settling' : ''}`, children: _jsx(BookPage, { photo: photos[turn.direction === 1 ? nextLeft : nextRight], side: turn.direction === 1 ? 'left' : 'right', onOpen: () => openPrint(turn.direction === 1 ? nextLeft : nextRight) }, `reveal-${photos[turn.direction === 1 ? nextLeft : nextRight].id}`) })] }), activeLeaf && _jsxs("div", { className: `memory-album-leaf memory-album-leaf--${activeLeaf === 1 ? 'forward' : 'backward'}${turnMoving ? ' is-moving' : ''}`, style: leafStyle, "aria-hidden": "true", children: [_jsx("div", { className: "memory-album-leaf-face memory-album-leaf-front", children: _jsx(PhotoPrint, { photo: photos[activeLeaf === 1 ? leafCurrentRight : leafCurrentLeft], inert: true }, `front-${leafFrom}-${activeLeaf}`) }), _jsx("div", { className: "memory-album-leaf-face memory-album-leaf-back", children: _jsx(PhotoPrint, { photo: photos[activeLeaf === 1 ? leafNextLeft : leafNextRight], inert: true }, `back-${leafTo}-${activeLeaf}`) })] }), _jsx("div", { className: "memory-album-binding", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-corner-foil memory-album-corner-foil--tl", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-corner-foil memory-album-corner-foil--tr", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-corner-foil memory-album-corner-foil--bl", "aria-hidden": "true" }), _jsx("div", { className: "memory-album-corner-foil memory-album-corner-foil--br", "aria-hidden": "true" })] }), count > 1 && _jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "memory-album-turn memory-album-turn--previous", "aria-label": "\u5411\u524D\u7FFB\u9875", disabled: !!turn || preparing, onPointerDown: event => beginCorner(event, -1), onPointerMove: moveCorner, onPointerUp: finishCorner, onPointerCancel: event => finishCorner(event, true), onClick: () => onCornerClick(-1), children: _jsx(Icon, { name: "left" }) }), _jsx("button", { type: "button", className: "memory-album-turn memory-album-turn--next", "aria-label": "\u5411\u540E\u7FFB\u9875", disabled: !!turn || preparing, onPointerDown: event => beginCorner(event, 1), onPointerMove: moveCorner, onPointerUp: finishCorner, onPointerCancel: event => finishCorner(event, true), onClick: () => onCornerClick(1), children: _jsx(Icon, { name: "left" }) })] })] }), handMode && onCloseHandMode && _jsxs("button", { type: "button", className: "memory-album-camera-off", onClick: onCloseHandMode, "aria-label": "\u5173\u95ED\u6444\u50CF\u5934\u624B\u52BF\u6A21\u5F0F", title: "\u5173\u95ED\u6444\u50CF\u5934\u624B\u52BF\u6A21\u5F0F", children: [_jsx(Icon, { name: "hand" }), _jsx(Icon, { name: "close" })] }), enlarged !== null && _jsx(Dialog, { title: "\u9AD8\u6E05\u7167\u7247", className: "memory-album-zoom-dialog", onClose: () => setEnlarged(null), children: _jsx(PhotoViewer, { photo: photos[enlarged], onStep: count > 1
                        ? direction => setEnlarged(value => value === null ? null : bookPageIndex(value + direction, count))
                        : undefined }, photos[enlarged].id) })] });
}

export{PhotoGallery as default};
