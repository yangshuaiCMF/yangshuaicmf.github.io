(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const groups = [...document.querySelectorAll('[data-reveal]')];
  const allLines = [...document.querySelectorAll('[data-reveal] .line')];
  const activeAnimations = new Set();
  let observer;
  let replaying = false;

  // Keep editable plain text in HTML; split only the presentation into characters.
  for (const group of groups) {
    const accessibleText = document.createElement('span');
    accessibleText.className = 'sr-only';
    accessibleText.textContent = [...group.querySelectorAll('.line')].map(line => line.textContent.trim()).join(' ');
    for (const line of group.querySelectorAll('.line')) {
      line.setAttribute('aria-hidden', 'true');
      const content = document.createElement('span');
      content.className = 'line-content';
      content.setAttribute('aria-hidden', 'true');
      for (const letter of line.textContent) {
        const char = document.createElement('span');
        char.className = 'char';
        char.textContent = letter === ' ' ? '\u00a0' : letter;
        content.append(char);
      }
      line.replaceChildren(content);
    }
    group.append(accessibleText);
  }

  // Real hero copy fits by font size; placeholders retain their reference line lengths.
  function fitLines() {
    for (const line of allLines) {
      const content = line.firstElementChild;
      if (line.dataset.fit === 'font-size') {
        const heading = line.closest('.hero-title');
        heading.style.removeProperty('font-size');
        content.style.setProperty('--fit', '1');
        const baseSize = parseFloat(getComputedStyle(heading).fontSize);
        const width = content.offsetWidth;
        if (width > 0) {
          heading.style.fontSize = `${baseSize * Math.max(1, line.clientWidth - 2) / width}px`;
          // Keep the two-line design chapter at the reference title's actual size.
          document.documentElement.style.setProperty('--project-title-size', heading.style.fontSize);
        }
        continue;
      }
      const measuredWidth = content.offsetWidth;
      const ratio = measuredWidth > 0 ? line.clientWidth / measuredWidth : 1;
      content.style.setProperty('--fit', line.style.getPropertyValue('--line-width') ? ratio : Math.min(1, ratio));
    }
  }
  document.documentElement.classList.add('motion-ready');
  fitLines();
  let resizeFrame;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitLines);
  }, { passive: true });
  document.fonts.ready.then(fitLines);

  function animate(element, keyframes, options) {
    const animation = element.animate(keyframes, options);
    activeAnimations.add(animation);
    animation.finished.then(() => activeAnimations.delete(animation), () => activeAnimations.delete(animation));
    return animation;
  }

  function reveal(group, restart = false) {
    if (group.dataset.played && !restart) return;
    group.dataset.played = 'true';
    group.classList.remove('is-revealed');
    const large = /hero|display/.test(group.dataset.reveal);
    const hero = group.dataset.reveal === 'hero';
    const lines = [...group.querySelectorAll('.line')];
    const promises = [];
    for (const [row, line] of lines.entries()) {
      const characters = [...line.querySelectorAll('.char')];
      for (const [index, char] of characters.entries()) {
        char.style.transform = 'none';
        if (reduceMotion.matches) continue;
        const characterDelay = hero ? Math.min(65, 420 / Math.max(1, characters.length - 1)) : 65;
        const delay = large ? row * 155 + index * characterDelay + (hero ? 90 : 0) : row * 100 + index * 11;
        const animation = animate(char, [
          { transform: `translate3d(${hero ? '.16em' : '0'}, 115%, 0) rotate(${large ? 9 : 0}deg)` },
          { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
        ], { duration: large ? 1000 : 820, delay, easing: 'cubic-bezier(.22,.75,.16,1)', fill: 'backwards' });
        promises.push(animation.finished.catch(() => {}));
      }
    }
    Promise.all(promises).then(() => group.classList.add('is-revealed'));
  }

  function setupReveals() {
    observer?.disconnect();
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      groups.forEach(group => reveal(group, true));
      return;
    }
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    groups.forEach(group => {
      if (!group.dataset.played) observer.observe(group);
    });
  }
  setupReveals();


  // The recording ends with a white transition and a new hero entrance.
  // Replay is explicitly user-triggered; the page never auto-scrolls.
  for (const link of document.querySelectorAll('[data-replay]')) {
    link.addEventListener('click', async event => {
      event.preventDefault();
      if (replaying) return;
      replaying = true;
      const curtain = document.querySelector('.page-transition');
      if (!reduceMotion.matches) {
        curtain.style.opacity = '1';
        await animate(curtain, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }).finished.catch(() => {});
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      history.replaceState(null, '', location.pathname + location.search + '#top');
      document.querySelector('.site-header a').focus({ preventScroll: true });
      curtain.style.opacity = '0';
      if (!reduceMotion.matches) animate(curtain, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
      const originalHero = document.querySelector('[data-reveal="hero"]');
      if (document.querySelector('.opening-sequence') && !reduceMotion.matches) {
        delete originalHero.dataset.played;
        originalHero.classList.remove('is-revealed');
        observer?.observe(originalHero);
      } else {
        reveal(originalHero, true);
      }
      replaying = false;
    });
  }

  reduceMotion.addEventListener('change', () => {
    activeAnimations.forEach(animation => animation.cancel());
    if (reduceMotion.matches) groups.forEach(group => reveal(group, true));
    setupReveals();
  });
})();
