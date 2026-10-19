/* Adapted from the SlingButton source supplied by the user (React Bits).
   Vertical pull, native pointer capture/WAAPI; onSend becomes return-to-top. */
(() => {
  'use strict';
  const root = document.querySelector('.sling-top');
  if (!root) return;
  const pad = root.querySelector('.footer-top'), band = root.querySelector('.sling-band'), arc = root.querySelector('.sling-power');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // Counter the CAMON40 artboard zoom for the entire control, including FX.
  function syncControlScale() {
    const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
    document.documentElement.style.setProperty('--project-ui-inverse', String(1 / zoom));
  }
  syncControlScale();
  // The old floating Home must not cover the new Back link at the page end.
  if (document.querySelector('.camon-home-fab') && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      document.documentElement.classList.toggle('project-footer-visible', entries[0].isIntersecting);
    }).observe(root.closest('.project-footer'));
  }
  const ARM = 32, LIMIT = 90;
  let grip = null, y = 0, spring = 0, navigation = 0, timer = 0, skipClick = false, sending = false;
  const dots = Array.from({length: 7}, () => { const dot = document.createElement('span'); dot.className = 'sling-dot'; dot.setAttribute('aria-hidden', 'true'); root.append(dot); return dot; });
  function paint(value) {
    y = value; pad.style.transform = `translate3d(0,${y}px,0)`;
    const power = Math.min(1, Math.max(0, y / ARM));
    band.setAttribute('d', Math.abs(y) > .5 ? `M-28,12 Q-30,${y / 2} -24,${y} M28,12 Q30,${y / 2} 24,${y}` : '');
    arc.setAttribute('stroke-dasharray', `${power} ${1-power}`); arc.style.opacity = power ? '1' : '0';
    root.toggleAttribute('data-armed', !!grip && y >= ARM);
  }
  function settle(fired = false) {
    cancelAnimationFrame(spring);
    if (reduce.matches) { paint(0); return; }
    let velocity = fired ? -1900 : 0, previous = performance.now(), started = previous;
    function step(now) {
      const dt = Math.min(32, now - previous) / 1000; previous = now;
      for (let i = 0; i < 4; i++) { velocity += (-480 * y - 28 * velocity) * dt / 4; y += velocity * dt / 4; }
      paint(y);
      if ((Math.abs(y) < .1 && Math.abs(velocity) < 1) || now - started > 1000) { paint(0); spring = 0; }
      else spring = requestAnimationFrame(step);
    }
    spring = requestAnimationFrame(step);
  }
  function burst() {
    dots.forEach((dot, i) => {
      const angle = (i - 3) * .13, reach = 45 + Math.random() * 55;
      dot.animate([{opacity: 1, transform: 'translate(0,-18px) scale(1)'}, {opacity: 0, transform: `translate(${Math.sin(angle)*reach}px,${-reach}px) scale(.2)`}], {duration: 320 + i * 18, easing: 'cubic-bezier(.23,1,.32,1)'});
    });
  }
  function stopNavigation() { clearTimeout(timer); cancelAnimationFrame(navigation); navigation = 0; sending = false; }
  function finishNavigation() {
    scrollTo({top: 0, behavior: 'instant'}); history.replaceState(null, '', '#top');
    document.querySelector('.site-header a, .camon-opening-nav a')?.focus({preventScroll: true}); sending = false; navigation = 0;
  }
  function send() {
    if (sending) return;
    sending = true;
    if (reduce.matches) { finishNavigation(); return; }
    burst();
    timer = setTimeout(() => {
      const from = scrollY, start = performance.now(), duration = 850;
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        scrollTo({top: from * Math.pow(1-t, 4), behavior: 'instant'});
        if (t < 1) navigation = requestAnimationFrame(tick); else finishNavigation();
      }
      navigation = requestAnimationFrame(tick);
    }, 130);
  }
  pad.addEventListener('dragstart', event => event.preventDefault());
  pad.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || grip) return;
    stopNavigation(); cancelAnimationFrame(spring); skipClick = false;
    grip = {id: event.pointerId, start: event.clientY, initial: Math.max(0,y), moved: false};
    pad.setPointerCapture(event.pointerId); root.setAttribute('data-held', '');
  });
  pad.addEventListener('pointermove', event => {
    if (!grip || event.pointerId !== grip.id) return;
    const screenDelta = event.clientY - grip.start;
    if (Math.abs(screenDelta) > 5) grip.moved = true;
    const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
    const raw = Math.max(0, screenDelta / scale + grip.initial);
    paint(LIMIT * raw / (LIMIT + raw));
  });
  function release(id, canceled = false) {
    if (!grip || grip.id !== id) return;
    const previous = grip, fire = !canceled && (grip.moved ? y >= ARM : true);
    grip = null; root.removeAttribute('data-held'); root.removeAttribute('data-armed');
    if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
    if (fire) pad.click(); // Release existing drawer / INS locks through link capture.
    skipClick = true;
    settle(fire && previous.moved);
  }
  pad.addEventListener('pointerup', e => release(e.pointerId));
  pad.addEventListener('pointercancel', e => release(e.pointerId, true));
  pad.addEventListener('lostpointercapture', e => release(e.pointerId, true));
  pad.addEventListener('click', event => {
    event.preventDefault();
    if (skipClick && event.detail !== 0) { skipClick = false; return; }
    skipClick = false; send();
  });
  pad.addEventListener('keydown', event => {
    if (event.key === 'Escape' && grip) { event.preventDefault(); release(grip.id, true); }
    if (event.key === ' ') { event.preventDefault(); if (!event.repeat) pad.click(); }
  });
  addEventListener('wheel', stopNavigation, {passive: true});
  addEventListener('touchstart', stopNavigation, {passive: true});
  addEventListener('keydown', event => { if (event.key === 'Escape' || ['PageDown','PageUp','ArrowDown','ArrowUp'].includes(event.key)) stopNavigation(); });
  function reset() { if (grip) release(grip.id, true); stopNavigation(); cancelAnimationFrame(spring); paint(0); dots.forEach(dot => dot.getAnimations().forEach(a => a.cancel())); }
  addEventListener('resize', () => { reset(); syncControlScale(); });
  addEventListener('blur', reset); addEventListener('pageshow', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  reduce.addEventListener('change', reset);
})();
