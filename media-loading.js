(() => {
  const section = document.querySelector('[data-scroll-film]');
  const video = section?.querySelector('video');
  if (!video) return;
  let prepared = false;
  const prepare = () => {
    if (prepared) return;
    prepared = true;
    video.preload = 'auto';
    video.load();
  };
  if (!('IntersectionObserver' in window)) { prepare(); return; }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { prepare(); observer.disconnect(); }
  }, { rootMargin: '2000px 0px', threshold: 0 });
  observer.observe(section);
})();
