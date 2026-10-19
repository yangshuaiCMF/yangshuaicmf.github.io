// Detail-page geometry stays width-based; homepage behavior retains viewport units.
const projectMotionHeight = () => document.documentElement.dataset.project === "camon30" ? innerWidth * 900 / 1440 : innerHeight;
﻿const heroTitle = document.querySelector(".hero h1");

if (heroTitle) {
  const lines = Array.from(heroTitle.children);
  let charIndex = 0;

  lines.forEach((line) => {
    const text = line.textContent;
    line.textContent = "";

    Array.from(text).forEach((char) => {
      const charNode = document.createElement("span");
      charNode.className = "hero-char";
      charNode.textContent = char === " " ? "\u00a0" : char;
      charNode.style.setProperty("--char-delay", `${charIndex * 16}ms`);
      line.appendChild(charNode);
      charIndex += 1;
    });
  });

  heroTitle.classList.add("is-split");
}
const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    threshold: 0.14,
    rootMargin: "0px 0px -40px 0px",
  }
);

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  observer.observe(item);
});

const nav = document.querySelector(".nav");

window.addEventListener(
  "scroll",
  () => {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
  },
  { passive: true }
);

const heroSection = document.querySelector(".hero");
let heroLoopTimer = null;
let heroIsVisible = true;

function replayHeroAnimation() {
  if (!heroSection || !heroIsVisible) return;
  heroSection.classList.remove("is-playing");
  void heroSection.offsetWidth;
  heroSection.classList.add("is-playing");
}

function startHeroLoop() {
  if (!heroSection || heroLoopTimer) return;
  replayHeroAnimation();
  heroLoopTimer = window.setInterval(replayHeroAnimation, 6200);
}

function stopHeroLoop() {
  if (!heroLoopTimer) return;
  window.clearInterval(heroLoopTimer);
  heroLoopTimer = null;
}

if (heroSection) {
  const heroVisibilityObserver = new IntersectionObserver(
    ([entry]) => {
      heroIsVisible = entry.isIntersecting;
      if (heroIsVisible) {
        startHeroLoop();
      } else {
        stopHeroLoop();
        heroSection.classList.remove("is-playing");
      }
    },
    { threshold: 0.42 }
  );

  heroVisibilityObserver.observe(heroSection);
  startHeroLoop();
}


const mediaTiles = document.querySelectorAll(".work-tile-media");

mediaTiles.forEach((tile) => {
  const video = tile.querySelector("video");
  if (!video) return;

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";

  const markVideoReady = () => {
    tile.classList.add("is-ready");
  };

  video.addEventListener("canplay", markVideoReady, { once: true });
  video.load();
  if (video.readyState >= 3) markVideoReady();

  tile.addEventListener("mouseenter", () => {
    tile.classList.add("is-playing");
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        tile.classList.remove("is-playing");
      });
    }
  });

  tile.addEventListener("mouseleave", () => {
    video.pause();
    tile.classList.remove("is-playing");
    window.setTimeout(() => {
      try {
        video.currentTime = 0;
      } catch (error) {
        // Ignore seek errors while the browser is still preparing local media.
      }
    }, 80);
  });
});


const languageToggle = document.querySelector("[data-lang-toggle]");
const translatableItems = document.querySelectorAll("[data-i18n]");

