(() => {
  'use strict';
  const gallery = document.querySelector('.concept-gallery');
  if (!gallery) return;
  const stage = gallery.querySelector('.concept-stage');
  const heading = gallery.querySelector('.concept-heading');
  const overview = gallery.querySelector('.concept-overview');
  const track = gallery.querySelector('.concept-track');
  const slides = [...gallery.querySelectorAll('.concept-slide')];
  const images = [...gallery.querySelectorAll('img')];
  const status = gallery.querySelector('.concept-status');
  const {arrival, follow} = window.LoeweMotion;
  const reduced = matchMedia('(prefers-reduced-motion: reduce), (max-aspect-ratio: 1/1)');
  const entry = .72, firstKV = entry + .36, step = 1.06;
  const travel = firstKV + slides.length * step;
  // 230ms brisk travel + 730ms continuous braking/settling; no overshoot.
  const duration = 960, gestureGap = 180, minimumHold = 120;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const anchor = index => firstKV + index * step;
  const bandAt = value => Math.max(0, Math.min(slides.length, (value - firstKV) / step));
  let height = 1, start = 0, position = -1, center = 0, headingHeight = 0, titleStart = 0;
  let rendered = null, lastPaint = 0, frame = 0, measureFrame = 0;
  let ready = false, failed = false, loading = false, resizePosition = null;
  let motion = null, motionFrame = 0, settleTimer = 0, hashFrame = 0;
  let pendingInput = false, direction = 1, touching = false, fingerY = 0, bypass = false;
  let lastWheel = -Infinity, wheelDirection = 0, completedAt = -Infinity;
  let returnIntent = false, lastScrollY = scrollY, returnFingerY = 0;
  let requestedHash = performance.getEntriesByType('navigation')[0]?.type === 'navigate' ? location.hash : '';
  gallery.style.setProperty('--concept-length', String(1 + travel));

  const scrollKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
  function cancelRequestedHash(event) {
    if (!event.isTrusted || (event.type === 'keydown' && !scrollKeys.includes(event.key))) return;
    if (event.type === 'wheel' && !event.ctrlKey && !event.metaKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX) && event.deltaY) returnIntent = event.deltaY < 0;
    if (event.type === 'keydown') returnIntent = ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    if (event.type === 'pointerdown') returnIntent = event.clientX >= document.documentElement.clientWidth;
    if (event.type === 'touchstart') { returnIntent = false; returnFingerY = event.touches[0]?.clientY ?? 0; }
    if (/^#concept-[1-4]$/.test(requestedHash) && location.hash === requestedHash && !ready) {
      // Native fragment navigation can already be queued before the first paint.
      // Cancel its smooth scroll at that paint as well, without changing the URL.
      const hash = requestedHash;
      const stopFragment = () => {
        if (location.hash === hash) scrollTo({top: scrollY, behavior: 'instant'});
      };
      stopFragment();
      requestAnimationFrame(() => { stopFragment(); requestAnimationFrame(stopFragment); });
    }
    requestedHash = '';
  }
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(type, cancelRequestedHash, {passive: true, capture: true});
  }
  function enhanced() { return gallery.classList.contains('is-enhanced'); }
  function localPosition() { return (scrollY - start) / height; }
  function inStory() { const p = localPosition(); return p >= entry - .002 && p <= travel + .002; }
  function paint(time = performance.now(), immediate = false) {
    frame = 0;
    if (!enhanced()) return;
    position = localPosition();
    const elapsed = lastPaint ? time - lastPaint : 16.67;
    rendered = motion ? motion.current : immediate || position <= 0 || position > travel ? position : follow(rendered, position, elapsed);
    lastPaint = time;
    const progress = arrival(rendered / entry);
    const titleEnd = center - headingHeight;
    heading.style.transform = `translate3d(0, ${titleStart + (titleEnd - titleStart) * progress}px, 0)`;
    heading.style.opacity = String(1 - smooth(rendered / (entry * .9)));
    overview.style.transform = `translate3d(0, ${titleStart + headingHeight + (center - titleStart - headingHeight) * progress}px, 0)`;
    const band = bandAt(rendered);
    track.style.transform = `translate3d(0, ${(1 - band) * 100}%, 0)`;
    overview.style.visibility = band >= 1 ? 'hidden' : 'visible';
    const current = Math.min(slides.length, Math.ceil(band - .001));
    let phase = rendered < entry ? 'overview-enter' : 'overview-hold';
    if (band > .001) phase = `kv-${current}-${Math.abs(band - Math.round(band)) < .001 && !motion ? 'hold' : 'enter'}`;
    if (position > travel + .002) phase = 'released';
    gallery.dataset.current = String(current);
    gallery.dataset.phase = phase;
    gallery.dataset.position = position.toFixed(5);
    gallery.dataset.renderPosition = rendered.toFixed(5);
    gallery.dataset.band = band.toFixed(6);
    gallery.classList.toggle('is-moving', !!motion || (position >= 0 && position <= travel && rendered !== position));
    if (position < 0 || position > travel + .02) bypass = false;
    if (!motion && rendered !== position) queuePaint();
    else lastPaint = 0;
  }
  function queuePaint() { if (!frame && enhanced() && !document.hidden) frame = requestAnimationFrame(paint); }
  function cancelMotion() {
    cancelAnimationFrame(motionFrame); motionFrame = 0; motion = null;
    clearTimeout(settleTimer); settleTimer = 0;
  }
  // Upward reading exits the pinned runway in one jump; never rewind the KV strip.
  function skipReturn() {
    if (!ready || !enhanced() || bypass) return false;
    const p = localPosition();
    if (p < entry || p > travel + .002) return false;
    cancelMotion(); pendingInput = false; returnIntent = false;
    lastWheel = completedAt = -Infinity; wheelDirection = 0;
    status.textContent = '';
    scrollTo({top: Math.max(0, start - 1), behavior: 'instant'});
    lastScrollY = scrollY;
    cancelAnimationFrame(frame); frame = 0;
    paint(performance.now(), true);
    return true;
  }
  function measure() {
    measureFrame = 0;
    if (!enhanced()) return;
    const bounds = gallery.getBoundingClientRect();
    // The picture may exceed a short viewport; keep scroll timing in viewport units.
    height = (bounds.height - stage.getBoundingClientRect().height) / travel || innerWidth * 900 / 1440;
    start = bounds.top + scrollY;
    headingHeight = heading.offsetHeight;
    center = (height - overview.offsetHeight) / 2;
    titleStart = Math.max(0, center + height * .12 - headingHeight);
    if (resizePosition !== null) {
      scrollTo({top: start + resizePosition * height, behavior: 'instant'});
      resizePosition = null;
    }
    cancelAnimationFrame(frame); frame = 0;
    paint(performance.now(), true);
  }
  function queueMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }
  function syncMode() {
    cancelMotion(); pendingInput = false; bypass = false;
    gallery.classList.toggle('is-enhanced', !failed && !reduced.matches);
    if (enhanced()) measure();
    else {
      cancelAnimationFrame(frame); frame = 0; rendered = null; lastPaint = 0; resizePosition = null;
      heading.style.transform = ''; heading.style.opacity = '';
      overview.style.transform = ''; overview.style.visibility = ''; track.style.transform = '';
      gallery.classList.remove('is-moving');
      for (const name of ['phase', 'current', 'band', 'renderPosition']) delete gallery.dataset[name];
    }
  }
  function animate(time) {
    motionFrame = 0;
    if (!motion) return;
    const p = clamp((time - motion.time) / motion.duration);
    motion.current = motion.from + (motion.to - motion.from) * arrival(p);
    scrollTo({top: start + motion.current * height, behavior: 'instant'});
    motion.expectedY = scrollY;
    paint(time);
    if (p < 1) motionFrame = requestAnimationFrame(animate);
    else {
      const target = motion.to, kind = motion.kind;
      motion = null; rendered = target; completedAt = time;
      paint(time, true);
      if (kind === 'step') {
        const index = Math.round(bandAt(target));
        status.textContent = index ? `方案 ${index} / ${slides.length}：${slides[index - 1].querySelector('figcaption').textContent}` : '';
      }
    }
  }
  function moveTo(to, kind = 'step') {
    const from = kind === 'step' ? Math.max(firstKV, rendered ?? localPosition()) : localPosition();
    cancelMotion(); pendingInput = false;
    if (Math.abs(to - from) < .001) return;
    motion = {from, to, current: from, time: performance.now(), duration: kind === 'step' ? duration : 720, kind, expectedY: scrollY};
    // The overview is already stationary here; align the runway before the first lift.
    scrollTo({top: start + from * height, behavior: 'instant'});
    motion.expectedY = scrollY;
    motionFrame = requestAnimationFrame(animate);
  }
  function stepTo(sign) {
    const band = bandAt(rendered ?? localPosition());
    const nearest = Math.round(band);
    const index = Math.abs(band - nearest) < .01 ? nearest + sign : sign > 0 ? Math.ceil(band) : Math.floor(band);
    if (index < 0 || index > slides.length) return false;
    moveTo(anchor(index));
    return true;
  }
  function settle() {
    settleTimer = 0;
    if (!pendingInput || !ready || !enhanced() || touching || bypass) return;
    pendingInput = false;
    const p = localPosition();
    if (p <= 0 || p >= travel) return;
    if (p < entry) moveTo(direction > 0 ? entry + .04 : 0, 'entry');
    else if (p > firstKV) stepTo(direction);
  }
  function scheduleSettle() {
    clearTimeout(settleTimer);
    if (pendingInput && !touching) settleTimer = setTimeout(settle, 85);
  }
  function nativeIntent(delta) {
    if (!delta || reduced.matches) return;
    if (delta < 0 && skipReturn()) return;
    cancelMotion(); direction = Math.sign(delta); pendingInput = true;
  }
  gallery.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    if (event.deltaY < 0 && event.cancelable && skipReturn()) { event.preventDefault(); return; }
    if (!ready || !enhanced() || bypass || !inStory() || !event.cancelable) { nativeIntent(event.deltaY); return; }
    const now = performance.now(), sign = Math.sign(event.deltaY);
    if (!motion && sign < 0 && bandAt(rendered ?? localPosition()) < .01) { nativeIntent(event.deltaY); return; }
    const reverse = sign !== wheelDirection;
    const fresh = now - lastWheel > gestureGap || reverse;
    lastWheel = now; wheelDirection = sign;
    if (motion || !fresh || now - completedAt < minimumHold) {
      event.preventDefault();
      if (motion && reverse) stepTo(sign);
      return;
    }
    if (stepTo(sign)) event.preventDefault();
    // At either end a fresh gesture scrolls the document normally.
  }, {passive: false});
  gallery.addEventListener('touchstart', event => {
    cancelMotion(); pendingInput = false;
    touching = event.touches.length === 1;
    if (touching) fingerY = event.touches[0].clientY;
  }, {passive: true});
  gallery.addEventListener('touchmove', event => {
    if (!touching || event.touches.length !== 1) return;
    const y = event.touches[0].clientY; nativeIntent(fingerY - y); fingerY = y;
  }, {passive: true});
  for (const type of ['touchend', 'touchcancel']) gallery.addEventListener(type, () => { touching = false; scheduleSettle(); }, {passive: true});
  addEventListener('touchmove', event => {
    if (event.touches.length !== 1) { returnIntent = false; return; }
    const y = event.touches[0].clientY;
    returnIntent = y > returnFingerY; returnFingerY = y;
  }, {passive: true, capture: true});
  addEventListener('click', event => { if (event.target.closest('a[href]')) returnIntent = false; }, {capture: true});
  addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancelMotion(); pendingInput = false; bypass = true; queuePaint(); return; }
    if (['Home', 'End', 'Tab'].includes(event.key)) { cancelMotion(); pendingInput = false; return; }
    if (!ready || !enhanced() || bypass || !inStory() || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    const down = ['ArrowDown', 'PageDown'].includes(event.key) || (event.code === 'Space' && !event.shiftKey);
    const up = ['ArrowUp', 'PageUp'].includes(event.key) || (event.code === 'Space' && event.shiftKey);
    if (!down && !up) return;
    if (up && skipReturn()) { event.preventDefault(); return; }
    if (up && !motion && bandAt(rendered ?? localPosition()) < .01) return;
    if (event.repeat) { event.preventDefault(); return; }
    if (stepTo(down ? 1 : -1)) event.preventDefault();
  });
  addEventListener('pointerdown', () => { cancelMotion(); pendingInput = false; }, {passive: true});
  addEventListener('scroll', () => {
    // Links, the scrollbar, or other navigation can always take over an animation.
    if (motion && Math.abs(scrollY - motion.expectedY) > 3) cancelMotion();
    const returning = returnIntent && scrollY < lastScrollY;
    lastScrollY = scrollY;
    if (!motion && returning && skipReturn()) return;
    queuePaint(); if (!motion) scheduleSettle();
  }, {passive: true});

  function restoreHash() {
    const match = /^#concept-([1-4])$/.exec(requestedHash);
    if (!match || !ready || !enhanced() || document.readyState !== 'complete') return;
    cancelAnimationFrame(hashFrame);
    hashFrame = requestAnimationFrame(() => {
      hashFrame = requestAnimationFrame(() => {
        hashFrame = 0;
        if (requestedHash !== match[0] || !enhanced()) return;
        requestedHash = ''; cancelMotion(); pendingInput = false; measure();
        scrollTo({top: start + anchor(Number(match[1])) * height, behavior: 'instant'});
        cancelAnimationFrame(frame); frame = 0;
        paint(performance.now(), true);
      });
    });
  }
  function prepare() {
    if (loading || ready) return;
    loading = true; gallery.dataset.state = 'loading'; gallery.setAttribute('aria-busy', 'true');
    Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })).then(() => {
      ready = true; failed = false; status.textContent = ''; gallery.dataset.state = 'ready';
      syncMode(); restoreHash();
    }).catch(() => {
      failed = true; gallery.dataset.state = 'failed'; status.textContent = '部分图片未能加载，已恢复顺序浏览。'; syncMode();
    }).finally(() => { loading = false; gallery.removeAttribute('aria-busy'); });
  }
  addEventListener('resize', () => {
    cancelMotion(); pendingInput = false; returnIntent = false;
    if (enhanced() && position >= 0 && position <= travel) resizePosition = rendered;
    queueMeasure();
  }, {passive: true});
  addEventListener('load', () => { measure(); restoreHash(); });
  addEventListener('pageshow', () => { measure(); restoreHash(); });
  addEventListener('hashchange', () => { cancelMotion(); pendingInput = false; bypass = false; returnIntent = false; requestedHash = location.hash; prepare(); restoreHash(); });
  addEventListener('online', prepare);
  reduced.addEventListener('change', syncMode);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelMotion(); pendingInput = false; cancelAnimationFrame(frame); frame = 0; }
    else queueMeasure();
  });
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.querySelector('main'));
  document.fonts.ready.then(queueMeasure);
  syncMode();
  if ('IntersectionObserver' in window) {
    const loader = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { prepare(); loader.disconnect(); }
    }, {rootMargin: '150% 0px'});
    loader.observe(gallery);
  } else prepare();
  if (/^#(concept-[1-4]|chapter-one|chapter-two)$/.test(location.hash)) prepare();
})();
