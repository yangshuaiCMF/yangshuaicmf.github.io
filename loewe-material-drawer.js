(() => {
  'use strict';
  const frame = document.querySelector('.material-reveal');
  if (!frame) return;
  const button = frame.querySelector('.material-drawer-toggle');
  const panel = frame.querySelector('.material-drawer');
  const diagram = panel.querySelector('img');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-aspect-ratio: 1/1)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = window.LoeweMotion.arrival;
  let progress = 0, width = 1, expanded = false, animation = null, raf = 0, drag = null, suppressClick = false;

  function paint(value) {
    progress = clamp(value);
    if (progress === 1 && expanded && isLocked() && phase !== 'open') { setPhase('open'); openedAt = performance.now(); }
    frame.style.setProperty('--drawer-offset', `${progress * width}px`);
    frame.style.setProperty('--drawer-progress', String(progress));
    panel.style.visibility = progress > 0 ? 'visible' : 'hidden';
    frame.dataset.drawerProgress = progress.toFixed(5);
    frame.dataset.drawerState = progress === 0 ? 'closed' : progress === 1 ? 'open' : drag?.moved ? 'dragging' : expanded ? 'opening' : 'closing';
    frame.classList.toggle('is-drawer-moving', !!animation || !!drag?.moved);
  }
  function access(open) {
    expanded = open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? '收起材质细节' : '展开材质细节');
    button.title = open ? '点击或向左拖动，收起材质细节' : '点击或向右拖动，展开材质细节';
    if (!open && panel.contains(document.activeElement)) button.focus({preventScroll: true});
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    if (open) diagram.loading = 'eager';
  }
  function cancelAnimation() { cancelAnimationFrame(raf); raf = 0; animation = null; }
  function tick(time) {
    raf = 0;
    if (!animation) return;
    const t = clamp((time - animation.start) / 640);
    const next = animation.from + (animation.to - animation.from) * ease(t);
    if (t === 1) animation = null;
    paint(next);
    if (animation) raf = requestAnimationFrame(tick);
  }
  function setOpen(open) {
    cancelAnimation(); access(open);
    if (!open && isLocked()) { setPhase('hold'); heldAt = performance.now(); }
    const to = open ? 1 : 0;
    if (reduced.matches || Math.abs(progress - to) < .0001) { paint(to); return; }
    animation = {from: progress, to, start: performance.now()};
    raf = requestAnimationFrame(tick);
  }
  function measure() { width = panel.getBoundingClientRect().width || 1; paint(progress); }
  // Stop at the image center: hold, reveal, then release on a separate gesture.
  let phase = 'idle', heldAt = 0, openedAt = 0, lastInputTime = 0;
  let lastScrollY = scrollY, lastDownTime = -Infinity, lockY = 0;
  const holdDuration = 360, gestureGap = 260, openHold = 0; // 360ms hold + 640ms reveal = 1s minimum sequence.
  function isLocked() { return ['hold', 'opening', 'open'].includes(phase); }
  function setPhase(value) { phase = value; frame.dataset.scrollStage = value; }
  function centerY() {
    const bounds = frame.getBoundingClientRect();
    return bounds.top + scrollY + (bounds.height - innerHeight) / 2;
  }
  function keepCentered() {
    lockY = centerY();
    if (Math.abs(scrollY - lockY) > .5) scrollTo({top: lockY, behavior: 'instant'});
    lastScrollY = scrollY;
  }
  function beginHold() {
    cancelAnimation(); access(false); paint(0);
    setPhase('hold'); heldAt = performance.now(); keepCentered();
  }
  function release(close = false) {
    setPhase('released');
    if (close) setOpen(false);
  }
  function readyToReveal() {
    return (compact.matches || phase === 'hold' && performance.now() - heldAt >= holdDuration) && !drag && !animation;
  }
  function handleVertical(delta, event, fresh) {
    if (compact.matches) return;
    const now = performance.now();
    if (delta < 0) {
      lastDownTime = -Infinity;
      release(true);
      return;
    }
    lastDownTime = now;
    const target = centerY();
    if (phase === 'idle' && scrollY <= target + 2 && scrollY + delta >= target) {
      event.preventDefault(); beginHold(); return;
    }
    if (!isLocked()) return;
    if (phase === 'open' && fresh && now - openedAt >= openHold) {
      release(); return;
    }
    event.preventDefault(); keepCentered();
    if (readyToReveal() && fresh) { setPhase('opening'); setOpen(true); }
  }
  addEventListener('wheel', event => {
    if (event.defaultPrevented || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const now = performance.now(), fresh = now - lastInputTime > gestureGap;
    lastInputTime = now;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    handleVertical(delta, event, fresh);
  }, {passive: false});
  addEventListener('scroll', () => {
    if (compact.matches) { lastScrollY = scrollY; return; }
    if (isLocked()) { keepCentered(); return; }
    const target = centerY(), current = scrollY;
    if (phase === 'released' && current < target - 80) setPhase('idle');
    if (current < lastScrollY - 1 && expanded) setOpen(false);
    if (phase === 'idle' && performance.now() - lastDownTime < 250 && lastScrollY < target && current >= target) beginHold();
    lastScrollY = scrollY;
  }, {passive: true});
  let touchY = null, touchFresh = false;
  addEventListener('touchstart', event => {
    touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    touchFresh = performance.now() - lastInputTime > gestureGap;
  }, {passive: true});
  addEventListener('touchmove', event => {
    if (touchY === null || event.touches.length !== 1) return;
    const next = event.touches[0].clientY, delta = touchY - next;
    if (Math.abs(delta) < 3) return;
    handleVertical(delta, event, touchFresh);
    touchFresh = false; touchY = next; lastInputTime = performance.now();
  }, {passive: false});
  addEventListener('touchend', () => { touchY = null; lastInputTime = performance.now(); }, {passive: true});
  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape') { release(true); return; }
    const down = ['ArrowDown', 'PageDown', ' '].includes(event.key) && !event.shiftKey;
    const up = ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    if (down || up) {
      handleVertical(down ? (event.key === 'ArrowDown' ? 40 : innerHeight * .8) : -40, event, !event.repeat);
      lastInputTime = performance.now();
    }
  });
  // Explicit navigation and scrollbar dragging must always be able to leave.
  document.addEventListener('click', event => { if (event.target.closest('a[href]')) release(); }, true);
  addEventListener('pointerdown', event => {
    if (event.clientX >= document.documentElement.clientWidth) release();
  }, {passive: true});
  addEventListener('resize', () => { if (isLocked()) { keepCentered(); heldAt = performance.now(); } }, {passive: true});
  addEventListener('pageshow', () => {
    setPhase('idle'); cancelAnimation(); drag = null; access(false); paint(0);
    lastScrollY = scrollY; lastDownTime = -Infinity; lastInputTime = performance.now();
  });
  button.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (expanded || readyToReveal()) setOpen(!expanded);
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); if (event.key === 'ArrowLeft' || readyToReveal()) setOpen(event.key === 'ArrowRight');
    }
  });
  frame.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (expanded || progress > 0)) {
      event.preventDefault(); event.stopPropagation(); release(true); button.focus({preventScroll: true});
    }
  });
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || (!expanded && !readyToReveal())) return;
    cancelAnimation(); measure(); suppressClick = false;
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, from: progress, initialOpen: expanded, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, moved: false};
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy))) return;
    drag.moved = true;
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX; drag.lastTime = event.timeStamp;
    const next = clamp(drag.from + dx / width);
    access(next > .001); paint(next);
  });
  function finishDrag(event, canceled = false) {
    if (!drag || event.pointerId !== drag.id) return;
    const previous = drag; drag = null;
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    if (canceled) { setOpen(previous.initialOpen); return; }
    if (!previous.moved) { paint(progress); return; }
    suppressClick = true;
    const velocity = event.timeStamp - previous.lastTime < 100 ? previous.velocity : 0;
    setOpen(Math.abs(velocity) > .35 ? velocity > 0 : progress >= .5);
  }
  button.addEventListener('pointerup', event => finishDrag(event));
  button.addEventListener('pointercancel', event => finishDrag(event, true));
  button.addEventListener('lostpointercapture', event => finishDrag(event, true));
  frame.classList.add('is-enhanced'); button.hidden = false; access(false); measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(frame);
  else addEventListener('resize', measure, {passive: true});
  compact.addEventListener('change', () => { release(); cancelAnimation(); drag = null; paint(expanded ? 1 : 0); lastScrollY = scrollY; });
  reduced.addEventListener('change', () => { if (reduced.matches) setOpen(expanded); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimation(); drag = null; paint(expanded ? 1 : 0); }
  });
})();
