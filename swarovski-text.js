(() => {
  'use strict';

  // LOEWE's display/body reveal, with the CAMON layout left in native text.
  // Measure only when entering; temporary decorative glyphs never affect wrapping.
  const selectors = [
    '.opening-heading h1', '.hero-caption p',
    '.project-overview h2', '.project-overview h3', '.project-overview p',
    '[data-title]', '.footer-contact p',
  ];
  const groups = [...document.querySelectorAll(selectors.join(','))]
    .filter(el => !el.closest('.sr-only, [aria-hidden="true"]'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
  let observer;

  function finish(el) {
    const state = active.get(el);
    active.delete(el);
    if (state) {
      state.animations.forEach(animation => animation.cancel());
      state.layer.remove();
    }
    el.classList.remove('swarovski-text-pending', 'swarovski-text-active', 'swarovski-text-positioned');
    el.dataset.textState = 'complete';
  }

  function measure(el) {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const scale = document.body.getBoundingClientRect().width / 1440;
    const style = getComputedStyle(el);
    const lines = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      const parts = segmenter ? [...segmenter.segment(node.data)].map(part => part.segment) : Array.from(node.data);
      let offset = 0;
      for (const text of parts) {
        range.setStart(node, offset);
        offset += text.length;
        range.setEnd(node, offset);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height || /[\r\n]/.test(text)) continue;
        let line = lines.find(item => Math.abs(item.y - rect.top) < scale);
        if (!line) {
          line = { y: rect.top, height: rect.height / scale, chars: [] };
          lines.push(line);
        }
        line.chars.push({ text, x: (rect.left - box.left) / scale });
      }
    }
    lines.sort((a, b) => a.y - b.y);
    const lineHeight = parseFloat(style.lineHeight) || box.height / scale / Math.max(1, lines.length);
    return { box, scale, style, lines, lineHeight };
  }

  function reveal(el) {
    if (el.dataset.textState !== 'pending') return;
    if (reduce.matches) { finish(el); return; }
    el.classList.remove('swarovski-text-pending');
    try {
      const layout = measure(el);
      // Retry only if a title has not acquired measurable layout yet.
      if (!layout || !layout.lines.length) {
        el.classList.add('swarovski-text-pending');
        return;
      }
      const { box, scale, style, lines, lineHeight } = layout;
      const hero = el.dataset.textReveal === 'hero';
      const large = hero || el.dataset.textReveal === 'display';
      const layer = document.createElement('span');
      layer.className = 'swarovski-text-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.color = style.color;
      const chars = [];
      for (const [row, line] of lines.entries()) {
        const mask = document.createElement('span');
        mask.className = 'swarovski-text-line';
        mask.style.top = `${(line.y - box.top) / scale - (lineHeight - line.height) / 2}px`;
        mask.style.height = `${lineHeight}px`;
        for (const [index, item] of line.chars.entries()) {
          const char = document.createElement('span');
          char.className = 'swarovski-text-char';
          char.textContent = item.text;
          char.style.left = `${item.x}px`;
          char.style.lineHeight = `${lineHeight}px`;
          mask.append(char);
          const stagger = hero ? Math.min(65, 420 / Math.max(1, line.chars.length - 1)) : 65;
          chars.push({ char, delay: large ? row * 155 + index * stagger + (hero ? 90 : 0) : row * 100 + index * 11 });
        }
        layer.append(mask);
      }
      if (style.position === 'static') el.classList.add('swarovski-text-positioned');
      el.append(layer);
      el.classList.add('swarovski-text-active');
      el.dataset.textState = 'playing';
      const state = { layer, animations: [] };
      active.set(el, state);
      for (const { char, delay } of chars) {
        state.animations.push(char.animate([
          { transform: `translate3d(${hero ? '.16em' : '0'}, 115%, 0) rotate(${large ? 9 : 0}deg)` },
          { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
        ], { duration: large ? 1000 : 820, delay, easing: 'cubic-bezier(.22,.75,.16,1)', fill: 'backwards' }));
      }
      observer?.unobserve(el);
      Promise.all(state.animations.map(animation => animation.finished.catch(() => {})))
        .then(() => { if (active.get(el) === state) finish(el); });
    } catch {
      // An unavailable animation API must never leave the copy hidden.
      finish(el);
      observer?.unobserve(el);
    }
  }

  for (const el of groups) {
    el.dataset.textReveal = el.matches('h1') ? 'hero' : el.matches('h2,h3,h4,.color-english') ? 'display' : 'body';
    el.dataset.textState = 'pending';
  }
  if (reduce.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) {
    groups.forEach(finish);
    return;
  }
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  groups.forEach(el => { el.classList.add('swarovski-text-pending'); observer.observe(el); });

  // The original text is the final frame. Resize, bfcache and reduced motion
  // can restore it synchronously without retaining stale glyph measurements.
  addEventListener('resize', () => [...active.keys()].forEach(finish), { passive: true });
  addEventListener('pagehide', () => [...active.keys()].forEach(finish));
  reduce.addEventListener('change', () => {
    if (reduce.matches) { observer.disconnect(); groups.forEach(finish); }
  });
})();

// Post-overview groups use a brief, one-shot entrance; default DOM stays readable if enhancement fails.
(() => {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduce.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const running=new Set();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting){
      observer.unobserve(entry.target);
      try {
        const animation=entry.target.animate([
          {opacity:.35,transform:'translate3d(0,12px,0)'},
          {opacity:1,transform:'translate3d(0,0,0)'}
        ],{duration:360,easing:'cubic-bezier(.22,.75,.16,1)'});
        running.add(animation);
        animation.finished.catch(()=>{}).finally(()=>running.delete(animation));
      } catch { /* Visible default is the fallback. */ }
    }
  },{threshold:0,rootMargin:'0px 0px -5% 0px'});
  document.querySelectorAll('[data-enter]').forEach(el=>observer.observe(el));
  const finish=()=>{running.forEach(animation=>animation.cancel());running.clear()};
  reduce.addEventListener('change',()=>{if(reduce.matches){observer.disconnect();finish()}});
  addEventListener('resize',finish,{passive:true});
  addEventListener('pagehide',finish);
})();
