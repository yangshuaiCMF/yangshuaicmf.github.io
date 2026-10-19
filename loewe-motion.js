(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  // Reference cadence: 76% of the lift in the first 24%, then a long quiet landing.
  // Matching slopes keep the visible braking point continuous and never overshoot.
  function segment(t, x0, x1, y0, y1, m0, m1) {
    const span = x1 - x0, u = (t - x0) / span, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * span * m0
      + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * span * m1;
  }
  function arrival(value) {
    const t = clamp(value);
    if (t < .24) return segment(t, 0, .24, 0, .76, 4.8, 1);
    if (t < .70) return segment(t, .24, .70, .76, .975, 1, .18);
    return segment(t, .70, 1, .975, 1, .18, 0);
  }
  function follow(current, target, elapsed, epsilon = .0002) {
    if (current === null || Math.abs(target - current) < epsilon) return target;
    const next = current + (target - current) * (1 - Math.exp(-Math.min(40, elapsed) / 58));
    return Math.abs(target - next) < epsilon ? target : next;
  }
  window.LoeweMotion = Object.freeze({arrival, follow});
})();
