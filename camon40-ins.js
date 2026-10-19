(() => {
  'use strict';
  const scene = document.querySelector('#in-context');
  const card = scene?.querySelector('.ins-card');
  if (!card) return;
  const presentation = scene.querySelector('.ins-presentation') || card;
  const green = card.querySelector('.ins-green');
  const black = card.querySelector('.ins-black');
  const white = card.querySelector('.ins-white');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Adapt the PPT's green-first / black-before-white rhythm for direct scrolling.
  const SETTLE = 450, GESTURE_GAP = 240;
  const MORPH = 1600, RISE_AT = 900, BLACK_RISE = 1900, WHITE_RISE = 2200;
  const TOTAL = RISE_AT + WHITE_RISE;
  const clamp = x => Math.max(0, Math.min(1, x));
  const morphEase = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
  const arrival = x => 1 - (1 - clamp(x)) ** 3;
  let hasPlayed = false, pendingPlay = false;
  let phase = 'idle', heldAt = 0, startedAt = 0, lastInput = -Infinity;
  let lastY = scrollY, lastDown = -Infinity, frame = 0, elapsed = 0, holdTimer = 0;
  let targetY = 0, dockFrom = 0, dockAt = 0, dockDuration = 450, diagnosticAt = -Infinity;
  let width = 1396.8, height = width / (11800840 / 6284595), touchY = null, touchFresh = false;
  const pinned = () => ['hold', 'playing', 'complete'].includes(phase);
  const locked = () => phase === 'docking' || pinned();
  const setPhase = value => { phase = value; card.dataset.scrollStage = value; };
  function paint(ms) {
    elapsed = ms;
    const g = morphEase(ms / MORPH);
    const b = arrival((ms - RISE_AT) / BLACK_RISE);
    const w = arrival((ms - RISE_AT) / WHITE_RISE);
    const scale = 1 + (1 / .5892 - 1) * (1 - g);
    green.style.transform = `translate3d(${.048965 * width * (1 - g)}px,${.1567305 * height * (1 - g)}px,0) rotate(-22deg) scale(${scale})`;
    // Begin below the mask: no visibility switch partway through the choreography.
    black.style.transform = `translate3d(0,${.28 * width * (1 - b)}px,0) rotate(27deg)`;
    white.style.transform = `translate3d(0,${.1677355 * width * (1 - w)}px,0) rotate(-19deg)`;
    if (ms === 0 || ms === TOTAL || Math.abs(ms - diagnosticAt) >= 100) {
      card.dataset.elapsed = String(Math.round(ms));
      card.dataset.greenProgress = g.toFixed(4);
      card.dataset.blackProgress = b.toFixed(4);
      card.dataset.whiteProgress = w.toFixed(4);
      diagnosticAt = ms;
    }
  }
  function pin() {
    if (Math.abs(scrollY - targetY) > .5) scrollTo({top: targetY, behavior: 'instant'});
    lastY = scrollY;
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(holdTimer); holdTimer = 0;
    pendingPlay = false;
    scene.classList.remove('is-ins-playing', 'is-ins-prepared');
  }
  function release(reset = false) {
    stop(); setPhase('released');
    if (hasPlayed || reduced.matches) paint(TOTAL);
    else if (reset) paint(0);
    else if (elapsed > 0) paint(TOTAL);
    lastY = scrollY;
  }
  function ready() {
    holdTimer = 0;
    if (phase !== 'hold') return;
    card.dataset.ready = 'true';
    if (pendingPlay) play();
  }
  function hold(now) {
    frame = 0;
    setPhase('hold'); heldAt = now;
    card.dataset.holdStartedAt = String(heldAt);
    pin(); holdTimer = setTimeout(ready, SETTLE);
  }
  function dockTick(now) {
    frame = 0;
    if (phase !== 'docking') return;
    const t = clamp((now - dockAt) / dockDuration);
    scrollTo({top: dockFrom + (targetY - dockFrom) * arrival(t), behavior: 'instant'});
    lastY = scrollY;
    if (t < 1) frame = requestAnimationFrame(dockTick);
    else hold(now);
  }
  function dock() {
    stop(); paint(0); setPhase('docking');
    card.dataset.ready = 'false';
    scene.classList.add('is-ins-prepared');
    dockFrom = scrollY; dockAt = performance.now();
    dockDuration = Math.max(360, Math.min(560, Math.abs(targetY - dockFrom) * 2.2 + 160));
    card.dataset.dockStartedAt = String(dockAt);
    card.dataset.dockDuration = String(Math.round(dockDuration));
    frame = requestAnimationFrame(dockTick);
  }
  function tick(now) {
    frame = 0;
    if (phase !== 'playing') return;
    const ms = Math.min(TOTAL, now - startedAt);
    paint(ms);
    if (ms < TOTAL) frame = requestAnimationFrame(tick);
    else { scene.classList.remove('is-ins-playing', 'is-ins-prepared'); setPhase('complete'); }
  }
  function play() {
    clearTimeout(holdTimer); holdTimer = 0; pendingPlay = false;
    hasPlayed = true; card.dataset.played = 'true';
    setPhase('playing'); startedAt = performance.now();
    card.dataset.playStartedAt = String(startedAt);
    scene.classList.add('is-ins-playing');
    frame = requestAnimationFrame(tick);
  }
  function handle(delta, event, fresh) {
    if (reduced.matches) return;
    if (delta < 0) {
      lastDown = -Infinity;
      if (locked()) release(true);
      return;
    }
    lastDown = performance.now();
    const lead = Math.max(96, Math.min(180, innerHeight * .18));
    const distance = targetY - scrollY;
    // Capture only the approach zone; a fast page skip must not pull the reader back.
    if (!hasPlayed && phase === 'idle' && distance >= 0 && distance <= lead + Math.min(delta, lead)) {
      event.preventDefault(); dock(); return;
    }
    if (!locked()) return;
    if (phase === 'complete' && fresh) { release(); return; }
    event.preventDefault();
    if (phase === 'docking') {
      if (fresh) pendingPlay = true;
      return;
    }
    pin();
    if (phase === 'hold' && fresh) {
      pendingPlay = true;
      if (performance.now() - heldAt >= SETTLE) play();
    }
  }
  addEventListener('wheel', event => {
    if (event.defaultPrevented || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const now = performance.now(), fresh = now - lastInput > GESTURE_GAP;
    lastInput = now;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    handle(delta, event, fresh);
  }, {passive: false});
  addEventListener('scroll', () => {
    // The docking rAF owns scroll position until deceleration has finished.
    if (phase === 'docking') return;
    if (pinned()) { pin(); return; }
    const y = scrollY;
    if (!hasPlayed && !reduced.matches && phase === 'released' && y < targetY - 80) { setPhase('idle'); paint(0); }
    const lead = Math.max(96, Math.min(180, innerHeight * .18));
    if (!hasPlayed && !reduced.matches && phase === 'idle' && performance.now() - lastDown < 250 && y > lastY && y >= targetY - lead && y <= targetY) dock();
    lastY = y;
  }, {passive: true});
  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.target.closest('input,textarea,select,[contenteditable]')) return;
    if (['Escape', 'Home', 'End'].includes(event.key)) { release(event.key !== 'End'); return; }
    if (event.target.closest('button,a')) return;
    const down = ['ArrowDown', 'PageDown', ' '].includes(event.key) && !event.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    if (down || up) {
      const now = performance.now(), fresh = !event.repeat && now - lastInput > GESTURE_GAP;
      lastInput = now;
      handle(down ? (event.key === 'ArrowDown' ? 40 : innerHeight * .8) : -40, event, fresh);
    }
  });
  addEventListener('touchstart', event => {
    touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    touchFresh = performance.now() - lastInput > GESTURE_GAP;
  }, {passive: true});
  addEventListener('touchmove', event => {
    if (touchY === null || event.touches.length !== 1) return;
    const next = event.touches[0].clientY, delta = touchY - next;
    if (Math.abs(delta) < 3) return;
    handle(delta, event, touchFresh); touchFresh = false;
    touchY = next; lastInput = performance.now();
  }, {passive: false});
  addEventListener('touchend', () => { touchY = null; lastInput = performance.now(); }, {passive: true});
  document.addEventListener('click', event => { if (event.target.closest('a[href]')) release(); }, true);
  addEventListener('pointerdown', event => { if (event.clientX >= document.documentElement.clientWidth) release(); }, {passive: true});
  function measure() {
    const scale = document.body.getBoundingClientRect().width / 1440;
    scene.style.setProperty('--ins-stage-height', `${innerHeight / scale}px`);
    const r = card.getBoundingClientRect(), group = presentation.getBoundingClientRect();
    width = r.width / scale; height = r.height / scale;
    targetY = Math.max(0, group.top + scrollY + (group.height - innerHeight) / 2);
    paint(elapsed);
    if (phase === 'docking') {
      // Preserve a queued gesture while adapting an in-flight stop to the new viewport.
      const queued = pendingPlay; dock(); pendingPlay = queued;
    } else if (pinned()) pin();
  }
  function setup(resetPlayback = false) {
    if (resetPlayback) hasPlayed = false;
    card.dataset.played = String(hasPlayed);
    const showFinal = reduced.matches || hasPlayed;
    stop(); setPhase(showFinal ? 'released' : 'idle');
    elapsed = showFinal ? TOTAL : 0; measure(); lastY = scrollY;
    lastDown = -Infinity; lastInput = -Infinity;
  }
  addEventListener('resize', measure, {passive: true});
  addEventListener('load', measure, {once: true});
  addEventListener('pageshow', event => { if (event.persisted) setup(true); else measure(); });
  reduced.addEventListener('change', () => setup());
  document.addEventListener('visibilitychange', () => { if (document.hidden && locked()) release(true); });
  setup(true);
})();