function applyLanguage(language) {
  const activeLanguage = language === "zh" ? "zh" : "en";
  document.documentElement.dataset.lang = activeLanguage;
  document.documentElement.lang = activeLanguage === "zh" ? "zh-CN" : "en";

  translatableItems.forEach((item) => {
    const value = item.dataset[activeLanguage];
    if (!value) return;

    if (value.includes("\n") || value.includes("&#10;")) {
      item.innerHTML = value.replace(/&#10;|\n/g, "<br />");
      return;
    }

    item.textContent = value;
  });

  if (languageToggle) {
    languageToggle.textContent = activeLanguage === "zh" ? "EN" : "中文";
    languageToggle.setAttribute(
      "aria-label",
      activeLanguage === "zh" ? "Switch to English" : "切换为中文"
    );
  }

  try {
    window.localStorage.setItem("portfolio-language", activeLanguage);
  } catch (error) {
    // Language preference is optional; ignore storage restrictions.
  }
}

if (languageToggle && translatableItems.length) {
  let savedLanguage = "en";
  try {
    savedLanguage = window.localStorage.getItem("portfolio-language") || "en";
  } catch (error) {
    savedLanguage = "en";
  }

  applyLanguage(savedLanguage);

  languageToggle.addEventListener("click", () => {
    const nextLanguage = document.documentElement.dataset.lang === "zh" ? "en" : "zh";
    applyLanguage(nextLanguage);
  });
}

const camonMotionMode = window.matchMedia("(prefers-reduced-motion: reduce), (max-aspect-ratio: 1/1)");
const scrollFilmSections = document.querySelectorAll("[data-scroll-film]");

scrollFilmSections.forEach((section) => {
  const video = section.querySelector("[data-scroll-film-video]");
  if (!video) return;

  const nextSection = section.nextElementSibling;
  const overlayPanel =
    nextSection && nextSection.classList.contains("project-market") ? nextSection : null;

  let duration = 0;
  let frameRequested = false;

  const updateFilmFrame = () => {
    frameRequested = false;
    if (!duration) return;
    if (camonMotionMode.matches) { if (video.currentTime !== 0) video.currentTime = 0; return; }

    const rect = section.getBoundingClientRect();
    const scrollRange = Math.max(1, section.offsetHeight - projectMotionHeight() * 2);
    const progress = Math.min(1, Math.max(0, -rect.top / scrollRange));

    if (nav) {
      const navBottom = nav.getBoundingClientRect().bottom;
      const overlayRect = overlayPanel ? overlayPanel.getBoundingClientRect() : null;
      const overlayCoversNav =
        overlayRect && overlayRect.top <= navBottom && overlayRect.bottom > navBottom;
      const isOverFilm =
        !overlayCoversNav && rect.top < navBottom && rect.bottom > navBottom;
      nav.classList.toggle("is-over-scroll-film", isOverFilm);
    }
    const targetTime = progress * Math.max(0, duration - 1 / 60);

    if (Math.abs(video.currentTime - targetTime) > 1 / 120) {
      video.currentTime = targetTime;
    }
  };

  const requestFilmFrame = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateFilmFrame);
  };

  const prepareFilm = () => {
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.muted = true;
    video.pause();
    if (video.currentTime !== 0) video.currentTime = 0;
    section.classList.add("is-ready");
    requestFilmFrame();
  };

  if (video.readyState >= 1) {
    prepareFilm();
  } else {
    video.addEventListener("loadedmetadata", prepareFilm, { once: true });
  }

  video.addEventListener("play", () => video.pause());
  window.addEventListener("scroll", requestFilmFrame, { passive: true });
  window.addEventListener("resize", requestFilmFrame);
  camonMotionMode.addEventListener("change", requestFilmFrame);
});
// CAMON 30 strategic overview carousel
const strategyCarousels = document.querySelectorAll("[data-strategy-carousel]");

