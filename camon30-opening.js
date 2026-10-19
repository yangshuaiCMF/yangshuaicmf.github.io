(() => {
  'use strict';
  const sequence = document.querySelector('.camon-opening');
  if (!sequence) return;
  const stage = sequence.querySelector('.camon-opening-stage');
  const heading = sequence.querySelector('.camon-opening-heading');
  const picture = sequence.querySelector('.camon-opening-image');
  const reduced = matchMedia('(prefers-reduced-motion: reduce), (max-aspect-ratio: 1/1)');
  let frame = 0, lastTime = 0, progress = 0, target = 0;
  let height = innerHeight, start = 0, end = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  document.documentElement.classList.add('camon-opening-enhanced');
  function draw(p) {
    // Same two-phase timing as Loewe. The square transparent source needs no crop.
    const approach = smooth(p / .44);
    const expansion = smooth((p - .44) / .56);
    const scale = p < .44 ? mix(.38, .65, approach) : mix(.65, 1, expansion);
    const y = p < .44 ? mix(1.03, .48, approach) : mix(.48, 0, expansion);
    picture.style.transform = `translate3d(0, ${y * height}px, 0) scale(${scale})`;
    heading.style.transform = `translate3d(0, ${-height * .63 * smooth(p / .94)}px, 0)`;
    heading.style.opacity = String(1 - smooth((p - .22) / .55));
  }
  function tick(time) {
    frame = 0;
    const dt = lastTime ? Math.min(64, time - lastTime) : 16.67;
    lastTime = time;
    progress += (target - progress) * (1 - Math.exp(-dt / 55));
    if (Math.abs(target - progress) < .0001) progress = target;
    draw(progress);
    if (progress !== target) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function scroll() {
    document.body.classList.toggle('camon-at-opening', scrollY < end - innerHeight * .5);
    if (reduced.matches) return;
    target = clamp((scrollY - start) / (height * 1.8));
    const inRange = scrollY >= start - height && scrollY < end;
    sequence.classList.toggle('is-active', inRange);
    if (!inRange || target === 0) {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0; progress = target; draw(progress);
    } else if (!frame) frame = requestAnimationFrame(tick);
  }
  function measure() {
    height = stage.clientHeight || innerWidth * 900 / 1440;
    start = sequence.getBoundingClientRect().top + scrollY;
    end = start + sequence.offsetHeight;
    scroll();
  }
  function motionChanged() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (reduced.matches) {
      heading.style.transform = ''; heading.style.opacity = '';
      picture.style.transform = '';
      sequence.classList.remove('is-active');
    }
    measure();
  }
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('pageshow', measure);
  reduced.addEventListener('change', motionChanged);
  motionChanged();
})();
