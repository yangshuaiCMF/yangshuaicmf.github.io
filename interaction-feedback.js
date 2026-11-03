(() => {
  'use strict';
  const selector = '.work-tile, .site-header a, .camon-opening-nav a, .footer-back, .footer-next, .footer-contact a, .camon-home-fab';
  let held = null;
  let timer = 0;
  function clear() {
    clearTimeout(timer);
    document.querySelectorAll('.is-pressed').forEach(node => node.classList.remove('is-pressed'));
    held = null;
  }
  document.addEventListener('pointerdown', event => {
    clear();
    const node = event.target.closest(selector);
    if (!node || event.button !== 0 || !event.isPrimary || node.getAttribute('aria-disabled') === 'true') return;
    held = { node, id: event.pointerId, x: event.clientX, y: event.clientY };
    node.classList.add('is-pressed');
  }, { passive: true });
  document.addEventListener('pointermove', event => {
    if (held && event.pointerId === held.id && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 10) clear();
  }, { passive: true });
  document.addEventListener('pointerup', () => { if (held) timer = setTimeout(clear, 140); }, { passive: true });
  document.addEventListener('pointercancel', clear, { passive: true });
  document.addEventListener('scroll', clear, { passive: true, capture: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches(selector)) {
      clear();
      event.target.classList.add('is-pressed');
      timer = setTimeout(clear, 180);
    }
  });
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  window.addEventListener('pageshow', clear);
})();