strategyCarousels.forEach((carousel) => {
  const track = carousel.querySelector("[data-strategy-track]");
  const previousButton = carousel.querySelector("[data-strategy-prev]");
  const nextButton = carousel.querySelector("[data-strategy-next]");
  if (!track || !previousButton || !nextButton) return;

  let controlFrame = 0;

  const getScrollStep = () => {
    const firstCard = track.querySelector(":scope > a");
    if (!firstCard) return track.clientWidth;

    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    const cardWidth = firstCard.getBoundingClientRect().width;
    return Math.max(cardWidth + gap, track.clientWidth - cardWidth);
  };

  const updateControls = () => {
    controlFrame = 0;
    const maximumScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const hasOverflow = maximumScroll > 2;
    const isAtStart = track.scrollLeft <= 2;
    const isAtEnd = track.scrollLeft >= maximumScroll - 2;

    carousel.classList.toggle("is-overflowing", hasOverflow);
    previousButton.disabled = !hasOverflow || isAtStart;
    nextButton.disabled = !hasOverflow || isAtEnd;
  };

  const requestControlUpdate = () => {
    if (controlFrame) return;
    controlFrame = window.requestAnimationFrame(updateControls);
  };

  const moveCarousel = (direction) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce), (max-aspect-ratio: 1/1)").matches;
    track.scrollBy({
      left: direction * getScrollStep(),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  previousButton.addEventListener("click", () => moveCarousel(-1));
  nextButton.addEventListener("click", () => moveCarousel(1));

  track.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    moveCarousel(event.key === "ArrowLeft" ? -1 : 1);
  });

  track.addEventListener("scroll", requestControlUpdate, { passive: true });
  window.addEventListener("resize", requestControlUpdate);

  if ("ResizeObserver" in window) {
    const strategyResizeObserver = new ResizeObserver(requestControlUpdate);
    strategyResizeObserver.observe(track);
  }

  window.requestAnimationFrame(updateControls);
});
// CAMON 30 core-style scroll gallery
const moodScrollSections = document.querySelectorAll("[data-mood-scroll]");

moodScrollSections.forEach((section) => {
  const cards = Array.from(section.querySelectorAll(".camon-float-card"));
  if (!cards.length) return;

  let frameRequested = false;

  const renderMoodProgress = (progress) => {
    cards.forEach((card, index) => {
      const start = index * 0.13;
      const end = start + 0.46;
      const local = Math.min(1, Math.max(0, (progress - start) / (end - start)));
      const rise = 145 - local * 245;
      const opacityIn = Math.min(1, local / 0.22);
      const opacityOut = Math.min(1, (1 - local) / 0.18);
      const opacity = Math.max(0, Math.min(opacityIn, opacityOut));
      const scale = 0.96 + Math.sin(local * Math.PI) * 0.06;

      card.style.setProperty("--float-y", rise.toFixed(2));
      card.style.setProperty("--float-opacity", opacity.toFixed(3));
      card.style.setProperty("--float-scale", scale.toFixed(3));
    });
  };

  const updateMoodScroll = () => {
    frameRequested = false;
    if (camonMotionMode.matches) { renderMoodProgress(0.58); return; }
    const rect = section.getBoundingClientRect();
    const scrollRange = Math.max(1, section.offsetHeight - projectMotionHeight());
    const progress = Math.min(1, Math.max(0, -rect.top / scrollRange));
    renderMoodProgress(progress);
  };

  const requestMoodFrame = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateMoodScroll);
  };

  window.addEventListener("scroll", requestMoodFrame, { passive: true });
  window.addEventListener("resize", requestMoodFrame);
  camonMotionMode.addEventListener("change", requestMoodFrame);
  window.requestAnimationFrame(updateMoodScroll);
});

// CAMON 30 imaging strategy TECNO reveal
const tecnoRevealSections = document.querySelectorAll("[data-tecno-reveal]");

tecnoRevealSections.forEach((section) => {
  let frameRequested = false;

  const updateTecnoReveal = () => {
    frameRequested = false;
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - projectMotionHeight() * 0.35);
    const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.72 - rect.top) / range));
    const alpha = 0.03 + progress * 0.16;
    section.style.setProperty("--tecno-alpha", alpha.toFixed(3));
  };

  const requestTecnoFrame = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateTecnoReveal);
  };

  window.addEventListener("scroll", requestTecnoFrame, { passive: true });
  window.addEventListener("resize", requestTecnoFrame);
  window.requestAnimationFrame(updateTecnoReveal);
});

// CAMON 30 PDF baseline: scene-upgrade rising panel
const riseStages = document.querySelectorAll("[data-rise-stage]");

