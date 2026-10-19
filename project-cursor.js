(() => {
  'use strict';
  const root = document.documentElement;
  const filter = 'grayscale(1) invert(1) contrast(100)';
  if (!root.dataset.project || !window.CSS ||
      !(CSS.supports('backdrop-filter', filter) || CSS.supports('-webkit-backdrop-filter', filter))) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const forced = matchMedia('(forced-colors: active)');
  const dot = document.createElement('div');
  dot.className = 'project-cursor';
  dot.setAttribute('aria-hidden', 'true');
  root.append(dot);
  let frame = 0, x = 0, y = 0;
  function hide() {
    cancelAnimationFrame(frame);
    frame = 0;
    root.classList.remove('project-cursor-active');
  }
  document.addEventListener('pointermove', event => {
    if (!fine.matches || forced.matches || event.pointerType === 'touch') { hide(); return; }
    x = event.clientX; y = event.clientY;
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      dot.style.transform = `translate3d(${x - 4}px, ${y - 4}px, 0)`;
      root.classList.add('project-cursor-active');
    });
  }, {passive: true});
  document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') hide(); }, {passive: true});
  document.addEventListener('pointerleave', hide);
  document.addEventListener('pointercancel', hide);
  document.addEventListener('keydown', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', hide);
  fine.addEventListener('change', hide);
  forced.addEventListener('change', hide);
})();
