// Shared, interruptible motion. Every operation has an immediate fallback for TV engines.
const effects = new Map();
const scrolls = new Map();

function duration() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  const mode = document.documentElement.getAttribute('data-shiki-motion');
  return mode === 'off' ? 0 : mode === 'fast' ? 90 : mode === 'soft' ? 320 : 180;
}

function cancelEffect(node) {
  const effect = effects.get(node);
  if (!effect) return;
  effects.delete(node);
  effect.onfinish = null;
  effect.cancel();
}

function animate(node, frames, done, limit) {
  if (!node) return;
  cancelEffect(node);
  const time = Math.min(duration(), limit || Infinity);
  if (!time || !node.animate || !node.isConnected) { if (done) done(); return; }
  const effect = node.animate(frames, { duration: time, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
  effects.set(node, effect);
  effect.onfinish = function () {
    if (effects.get(node) !== effect) return;
    effects.delete(node);
    effect.cancel();
    if (done) done();
  };
}

function reveal(node, direction) {
  animate(node, [{ opacity: 0, transform: 'translateX(' + ((direction || 1) * 18) + 'px)' }, { opacity: 1, transform: 'translateX(0)' }]);
}

function dropdown(node, open, done) {
  if (!node) return;
  const height = node.getBoundingClientRect().height;
  const opacity = height ? window.getComputedStyle(node).opacity : 0;
  cancelEffect(node);
  node.classList.toggle('open', open);
  node.classList.toggle('shiki-closing', !open && height > 0);
  node.setAttribute('aria-hidden', open ? 'false' : 'true');
  const expanded = node.getBoundingClientRect().height;
  const collapsed = { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' };
  const full = { height: expanded + 'px', opacity: 1 };
  animate(node, open ? [Object.assign({}, collapsed, { height: height + 'px', opacity: opacity }), full] : [{ height: height + 'px', opacity: opacity }, collapsed], function () {
    node.classList.remove('shiki-closing');
    if (done) done();
  });
}

function target(node) {
  const current = scrolls.get(node);
  return current ? { left: current.left, top: current.top } : { left: node.scrollLeft, top: node.scrollTop };
}

function cancelScroll(node) {
  const current = scrolls.get(node);
  if (!current) return;
  window.cancelAnimationFrame(current.frame);
  scrolls.delete(node);
}

function scroll(node, left, top, instant) {
  left = Math.max(0, Math.min(node.scrollWidth - node.clientWidth, left));
  top = Math.max(0, Math.min(node.scrollHeight - node.clientHeight, top));
  const previous = scrolls.get(node);
  if (!instant && previous && previous.left === left && previous.top === top) return;
  cancelScroll(node);
  const time = instant ? 0 : duration();
  if (!time || !window.requestAnimationFrame) { node.scrollLeft = left; node.scrollTop = top; return; }
  const fromLeft = node.scrollLeft, fromTop = node.scrollTop;
  if (fromLeft === left && fromTop === top) return;
  const started = Date.now();
  const state = { left: left, top: top, frame: null };
  scrolls.set(node, state);
  function step() {
    if (scrolls.get(node) !== state) return;
    const progress = Math.min(1, (Date.now() - started) / time);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.scrollLeft = fromLeft + (left - fromLeft) * eased;
    node.scrollTop = fromTop + (top - fromTop) * eased;
    if (progress < 1 && duration()) state.frame = window.requestAnimationFrame(step);
    else { node.scrollLeft = left; node.scrollTop = top; scrolls.delete(node); }
  }
  state.frame = window.requestAnimationFrame(step);
}

function stop(root, finish) {
  if (!root) return;
  scrolls.forEach(function (state, node) {
    if (root.contains(node)) {
      if (finish) scroll(node, state.left, state.top, true);
      else cancelScroll(node);
    }
  });
  effects.forEach(function (effect, node) {
    if (root.contains(node)) {
      if (finish && effect.onfinish) effect.onfinish();
      else cancelEffect(node);
    }
  });
  root.querySelectorAll('.shiki-closing').forEach(function (node) { node.classList.remove('shiki-closing'); });
}

module.exports = { duration, animate, reveal, dropdown, scroll, target, cancelScroll, stop };