riseStages.forEach((section) => {
  let frameRequested = false;

  const updateRise = () => {
    frameRequested = false;
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - projectMotionHeight());
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    section.style.setProperty("--rise-progress", progress.toFixed(3));
  };

  const requestRiseFrame = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateRise);
  };

  window.addEventListener("scroll", requestRiseFrame, { passive: true });
  window.addEventListener("resize", requestRiseFrame);
  window.requestAnimationFrame(updateRise);
});

// CAMON 30 PPT fixed-stage scaling and directed interactions
const pptFixedStages = document.querySelectorAll("[data-stage]");

function updatePptFixedScale() {
  if (!pptFixedStages.length) return;
  const availableWidth = Math.max(320, window.innerWidth - 32);
  const availableHeight = Math.max(320, window.innerHeight - 24);
  const scale = Math.min(1, availableWidth / 1440, availableHeight / 811);
  document.documentElement.style.setProperty("--stage-scale", scale.toFixed(4));
}

window.addEventListener("resize", updatePptFixedScale);
window.requestAnimationFrame(updatePptFixedScale);

const scenarioRiseSections = document.querySelectorAll("[data-scenario-rise]");
scenarioRiseSections.forEach((section) => {
  let frameRequested = false;
  const update = () => {
    frameRequested = false;
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - projectMotionHeight());
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    section.style.setProperty("--scenario-progress", progress.toFixed(3));
  };
  const request = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  window.requestAnimationFrame(update);
});

const imagingEvolutionSections = document.querySelectorAll("[data-imaging-evolution]");
imagingEvolutionSections.forEach((section) => {
  let frameRequested = false;
  const update = () => {
    frameRequested = false;
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - projectMotionHeight());
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    const fade = (start, end) => Math.min(1, Math.max(0, (progress - start) / (end - start)));
    section.style.setProperty("--wire-a", fade(0.05, 0.28).toFixed(3));
    section.style.setProperty("--wire-b", fade(0.28, 0.48).toFixed(3));
    section.style.setProperty("--wire-c", fade(0.62, 0.72).toFixed(3));
  };
  const request = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  window.requestAnimationFrame(update);
});

const transferPairs = document.querySelectorAll(".transfer-pair");
if (transferPairs.length) {
  const transferObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.34, rootMargin: "0px 0px -12% 0px" }
  );
  transferPairs.forEach((pair) => transferObserver.observe(pair));
}

// CAMON 30 restored: stable full-page interactions
const hdRiseSections = document.querySelectorAll('[data-hd-rise]');
hdRiseSections.forEach((section) => {
  const proportionalPc = window.matchMedia('(min-width: 0px)');
  // The source composite turns from black to white at row 2053 of 4320.
  // Stop the clip five source pixels inside the matching black area so the
  // anti-aliased clip edge remains invisible against the black base layer.
  const finalInsetPercent = (2048 / 4320) * 100;


  let frameRequested = false;
  const update = () => {
    frameRequested = false;
    if (camonMotionMode.matches) {
    section.style.setProperty('--rise-progress', '1');
    section.style.setProperty('--rise-panel-progress', '1');
    section.style.setProperty('--rise-panel-inset', proportionalPc.matches ? `${finalInsetPercent.toFixed(3)}%` : '47.523%');
    return;
    }
    const rect = section.getBoundingClientRect();
    let progress;
    let panelProgress;

    if (proportionalPc.matches) {
      const viewportHeight = window.innerHeight;
      const revealStart = viewportHeight * 0.92;
      const revealEnd = viewportHeight * 0.12;
      const range = Math.max(1, revealStart - revealEnd);
      progress = Math.min(1, Math.max(0, (revealStart - rect.top) / range));
      panelProgress = progress * progress * (3 - 2 * progress);
    } else {
      const range = Math.max(1, section.offsetHeight - projectMotionHeight());
      progress = Math.min(1, Math.max(0, -rect.top / range));
      panelProgress = Math.min(1, Math.max(0, (progress - 0.12) / 0.45));
    }

    section.style.setProperty('--rise-progress', progress.toFixed(3));
    section.style.setProperty('--rise-panel-progress', panelProgress.toFixed(3));
    const finalInset = proportionalPc.matches ? finalInsetPercent : 47.523;
    section.style.setProperty('--rise-panel-inset', (100 - panelProgress * (100 - finalInset)).toFixed(3) + '%');
  };
  const request = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  camonMotionMode.addEventListener('change', request);
  window.requestAnimationFrame(update);
});

