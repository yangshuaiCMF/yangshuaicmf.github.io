(() => {
  'use strict';
  const sequence = document.querySelector('.opening-sequence');
  if (!sequence) return;
  const stage = sequence.querySelector('.opening-stage');
  const heading = sequence.querySelector('.opening-heading');
  const film = sequence.querySelector('.opening-film');
  const video = sequence.querySelector('video');
  const control = sequence.querySelector('.film-control');
  const status = sequence.querySelector('.film-status');
  // A narrow window still runs the opening; only an explicit motion preference opts out.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = navigator.connection?.saveData;
  let frame = 0, lastTime = 0, progress = 0, target = 0;
  let height = innerHeight, start = 0, end = 0;
  let visible = false, userPaused = false, loaded = false, pendingPlay = false;
  let blocked = false, failed = false;
  const {arrival} = window.LoeweMotion;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  document.documentElement.classList.add('opening-enhanced');
  video.controls = false;
  function loadFilm() {
    if (loaded) return;
    loaded = true;
    video.preload = 'auto';
    video.load();
  }
  function updateControl() {
    const label = failed ? 'Retry film' : pendingPlay ? 'Loading…' : video.paused ? 'Play film' : 'Pause film';
    control.textContent = label;
    control.setAttribute('aria-label', label === 'Loading…' ? 'Cancel loading film' : label);
  }
  function shouldPlay() {
    return visible && !document.hidden && !userPaused && !blocked && !failed && !reduced.matches && !saveData;
  }
  function playFilm(manual = false) {
    if (pendingPlay || (!manual && !shouldPlay())) return;
    loadFilm();
    pendingPlay = true;
    updateControl();
    video.play().then(() => {
      if (!manual && !shouldPlay()) video.pause();
    }).catch(error => {
      if (error.name !== 'AbortError') {
        blocked = true;
        status.textContent = 'Select Play film to start the video.';
      }
    }).finally(() => { pendingPlay = false; updateControl(); });
  }
  function syncPlayback() {
    if (shouldPlay()) {
      if (video.paused) playFilm();
    } else if (!video.paused || pendingPlay) video.pause();
    updateControl();
  }
  video.addEventListener('playing', () => { video.classList.add('is-playing'); updateControl(); });
  video.addEventListener('pause', updateControl);
  function filmError() {
    failed = true;
    pendingPlay = false;
    video.classList.remove('is-playing');
    status.textContent = 'The film could not load. The preview remains visible; select Retry film to try again.';
    updateControl();
  }
  video.addEventListener('error', filmError);
  // With <source>, a failed request fires on the source instead of bubbling to video.
  video.querySelector('source').addEventListener('error', filmError);
  control.addEventListener('click', () => {
    if (!video.paused || pendingPlay) {
      userPaused = true;
      video.pause();
    } else {
      userPaused = false;
      blocked = false;
      if (failed) { loaded = false; failed = false; }
      playFilm(true);
    }
  });

  function draw(p) {
    // A slow approach yields to a faster expansion, then a short full-frame hold.
    const approach = arrival(p / .44);
    const expansion = arrival((p - .44) / .56);
    const scale = p < .44 ? mix(.38, .65, approach) : mix(.65, 1, expansion);
    const y = p < .44 ? mix(1.03, .48, approach) : mix(.48, 0, expansion);
    // The initial crop is square; opening the mask gradually restores the full frame.
    const squareCrop = Math.max(0, (1 - height / stageWidth) / 2) * 100;
    const crop = squareCrop * (1 - smooth(p / .44));
    film.style.transform = `translate3d(0, ${y * height}px, 0) scale(${scale})`;
    // Keep a non-zero clip until the full-frame state, including compositor video layers.
    film.style.clipPath = p < 1 ? `inset(0 ${Math.max(.001, crop)}% 0 ${Math.max(.001, crop)}%)` : 'none';
    heading.style.transform = `translate3d(0, ${-height * .63 * smooth(p / .94)}px, 0)`;
    heading.style.opacity = String(1 - smooth((p - .22) / .55));
    control.hidden = p < .2 || !visible;
  }
  let stageWidth = innerWidth;
  function tick(time) {
    frame = 0;
    const dt = lastTime ? Math.min(64, time - lastTime) : 16.67;
    lastTime = time;
    // Short, frame-rate-independent settling; no wheel interception or perpetual loop.
    progress += (target - progress) * (1 - Math.exp(-dt / 55));
    if (Math.abs(target - progress) < .0001) progress = target;
    draw(progress);
    if (progress !== target) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function scroll() {
    if (reduced.matches) return;
    target = clamp((scrollY - start) / (height * 1.8));
    const inRange = scrollY >= start - height && scrollY < end;
    sequence.classList.toggle('is-active', inRange);
    const nextVisible = target > .14 && scrollY < end - height * .08;
    if (nextVisible !== visible) { visible = nextVisible; syncPlayback(); }
    if (!inRange || target === 0) {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0; progress = target; draw(progress);
    } else if (!frame) frame = requestAnimationFrame(tick);
  }
  function measure() {
    // Keep the original 900-design-pixel choreography even when the stage is taller.
    height = parseFloat(getComputedStyle(film).height) || innerWidth * 900 / 1440;
    stageWidth = stage.clientWidth;
    start = sequence.getBoundingClientRect().top + scrollY;
    end = start + sequence.offsetHeight;
    scroll();
  }
  const staticObserver = new IntersectionObserver(entries => {
    if (!reduced.matches) return;
    visible = entries[0].isIntersecting;
    control.hidden = !visible;
    if (!visible) video.pause();
  }, { threshold: .05 });
  staticObserver.observe(film);
  function motionChanged() {
    cancelAnimationFrame(frame); frame = 0;
    if (reduced.matches) {
      heading.style.transform = ''; heading.style.opacity = '';
      film.style.transform = ''; film.style.clipPath = '';
      control.hidden = false;
      video.pause();
    } else { measure(); }
    syncPlayback();
  }
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('pageshow', measure);
  document.addEventListener('visibilitychange', syncPlayback);
  reduced.addEventListener('change', motionChanged);
  measure(); motionChanged();
  // Prepare while the pure-white title is being read, without blocking first paint.
  if (!reduced.matches && !saveData) {
    if ('requestIdleCallback' in window) requestIdleCallback(loadFilm, { timeout: 1200 });
    else setTimeout(loadFilm, 300);
  }
})();
