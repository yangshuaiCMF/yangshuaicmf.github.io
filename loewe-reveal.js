(() => {
  'use strict';
  const sequence = document.querySelector('.reveal-sequence');
  if (!sequence) return;
  const stage = sequence.querySelector('.reveal-stage');
  const panel = sequence.querySelector('.reveal-kv');
  const image = panel.querySelector('img');
  const {arrival, follow} = window.LoeweMotion;
  let renderedLift = null, lastPaint = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce), (max-aspect-ratio: 1/1)');
  const lead = .10, rise = 1.05, hold = .32;
  let ready = false, frame = 0, measureFrame = 0, start = 0, height = 1;
  let distance = -1, resizePosition = null;
  sequence.style.setProperty('--reveal-length', String(1 + lead + rise + hold));
  // Reserve the final geometry before native scroll restoration, not after decode.
  sequence.classList.toggle('is-preparing', !reduced.matches);

  function paint(time = performance.now(), immediate = false) {
    frame = 0;
    if (!sequence.classList.contains('is-enhanced')) return;
    distance = (scrollY - start) / height;
    const progress = Math.max(0, Math.min(1, (distance - lead) / rise));
    // Brisk lift, slower arrival. Progress stays attached to the scroll position.
    const lift = arrival(progress);
    const elapsed = lastPaint ? time - lastPaint : 16.67;
    renderedLift = immediate || distance <= lead || distance > lead + rise + hold ? lift : follow(renderedLift, lift, elapsed, .00015);
    lastPaint = time;
    panel.style.transform = `translate3d(0, ${(1 - renderedLift) * height}px, 0)`;
    if (renderedLift !== lift && !document.hidden) frame = requestAnimationFrame(paint);
    else lastPaint = 0;
    sequence.classList.toggle('is-active', distance > -.5 && distance < lead + rise + hold + 1);
    sequence.dataset.phase = distance < lead ? 'title' : progress < 1 ? 'rising' : distance <= lead + rise + hold ? 'hold' : 'released';
  }
  function measure() {
    measureFrame = 0;
    if (!sequence.classList.contains('is-enhanced')) return;
    // Keep the existing scroll rhythm independent of the smaller image frame.
    height = (sequence.offsetHeight - stage.offsetHeight) / (lead + rise + hold) || innerWidth * 900 / 1440;
    start = sequence.getBoundingClientRect().top + scrollY;
    if (resizePosition !== null) {
      scrollTo({top: start + resizePosition * height, behavior: 'instant'});
      resizePosition = null;
    }
    cancelAnimationFrame(frame); frame = 0;
    paint(performance.now(), true);
  }
  function queueMeasure() {
    if (!measureFrame) measureFrame = requestAnimationFrame(measure);
  }
  function syncMode() {
    const enhance = ready && !reduced.matches;
    sequence.classList.toggle('is-preparing', !ready && !reduced.matches && !sequence.classList.contains('is-unavailable'));
    sequence.classList.toggle('is-enhanced', enhance);
    if (enhance) measure();
    else {
      cancelAnimationFrame(frame); frame = 0; renderedLift = null; lastPaint = 0; resizePosition = null; distance = -1;
      panel.style.removeProperty('transform');
      sequence.classList.remove('is-active');
      delete sequence.dataset.phase;
    }
  }
  function imageReady() {
    if (ready || !image.naturalWidth) return;
    ready = true;
    sequence.classList.remove('is-unavailable');
    syncMode();
  }
  image.addEventListener('load', prepareImage);
  image.addEventListener('error', () => {
    ready = false;
    sequence.classList.add('is-unavailable');
    syncMode();
  });
  // Animate only after decoding; failure/reduced motion/no-JS use normal flow.
  let decoding;
  function prepareImage() {
    if (ready) return Promise.resolve();
    if (!decoding) decoding = image.decode().then(imageReady).catch(() => {
      if (image.complete && !image.naturalWidth) { sequence.classList.add('is-unavailable'); syncMode(); }
    }).finally(() => { decoding = null; });
    return decoding;
  }
  const prepared = prepareImage();

  // First-entry anchors may move when the upstream gallery finishes decoding.
  // Correct once, before any user input; reload/history keep native restoration.
  if (location.hash === '#chapter-two' && performance.getEntriesByType('navigation')[0]?.type === 'navigate') {
    const guard = new AbortController();
    const cancel = () => guard.abort();
    const cancelOnInput = event => { if (event.isTrusted) cancel(); };
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      addEventListener(type, cancelOnInput, {passive: true, signal: guard.signal});
    }
    addEventListener('hashchange', cancel, {signal: guard.signal});
    addEventListener('pagehide', cancel, {signal: guard.signal});
    addEventListener('pageshow', event => { if (event.persisted) cancel(); }, {signal: guard.signal});
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => addEventListener('load', resolve, {once: true}));
    const upstream = [...document.querySelectorAll('.concept-gallery img')];
    const gallery = document.querySelector('.concept-gallery');
    const gallerySettled = new Promise(resolve => {
      const settled = () => !gallery || ['ready', 'failed'].includes(gallery.dataset.state);
      if (settled()) { resolve(); return; }
      const observer = new MutationObserver(() => {
        if (settled()) {
          observer.disconnect(); resolve();
        }
      });
      observer.observe(gallery, {attributes: true, attributeFilter: ['data-state']});
      guard.signal.addEventListener('abort', () => { observer.disconnect(); resolve(); }, {once: true});
    });
    Promise.allSettled([loaded, document.fonts.ready, prepared, gallerySettled, ...upstream.map(img => img.decode())]).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!guard.signal.aborted && location.hash === '#chapter-two') {
          const chapter = sequence.closest('.chapter');
          const margin = parseFloat(getComputedStyle(chapter).scrollMarginTop) || 0;
          scrollTo({top: chapter.getBoundingClientRect().top + scrollY - margin, behavior: 'instant'});
          measure();
        }
        cancel();
      }));
    });
  }
  addEventListener('scroll', () => {
    if (!frame && sequence.classList.contains('is-enhanced')) frame = requestAnimationFrame(paint);
  }, {passive: true});
  addEventListener('resize', () => {
    if (sequence.classList.contains('is-enhanced') && distance >= 0 && distance <= lead + rise + hold) resizePosition = distance;
    queueMeasure();
  }, {passive: true});
  addEventListener('pageshow', queueMeasure);
  addEventListener('load', queueMeasure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastPaint = 0; }
    else queueMeasure();
  });
  reduced.addEventListener('change', syncMode);
  document.fonts.ready.then(queueMeasure);
  if ('ResizeObserver' in window) {
    // The upstream gallery changes its runway after its images are decoded.
    new ResizeObserver(queueMeasure).observe(document.querySelector('main'));
  }
})();