const hdEvolutionSections = document.querySelectorAll('[data-hd-evolution]');
hdEvolutionSections.forEach((section) => {

  let frameRequested = false;
  const fade = (progress, start, end) => Math.min(1, Math.max(0, (progress - start) / Math.max(0.001, end - start)));
  const update = () => {
    frameRequested = false;
    if (camonMotionMode.matches) {
    section.style.setProperty('--evo-roadmap', '0');
    section.style.setProperty('--evo-camon30', '1');
    return;
    }
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - projectMotionHeight());
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    section.style.setProperty('--evo-roadmap', fade(progress, 0.16, 0.42).toFixed(3));
    section.style.setProperty('--evo-camon30', fade(progress, 0.58, 0.76).toFixed(3));
  };
  const request = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  camonMotionMode.addEventListener('change', request);
  window.requestAnimationFrame(update);
});

const hdTransferPages = document.querySelectorAll('.hd-transfer-page');
if (hdTransferPages.length) {
  const transferObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.28, rootMargin: '0px 0px -10% 0px' });
  hdTransferPages.forEach((page) => transferObserver.observe(page));
}

const hdTransferSequences = document.querySelectorAll('[data-transfer-sequence]');
hdTransferSequences.forEach((section) => {

  let frameRequested = false;
  const fade = (progress, start, end) => Math.min(1, Math.max(0, (progress - start) / Math.max(0.001, end - start)));
  const update = () => {
    frameRequested = false;
    if (camonMotionMode.matches) {
    section.style.setProperty('--sequence-progress', '1');
    section.style.setProperty('--left-show', '1');
    section.style.setProperty('--right-show', '1');
    return;
    }
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - projectMotionHeight());
    const progress = Math.min(1, Math.max(0, -rect.top / range));
    section.style.setProperty('--sequence-progress', fade(progress, 0.02, 0.20).toFixed(3));
    section.style.setProperty('--left-show', fade(progress, 0.01, 0.14).toFixed(3));
    section.style.setProperty('--right-show', fade(progress, 0.08, 0.22).toFixed(3));
  };
  const request = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  camonMotionMode.addEventListener('change', request);
  window.requestAnimationFrame(update);
});

// CAMON 30 nav: theme follows current page, visible only around the first page
const camonNav = document.querySelector('[data-camon-nav]');
if (camonNav) {
  const camonSections = Array.from(document.querySelectorAll('main > section'));
  const camonNavLinks = Array.from(camonNav.querySelectorAll('a'));

  const updateCamonNavAccess = (hidden) => {
    if (hidden) {
      camonNav.setAttribute('aria-hidden', 'true');
    } else {
      camonNav.removeAttribute('aria-hidden');
    }

    if ('inert' in camonNav) camonNav.inert = hidden;
    camonNavLinks.forEach((link) => {
      if (hidden) {
        link.setAttribute('tabindex', '-1');
      } else {
        link.removeAttribute('tabindex');
      }
    });
  };

  const updateCamonNav = () => {
    const firstPage = document.getElementById('page-01');
    const current = camonSections.find((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= window.innerHeight * 0.18 && rect.bottom >= window.innerHeight * 0.18;
    }) || firstPage;

    camonNav.classList.toggle('nav-theme-light', current?.classList.contains('is-white'));
    camonNav.classList.toggle('nav-theme-dark', !current?.classList.contains('is-white'));

    if (!firstPage) return;
    const firstRect = firstPage.getBoundingClientRect();
    const threshold = Math.min(window.innerHeight * 0.12, Math.max(48, firstRect.height * 0.2));
    const hideNav = firstRect.bottom < threshold;
    camonNav.classList.toggle('is-camon-hidden', hideNav);
    updateCamonNavAccess(hideNav);
  };

  let navFrameRequested = false;
  const requestCamonNavUpdate = () => {
    if (navFrameRequested) return;
    navFrameRequested = true;
    window.requestAnimationFrame(() => {
      navFrameRequested = false;
      updateCamonNav();
    });
  };

  window.addEventListener('scroll', requestCamonNavUpdate, { passive: true });
  window.addEventListener('resize', requestCamonNavUpdate);
  window.requestAnimationFrame(updateCamonNav);
}


