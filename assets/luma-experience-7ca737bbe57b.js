/* Luma Garden: opt-in, low-overhead interaction layer for the existing three-cat scene.
   CSS and DOM are self-contained. No third-party fonts, images, network requests or tracking. */
(() => {
  'use strict';
  if (window.__lumaGardenBooted) return;
  window.__lumaGardenBooted = true;

  const CATS = [
    { id: 'black', name: '黑糖', note: '安静的探险家', glyph: '✦', color: '#c6bedf', greeting: '黑糖歪了歪头，认真看着你。' },
    { id: 'cream', name: '奶霜', note: '暖乎乎的好奇心', glyph: '☼', color: '#f5d6a3', greeting: '奶霜眨眨眼，像在和你打招呼。' },
    { id: 'calico', name: '花花', note: '爱追星星的精灵', glyph: '❀', color: '#e9b4a6', greeting: '花花轻轻摆了摆尾巴。' },
  ];
  const catById = Object.fromEntries(CATS.map(cat => [cat.id, cat]));
  const smallScreen = () => window.innerWidth < 700;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { open: false, tab: 'cats', mode: 'tree', selected: 'black', affection: { black: 0, cream: 0, calico: 0 }, met: new Set(), catsReady: Boolean(window.__lumaCatReady), gentle: motionQuery.matches };
  let shell, layer, panel, launcher, status, currentTimer;
  const pendingTimeouts = new Set();
  const addTimer = (fn, delay) => {
    const timer = window.setTimeout(() => { pendingTimeouts.delete(timer); fn(); }, delay);
    pendingTimeouts.add(timer);
    return timer;
  };
  const cleanEffects = () => {
    pendingTimeouts.forEach(timer => window.clearTimeout(timer));
    pendingTimeouts.clear();
    if (layer) layer.replaceChildren();
  };
  const isMuted = () => state.gentle || motionQuery.matches || document.hidden;
  const random = () => Math.random();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const emit = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));
  const camera = (command, payload = {}) => emit('luma:camera-command', { command, ...payload });

  function element(tag, cssClass, text) {
    const item = document.createElement(tag);
    if (cssClass) item.className = cssClass;
    if (text != null) item.textContent = text;
    return item;
  }
  function safeColor(id) { return catById[id]?.color ?? '#efd6aa'; }
  function notify(message) {
    if (!status) return;
    status.textContent = message;
    status.classList.remove('luma-status-pop');
    void status.offsetWidth;
    status.classList.add('luma-status-pop');
    if (currentTimer) window.clearTimeout(currentTimer);
    currentTimer = window.setTimeout(() => { status?.classList.remove('luma-status-pop'); }, 3100);
  }
  function createParticle(cssClass, left, top, { dx = 0, dy = 0, delay = 0, duration = 1700, color, char } = {}) {
    if (!layer) return;
    const node = element('i', cssClass, char);
    node.setAttribute('aria-hidden', 'true');
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.setProperty('--lx', `${dx}px`);
    node.style.setProperty('--ly', `${dy}px`);
    node.style.setProperty('--ld', `${delay}ms`);
    node.style.setProperty('--lt', `${duration}ms`);
    if (color) node.style.setProperty('--lc', color);
    layer.append(node);
    addTimer(() => node.remove(), delay + duration + 100);
  }
  function pulse(x = window.innerWidth * .5, y = window.innerHeight * .45) {
    if (!layer || isMuted()) return;
    for (let i = 0; i < 2; i++) createParticle('luma-vfx-ripple', x, y, { delay: i * 170, duration: 1350, color: '#f5d8a5' });
  }
  function scatter(kind, { x = window.innerWidth * .50, y = window.innerHeight * .46, color = '#ffe8b7' } = {}) {
    if (!layer || isMuted()) return;
    const count = smallScreen() ? 10 : 16;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + random() * .4;
      const radius = 32 + random() * (smallScreen() ? 96 : 135);
      const symbol = kind === 'heart' ? '♥' : kind === 'paw' ? '✦' : ['✧', '✦', '·'][i % 3];
      createParticle(`luma-vfx-spark luma-vfx-${kind}`, x + (random() - .5) * 18, y + (random() - .5) * 18, {
        dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius - 28,
        delay: Math.round(random() * 130), duration: 1200 + Math.round(random() * 600), char: symbol, color,
      });
    }
    pulse(x, y);
  }
  function meteors() {
    if (!layer || isMuted()) return;
    const width = window.innerWidth, height = window.innerHeight;
    const count = smallScreen() ? 7 : 11;
    for (let i = 0; i < count; i++) {
      createParticle('luma-vfx-meteor', width * (.12 + random() * .95), height * (-.16 + random() * .42), {
        dx: -width * (.25 + random() * .4), dy: height * (.18 + random() * .28),
        delay: i * 125 + Math.round(random() * 240), duration: 950 + Math.round(random() * 650),
      });
    }
  }
  function snow() {
    if (!layer || isMuted()) return;
    const width = window.innerWidth, height = window.innerHeight;
    const count = smallScreen() ? 18 : 30;
    for (let i = 0; i < count; i++) {
      createParticle('luma-vfx-snow', random() * width, -30 - random() * 140, {
        dx: (random() - .5) * 85, dy: height + 190,
        delay: Math.round(random() * 650), duration: 2300 + Math.round(random() * 1800),
      });
    }
  }
  function aurora() {
    if (!layer || isMuted()) return;
    const glow = element('div', 'luma-vfx-aurora');
    glow.setAttribute('aria-hidden', 'true');
    layer.append(glow);
    addTimer(() => glow.remove(), 5300);
  }
  function magic(kind, opts = {}) {
    if (kind === 'meteor') meteors();
    else if (kind === 'snow') snow();
    else if (kind === 'aurora') aurora();
    else if (kind === 'ripple') { pulse(); scatter('star', opts); }
    else scatter('star', opts);
  }

  function progressText() { return `本次认识了 ${state.met.size} / 3 只小猫`; }
  function setTab(tab) {
    if (!['cats', 'sky'].includes(tab)) return;
    state.tab = tab; render();
  }
  function focus(id, fromScene = false) {
    if (!catById[id]) return;
    state.selected = id;
    state.mode = 'cat';
    if (!fromScene) camera('focus', { id });
    state.open = true;
    render();
  }
  function returnTree() {
    state.mode = 'tree';
    camera('tree');
    render();
    notify('回到圣诞树，轻轻转动视角吧。');
  }
  function catAction(action) {
    const cat = catById[state.selected];
    if (!cat || !state.catsReady) { notify('小猫还在准备中，稍后再试一次。'); return; }
    if (state.mode !== 'cat') camera('focus', { id: cat.id });
    emit('luma:cat-action', { id: cat.id, action });
    state.mode = 'cat';
    state.met.add(cat.id);
    state.affection[cat.id] = Math.min(9, state.affection[cat.id] + 1);
    const origin = { x: window.innerWidth * .47, y: window.innerHeight * .44, color: cat.color };
    if (action === 'pet') { scatter('heart', origin); notify(`${cat.name}：${cat.greeting}`); }
    if (action === 'play') { scatter('paw', origin); meteors(); notify(`${cat.name}叫来了小伙伴，雪地里热闹起来。`); }
    if (action === 'gift') { scatter('star', origin); aurora(); notify(`一颗小星星送给了${cat.name}。`); }
    if (state.met.size === 3 && !shell.dataset.allMet) {
      shell.dataset.allMet = 'true';
      addTimer(() => { meteors(); notify('三枚猫爪印集齐！今晚的星光属于你。'); }, 1100);
    }
    render();
  }
  function updatePanelVisibility() {
    if (!panel || !launcher) return;
    if (panel.hidden !== !state.open) panel.hidden = !state.open;
    launcher.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    const caption = launcher.querySelector('.luma-launcher-caption');
    const nextCaption = state.open ? '收起魔法' : '打开魔法';
    if (caption.textContent !== nextCaption) caption.textContent = nextCaption;
    const modalOpen = Boolean(document.querySelector('dialog[open], .gift-dialog[open], .film-dialog[open]'));
    shell.classList.toggle('luma-under-modal', modalOpen);
  }
  function render() {
    if (!panel) return;
    const cat = catById[state.selected];
    const tabs = panel.querySelector('.luma-tabs');
    tabs.querySelectorAll('button').forEach(button => {
      const active = button.dataset.tab === state.tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    panel.querySelector('.luma-cats-view').hidden = state.tab !== 'cats';
    panel.querySelector('.luma-sky-view').hidden = state.tab !== 'sky';
    panel.querySelector('.luma-progress').textContent = progressText();
    const medals = panel.querySelector('.luma-progress-paws');
    medals.replaceChildren(...CATS.map(item => {
      const dot = element('span', `luma-paw-dot${state.met.has(item.id) ? ' is-collected' : ''}`, '✿');
      dot.style.setProperty('--cat-color', item.color);
      dot.title = `${item.name}${state.met.has(item.id) ? '已互动' : '尚未互动'}`;
      return dot;
    }));
    panel.querySelectorAll('[data-cat]').forEach(button => {
      const active = button.dataset.cat === state.selected;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    panel.querySelector('.luma-cat-name').textContent = `${cat.name} · ${cat.note}`;
    panel.querySelector('.luma-cat-tally').textContent = state.catsReady ? `本次互动 ${state.affection[cat.id]} 次` : '小猫准备中…';
    panel.querySelectorAll('.luma-cat-actions button').forEach(button => { button.disabled = !state.catsReady; });
    panel.style.setProperty('--luma-cat-accent', cat.color);
    const treeButton = panel.querySelector('[data-action="tree"]');
    treeButton.disabled = state.mode === 'tree';
    panel.querySelector('.luma-gentle-toggle').setAttribute('aria-pressed', String(state.gentle));
    panel.querySelector('.luma-gentle-toggle').textContent = state.gentle ? '柔和特效：开' : '柔和特效：关';
    updatePanelVisibility();
  }
  function build() {
    if (shell) return;
    const app = document.querySelector('.tree-app');
    if (!app) return;
    shell = element('div', 'luma-garden-shell');
    shell.innerHTML = `
      <div class="luma-effects" aria-hidden="true"></div>
      <div class="luma-hud">
        <button class="luma-fab" type="button" data-action="toggle" aria-expanded="false" aria-controls="luma-garden-panel">
          <span class="luma-launcher-icon" aria-hidden="true">✦</span>
          <span class="luma-launcher-copy"><strong>小猫魔法</strong><span class="luma-launcher-caption">打开魔法</span></span>
          <span class="luma-launcher-chevron" aria-hidden="true">⌃</span>
        </button>
        <section class="luma-panel" id="luma-garden-panel" role="region" aria-label="小猫与星光互动" hidden>
          <div class="luma-panel-top">
            <div><span class="luma-overline">AN ENCHANTED LITTLE WORLD</span><h2>星光与小猫</h2></div>
            <button class="luma-close" type="button" data-action="close" aria-label="收起互动面板">×</button>
          </div>
          <p class="luma-intro">不只是看风景，试着和它们打个招呼。</p>
          <div class="luma-tabs" role="tablist" aria-label="互动分类">
            <button type="button" role="tab" data-tab="cats" aria-selected="true">🐾 小猫</button>
            <button type="button" role="tab" data-tab="sky" aria-selected="false">✧ 星夜</button>
          </div>
          <div class="luma-cats-view">
            <div class="luma-cat-picker" role="group" aria-label="选择一只小猫">
              <button type="button" data-cat="black" aria-pressed="true"><span class="luma-cat-swatch cat-black">✦</span><span>黑糖</span></button>
              <button type="button" data-cat="cream" aria-pressed="false"><span class="luma-cat-swatch cat-cream">☼</span><span>奶霜</span></button>
              <button type="button" data-cat="calico" aria-pressed="false"><span class="luma-cat-swatch cat-calico">❀</span><span>花花</span></button>
            </div>
            <div class="luma-selected-card">
              <div class="luma-cat-meta"><strong class="luma-cat-name"></strong><span class="luma-cat-tally"></span></div>
              <div class="luma-cat-actions">
                <button type="button" data-action="pet"><span aria-hidden="true">♡</span> 摸摸头</button>
                <button type="button" data-action="play"><span aria-hidden="true">✢</span> 陪它玩</button>
                <button type="button" data-action="gift"><span aria-hidden="true">✧</span> 送星星</button>
              </div>
            </div>
            <div class="luma-collection"><span class="luma-progress"></span><div class="luma-progress-paws" aria-hidden="true"></div></div>
          </div>
          <div class="luma-sky-view" hidden>
            <p class="luma-sky-caption">为这个夜晚添一点不一样的魔法。</p>
            <div class="luma-sky-actions">
              <button type="button" data-effect="ripple"><span aria-hidden="true">◎</span><strong>星光涟漪</strong><small>双击也能触发</small></button>
              <button type="button" data-effect="meteor"><span aria-hidden="true">☄</span><strong>流星来访</strong><small>划过雪夜</small></button>
              <button type="button" data-effect="snow"><span aria-hidden="true">❄</span><strong>初雪加映</strong><small>温柔落下</small></button>
              <button type="button" data-effect="aurora"><span aria-hidden="true">∿</span><strong>极光时刻</strong><small>给天空换颜色</small></button>
            </div>
          </div>
          <div class="luma-view-tools">
            <div class="luma-view-row"><span>观察视角</span><div class="luma-control-group">
              <button type="button" data-action="orbit-left" aria-label="镜头向左转 25 度">↶</button>
              <button type="button" data-action="orbit-right" aria-label="镜头向右转 25 度">↷</button>
              <button type="button" data-action="zoom-out" aria-label="缩小场景">−</button>
              <button type="button" data-action="zoom-in" aria-label="放大场景">＋</button>
            </div></div>
            <div class="luma-view-foot"><button type="button" data-action="tree">⌂ 返回圣诞树</button><button type="button" class="luma-gentle-toggle" data-action="gentle" aria-pressed="false">柔和特效：关</button></div>
          </div>
          <p class="luma-help">单指转动 · 双指缩放 · 点小猫靠近 · 双击唤醒星光</p>
        </section>
      </div>
      <p class="luma-status" role="status" aria-live="polite" aria-atomic="true"></p>`;
    app.append(shell);
    layer = shell.querySelector('.luma-effects');
    panel = shell.querySelector('.luma-panel');
    launcher = shell.querySelector('.luma-fab');
    status = shell.querySelector('.luma-status');
    app.classList.add('luma-experience-ready');
    shell.addEventListener('pointerdown', event => { if (event.target.closest('button, .luma-panel')) event.stopPropagation(); });
    shell.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      event.stopPropagation();
      if (button.dataset.tab) { setTab(button.dataset.tab); return; }
      if (button.dataset.cat) { focus(button.dataset.cat); notify(`${catById[button.dataset.cat].name}正朝镜头走来。`); return; }
      if (button.dataset.effect) {
        magic(button.dataset.effect);
        const names = { ripple: '星光沿着夜色慢慢散开。', meteor: '流星从夜空悄悄划过。', snow: '今夜的雪更温柔了一点。', aurora: '极光把天空染上了新颜色。' };
        notify(names[button.dataset.effect]);
        return;
      }
      const action = button.dataset.action;
      if (['pet', 'play', 'gift'].includes(action)) { catAction(action); return; }
      switch (action) {
        case 'toggle': state.open = !state.open; render(); break;
        case 'close': state.open = false; render(); launcher.focus(); break;
        case 'tree': returnTree(); break;
        case 'zoom-in': camera('zoom', { factor: 1.22 }); break;
        case 'zoom-out': camera('zoom', { factor: 1 / 1.22 }); break;
        case 'orbit-left': camera('orbit', { yawDegrees: -25 }); break;
        case 'orbit-right': camera('orbit', { yawDegrees: 25 }); break;
        case 'gentle': state.gentle = !state.gentle; cleanEffects(); render(); break;
        default: break;
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state.open) { state.open = false; render(); launcher.focus(); }
    });
    window.addEventListener('luma:cat-model-ready', () => { state.catsReady = true; render(); });
    window.addEventListener('luma:cat-focus', event => {
      if (catById[event.detail?.id]) { focus(event.detail.id, true); notify(`${catById[event.detail.id].name}正在看着你。`); }
    });
    window.addEventListener('luma:scene-magic', event => {
      const kind = event.detail?.kind ?? 'ripple';
      magic(kind);
      if (event.detail?.source === 'double-tap') notify('树没有散开，只把星光送给了你。');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cleanEffects(); });
    const observer = new MutationObserver(() => updatePanelVisibility());
    observer.observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    render();
  }
  function waitForScene() {
    if (document.querySelector('.tree-app')) { build(); return; }
    const observer = new MutationObserver(() => {
      if (document.querySelector('.tree-app')) { observer.disconnect(); build(); }
    });
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 25000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForScene, { once: true });
  else waitForScene();
})();