(() => {
  'use strict';
  const button = document.querySelector('.ins-like');
  const card = document.querySelector('.ins-card');
  if (!button || !card) return;
  const heart = button.querySelector('svg');
  const key = 'portfolio:camon40:design-like:v1';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let liked = false, bounce = null;
  function paint(value) {
    liked = value;
    button.setAttribute('aria-pressed', String(liked));
    button.setAttribute('aria-label', liked ? 'Unlike this design' : 'Like this design');
  }
  function restore() {
    try { paint(localStorage.getItem(key) === '1'); }
    catch { /* Storage may be unavailable; keep the current in-memory choice. */ }
  }
  function setLike(value) {
    paint(value);
    try { localStorage.setItem(key, liked ? '1' : '0'); }
    catch { /* The toggle still works when browser storage is unavailable. */ }
    bounce?.cancel();
    if (!reduced.matches) {
      bounce = heart.animate([
        {transform: 'scale(1)', offset: 0},
        {transform: 'scale(.82)', offset: .2},
        {transform: 'scale(1.18)', offset: .55},
        {transform: 'scale(1)', offset: 1}
      ], {duration: 340, easing: 'ease-out'});
    }
  }
  // Each tap owns its heart: new feedback never restarts an older trail.
  const effects = document.createElement('div');
  effects.className = 'ins-heart-effects';
  effects.setAttribute('aria-hidden', 'true');
  card.append(effects);
  const bursts = new Map();
  let burstId = 0, press = null, lastTap = null, chaining = false;
  const isControl = target => target.closest('button, a, input, select, textarea, summary, [contenteditable="true"]');
  function resetGesture() { press = null; lastTap = null; chaining = false; }
  function removeBurst(node) {
    const animation = bursts.get(node);
    bursts.delete(node);
    if (animation) {
      animation.onfinish = animation.oncancel = null;
      animation.cancel();
    }
    node.remove();
  }
  function clearEffects() {
    resetGesture();
    for (const node of bursts.keys()) removeBurst(node);
  }
  function spawnHeart(x, y) {
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    while (bursts.size >= 16) removeBurst(bursts.keys().next().value);
    // The page uses CSS zoom. Keep the tap position and heart size in screen pixels.
    const scale = rect.width / card.offsetWidth;
    const size = Math.min(120, rect.width * .24) / scale;
    const rise = Math.min(72, rect.height * .22) / scale;
    const angle = Math.random() * 36 - 18;
    const drift = (Math.random() * 16 - 8) / scale;
    const node = document.createElement('span');
    const gradient = `ins-heart-gradient-${++burstId}`;
    node.className = 'ins-heart-burst';
    node.style.left = `${(x - rect.left) / rect.width * 100}%`;
    node.style.top = `${(y - rect.top) / rect.height * 100}%`;
    node.style.width = node.style.height = `${size}px`;
    node.innerHTML = `<svg viewBox="0 0 100 100" focusable="false" aria-hidden="true"><defs><linearGradient id="${gradient}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ff6380"/><stop offset="1" stop-color="#ff2848"/></linearGradient></defs><path fill="url(#${gradient})" d="M50 94C43 87 0 62 0 33C0 8 32 0 50 22C68 0 100 8 100 33C100 62 57 87 50 94Z"/></svg>`;
    effects.append(node);
    const pose = (s, y, x = 0) => `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${s})`;
    const frames = reduced.matches ? [
      {opacity: .9}, {opacity: 0}
    ] : [
      {transform: pose(.3, 0), opacity: 0, offset: 0, easing: 'cubic-bezier(.16,1,.3,1)'},
      {transform: pose(1.08, 0), opacity: 1, offset: .14, easing: 'ease-out'},
      {transform: pose(1, -rise * .04), opacity: 1, offset: .25},
      {transform: pose(1.16, -rise * .22, drift * .2), opacity: .88, offset: .42},
      {transform: pose(1.58, -rise * .62, drift * .6), opacity: .38, offset: .72},
      {transform: pose(1.95, -rise, drift), opacity: 0, offset: 1}
    ];
    const animation = node.firstElementChild.animate(frames, {duration: reduced.matches ? 220 : 1000, fill: 'both'});
    bursts.set(node, animation);
    animation.onfinish = animation.oncancel = () => removeBurst(node);
  }
  function tap(x, y) {
    const time = performance.now();
    const continuing = lastTap && time - lastTap.time <= (chaining ? 420 : 360)
      && (chaining || Math.hypot(x - lastTap.x, y - lastTap.y) <= 32);
    chaining = Boolean(continuing);
    lastTap = {time, x, y};
    if (chaining) { setLike(true); spawnHeart(x, y); }
  }
  // Pointer-up handles mouse and touch once, without duplicate compatibility clicks.
  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || !card.contains(event.target)) resetGesture();
  }, {capture: true, passive: true});
  card.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || isControl(event.target)) { resetGesture(); return; }
    press = {id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: false};
  }, {passive: true});
  card.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.moved = true;
  }, {passive: true});
  card.addEventListener('pointerup', event => {
    const start = press; press = null;
    if (!start || start.id !== event.pointerId) return;
    if (start.moved || performance.now() - start.time > 600
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 || isControl(event.target)) { resetGesture(); return; }
    tap(event.clientX, event.clientY);
  }, {passive: true});
  card.addEventListener('pointercancel', resetGesture, {passive: true});
  card.addEventListener('dblclick', event => { if (!isControl(event.target)) event.preventDefault(); });
  button.addEventListener('click', () => { resetGesture(); setLike(!liked); });
  addEventListener('scroll', resetGesture, {passive: true});
  addEventListener('resize', clearEffects, {passive: true});
  addEventListener('pagehide', clearEffects);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearEffects(); });
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) clearEffects(); }).observe(card);
  addEventListener('storage', event => { if (event.key === key || event.key === null) restore(); });
  addEventListener('pageshow', restore);
  reduced.addEventListener('change', () => { clearEffects(); if (reduced.matches) bounce?.cancel(); });
  restore();
})();