// CAMON 30 transparent selectable text overlays sourced from the PDF text layer
(function initCamonTextOverlays() {
  const overlays = window.CAMON_TEXT_OVERLAYS;
  if (!overlays) return;

  const namespace = 'http://www.w3.org/2000/svg';

  const createOverlay = (pageNumber, className = '') => {
    const page = overlays[String(pageNumber)];
    if (!page || !page.items?.length) return null;

    const host = document.createElement('div');
    host.className = `camon-text-overlay ${className}`.trim();
    host.setAttribute('data-overlay-page', String(pageNumber));

    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', `0 0 ${page.width} ${page.height}`);
    const proportionalPc = window.matchMedia('(min-width: 0px)').matches;
    const overlayFit = pageNumber === 1 && proportionalPc ? 'xMidYMax meet' : 'xMidYMid meet';
    svg.setAttribute('preserveAspectRatio', overlayFit);
    svg.setAttribute('aria-label', `CAMON 30 page ${pageNumber} selectable text`);
    svg.setAttribute('role', 'group');

    for (const item of page.items) {
      const text = document.createElementNS(namespace, 'text');
      text.setAttribute('x', String(item.x));
      text.setAttribute('y', String(item.y));
      text.setAttribute('textLength', String(item.w));
      text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      text.setAttribute('font-size', String(Math.max(item.h, 8)));
      text.setAttribute('dominant-baseline', 'hanging');
      text.setAttribute('xml:space', 'preserve');
      text.textContent = item.text;
      svg.appendChild(text);
    }

    host.appendChild(svg);
    return host;
  };

  const mountOverlaySafely = (host, pageNumber, className = '') => {
    if (!host || host.querySelector(`[data-overlay-page="${pageNumber}"]`)) return;

    try {
      const overlay = createOverlay(pageNumber, className);
      if (overlay) host.appendChild(overlay);
    } catch (error) {
      console.warn(`[camon30] overlay mount failed for page ${pageNumber}`, error);
    }
  };

  const pageHosts = [
    ['#page-01', 1],
    ['#page-02', 2],
    ['#page-03', 3],
    ['#page-04', 4],
    ['#page-05', 5],
    ['#leather-cmf', 17],
  ];

  pageHosts.forEach(([selector, pageNumber]) => {
    const section = document.querySelector(selector);
    mountOverlaySafely(section, pageNumber);
  });

  const riseSticky = document.querySelector('#page-06 .hd-rise-sticky');
  mountOverlaySafely(riseSticky, 6, 'is-rise');

  const evolutionFrame = document.querySelector('.hd-evolution-frame');
  if (evolutionFrame) {
    const evolutionLayers = [
      [10, 'is-evolution hd-evolution-layer is-intro'],
      [11, 'is-evolution hd-evolution-layer is-roadmap'],
      [12, 'is-evolution hd-evolution-layer is-camon30'],
    ];

    evolutionLayers.forEach(([pageNumber, className]) => {
      mountOverlaySafely(evolutionFrame, pageNumber, className);
    });
  }
})();









