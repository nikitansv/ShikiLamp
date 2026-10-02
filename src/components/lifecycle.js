function getLampa() {
  return typeof Lampa !== 'undefined' ? Lampa : typeof window !== 'undefined' ? window.Lampa : null;
}

function canFocus(instance) {
  const Lampa = getLampa();
  if (!Lampa || !Lampa.Controller || !instance.html || instance.__shikimoriDestroyed || instance.__shikimoriActive === false) return false;
  if (instance.activity && Lampa.Activity && Lampa.Activity.own && !Lampa.Activity.own(instance)) return false;
  const enabled = Lampa.Controller.enabled && Lampa.Controller.enabled();
  return !enabled || !enabled.name || enabled.name === 'content';
}

function selectable(instance, target) {
  if (!target || !instance.html.contains(target) || !target.classList.contains('selector')) return false;
  if (target.closest('.disabled, .hide, [hidden], .shikimori-local__dropdown:not(.open)')) return false;
  if (target.closest('.shikimori-local__filter-panel') && instance.panelHidden) return false;
  if (instance.getFocusRoot && !instance.getFocusRoot().contains(target)) return false;
  for (let node = target; node && node !== instance.html.parentNode; node = node.parentElement) {
    if (node.style.display === 'none') return false;
  }
  return true;
}

function rememberFocus(instance, target) {
  if (!instance.html) return;
  target = target || instance.html.querySelector('.selector.focus');
  if (!selectable(instance, target)) return;
  instance.__shikimoriFocus = target;
}

function savedFocus(instance) {
  const saved = instance.__shikimoriFocus;
  if (!saved) return null;
  if (selectable(instance, saved)) return saved;
  const attrs = ['data-action', 'data-tab', 'data-field', 'data-value', 'data-id'];
  return Array.from(instance.html.querySelectorAll('.selector')).find(function (el) {
    if (!selectable(instance, el)) return false;
    if (saved.__shikimoriAnime) return el.__shikimoriAnime && el.__shikimoriAnime.shikimori_id === saved.__shikimoriAnime.shikimori_id;
    return attrs.some(function (attr) { return saved.hasAttribute(attr) && el.getAttribute(attr) === saved.getAttribute(attr); });
  });
}

function scrollFocused(instance) {
  if (!canFocus(instance)) return;
  if (instance.__shikimoriRestoreScroll) {
    restoreScroll(instance);
    instance.__shikimoriRestoreScroll = false;
    return;
  }
  const target = instance.html.querySelector('.selector.focus');
  if (!target) return;
  const Lampa = getLampa();
  const motion = document.documentElement.getAttribute('data-shiki-motion') ||
    (Lampa.Storage && (Lampa.Storage.get('shikimori_local_ui', {}) || {}).motion);
  const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduced || motion === 'off' ? 'auto' : 'smooth';
  for (let node = target.parentElement; node && instance.html.contains(node); node = node.parentElement) {
    const rect = target.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const edgeLeft = box.left + node.clientLeft + (parseFloat(style.scrollPaddingLeft) || 0);
    const edgeRight = box.left + node.clientLeft + node.clientWidth - (parseFloat(style.scrollPaddingRight) || 0);
    const edgeTop = box.top + node.clientTop + (parseFloat(style.scrollPaddingTop) || 0);
    const edgeBottom = box.top + node.clientTop + node.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
    const left = node.scrollWidth > node.clientWidth ? rect.left < edgeLeft ? rect.left - edgeLeft : Math.max(0, rect.right - edgeRight) : 0;
    const top = node.scrollHeight > node.clientHeight ? rect.top < edgeTop ? rect.top - edgeTop : Math.max(0, rect.bottom - edgeBottom) : 0;
    if (!left && !top) continue;
    if (node.scrollTo) node.scrollTo({ left: node.scrollLeft + left, top: node.scrollTop + top, behavior: behavior });
    else { node.scrollLeft += left; node.scrollTop += top; }
  }
}

function rememberScroll(instance) {
  if (!instance.html || instance.__shikimoriActive === false) return;
  instance.__shikimoriScroll = [instance.html].concat(Array.from(instance.html.querySelectorAll('*')))
    .filter(function (node) { return node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight; })
    .map(function (node) { return { node: node, left: node.scrollLeft, top: node.scrollTop }; });
}

function restoreScroll(instance) {
  (instance.__shikimoriScroll || []).forEach(function (saved) {
    if (!instance.html.contains(saved.node)) return;
    const behavior = saved.node.style.scrollBehavior;
    saved.node.style.scrollBehavior = 'auto';
    saved.node.scrollLeft = saved.left;
    saved.node.scrollTop = saved.top;
    saved.node.style.scrollBehavior = behavior;
  });
}

function cancelFocusScroll(instance) {
  if (instance.__shikimoriFocusFrame == null) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(instance.__shikimoriFocusFrame);
  else clearTimeout(instance.__shikimoriFocusFrame);
  instance.__shikimoriFocusFrame = null;
}

function scheduleFocusScroll(instance) {
  cancelFocusScroll(instance);
  const apply = function () { instance.__shikimoriFocusFrame = null; scrollFocused(instance); };
  instance.__shikimoriFocusFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(apply) : setTimeout(apply, 16);
}

function refocus(instance, preferred) {
  if (!canFocus(instance)) return;
  const target = [preferred, instance.pendingFocus, instance.html.querySelector('.selector.focus'), savedFocus(instance)]
    .find(function (el) { return selectable(instance, el); }) ||
    Array.from(instance.html.querySelectorAll('.selector')).find(function (el) { return selectable(instance, el); });
  instance.pendingFocus = null;
  const Lampa = getLampa();
  const collection = instance.getFocusRoot ? instance.getFocusRoot() : instance.html;
  // collectionSet clears .focus in Lampa, so resolve the target before calling it.
  Lampa.Controller.collectionSet(collection, false, true);
  if (target) {
    rememberFocus(instance, target);
    Lampa.Controller.collectionFocus(target, collection, true);
    target.classList.add('focus');
    scheduleFocusScroll(instance);
  }
}

function bindAction(element, action) {
  element.addEventListener('hover:enter', action);
  // Lampa translates native clicks to hover:enter on bound selectors.
  element.addEventListener('click', function (event) { if (!element.bind_events) action(event); });
}

function scrollStep(instance, focused, delta) {
  for (let node = focused && focused.parentElement; node && instance.html.contains(node); node = node.parentElement) {
    const max = node.scrollHeight - node.clientHeight;
    const next = Math.max(0, Math.min(max, node.scrollTop + delta));
    if (max > 0 && next !== node.scrollTop) {
      node.scrollTop = next;
      return true;
    }
  }
  return false;
}

function focusFirst(html) {
  refocus({ html: html });
}

function addContentController(instance) {
  const Lampa = getLampa();
  if (!Lampa || !Lampa.Controller || !instance || !instance.html) return;

  instance.__shikimoriDestroyed = false;
  instance.__shikimoriActive = true;

  if (typeof instance.beforeStart === 'function') instance.beforeStart();
  if (instance.__shikimoriScroll) instance.__shikimoriRestoreScroll = true;
  if (!instance.__shikimoriStarted) {
    const page = instance.html.querySelector('.shikimori-local');
    if (page) page.classList.add('shiki-page-enter');
    instance.__shikimoriStarted = true;
  }

  const scrollFocusedIntoView = function () {
    if (!canFocus(instance)) return;
    const focused = instance.html.querySelector('.selector.focus');
    rememberFocus(instance, focused);
    if (focused && typeof instance.onFocusChange === 'function') instance.onFocusChange(focused);
    scheduleFocusScroll(instance);
  };

  Lampa.Controller.add('content', {
    invisible: true,
    toggle: function () {
      if (instance.__shikimoriDestroyed || !instance.html) return;
      if (typeof instance.onContentShow === 'function') instance.onContentShow();
      refocus(instance);
    },
    gone: function (name) {
      rememberFocus(instance);
      cancelFocusScroll(instance);
      if (typeof instance.onControllerGone === 'function') instance.onControllerGone(name);
    },
    left: function () {
      if (instance.__shikimoriDestroyed || !instance.html) return;
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onLeftWall === 'function' && instance.onLeftWall(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('left')) Navigator.move('left');
      else {
        if (typeof instance.onMenuOpen === 'function') instance.onMenuOpen();
        Lampa.Controller.toggle('menu');
      }
      scrollFocusedIntoView();
    },
    right: function () {
      if (instance.__shikimoriDestroyed || !instance.html) return;
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onRightEdge === 'function' && instance.onRightEdge(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('right')) {
        Navigator.move('right');
        scrollFocusedIntoView();
      } else if (typeof instance.onRightWall === 'function') {
        instance.onRightWall(focused);
      }
    },
    up: function () {
      if (instance.__shikimoriDestroyed || !instance.html) return;
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onUp === 'function' && instance.onUp(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('up')) {
        Navigator.move('up');
        scrollFocusedIntoView();
      } else if (!scrollStep(instance, focused, -260)) {
        Lampa.Controller.toggle('head');
      }
    },
    down: function () {
      if (instance.__shikimoriDestroyed || !instance.html) return;
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onDown === 'function' && instance.onDown(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('down')) {
        Navigator.move('down');
        scrollFocusedIntoView();
      } else scrollStep(instance, focused, 260);
    },
    back: function () {
      if (instance.__shikimoriDestroyed) return;
      if (typeof instance.onBack === 'function' && instance.onBack()) return;
      cancelFocusScroll(instance);
      if (Lampa.Activity && Lampa.Activity.backward) Lampa.Activity.backward();
    },
    enter: function () {
      if (instance.__shikimoriDestroyed || !instance.html) return;
      const focused = instance.html.querySelector('.selector.focus');
      if (focused) focused.dispatchEvent(new window.Event('hover:enter'));
    }
  });

  Lampa.Controller.toggle('content');
  scrollFocusedIntoView();
  bindWheelScrolling(instance);
  if (!instance.__shikimoriFocusHandler) {
    instance.__shikimoriFocusHandler = function (event) {
      if (!canFocus(instance)) return;
      const target = event.target.closest('.selector');
      rememberFocus(instance, target);
      if (target && typeof instance.onFocusChange === 'function') instance.onFocusChange(target);
      scheduleFocusScroll(instance);
    };
    instance.html.addEventListener('hover:focus', instance.__shikimoriFocusHandler, true);
    instance.html.addEventListener('hover:hover', instance.__shikimoriFocusHandler, true);
    instance.html.addEventListener('click', instance.__shikimoriFocusHandler, true);
  }
}

function bindWheelScrolling(instance) {
  if (!instance || !instance.html || instance.__shikimoriWheelHandler) return;
  const root = instance.html;

  instance.__shikimoriWheelRoot = root;
  instance.__shikimoriWheelHandler = function (event) {
    if (instance.__shikimoriDestroyed || instance.__shikimoriActive === false) return;
    for (let target = event.target; target && instance.html.contains(target); target = target.parentElement) {
      const horizontal = target.classList.contains('shikimori-local__row-items') || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontal ? event.deltaX || event.deltaY : event.deltaY;
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? horizontal ? target.clientWidth : target.clientHeight : 1;
      const property = horizontal ? 'scrollLeft' : 'scrollTop';
      const max = horizontal ? target.scrollWidth - target.clientWidth : target.scrollHeight - target.clientHeight;
      const next = Math.max(0, Math.min(max, target[property] + delta * factor));
      if (max > 0 && next !== target[property]) {
        target[property] = next;
        event.preventDefault();
        return;
      }
    }
  };
  root.addEventListener('wheel', instance.__shikimoriWheelHandler, { passive: false });
}

function unbindWheelScrolling(instance) {
  if (!instance || !instance.__shikimoriWheelHandler) return;
  instance.__shikimoriWheelRoot.removeEventListener('wheel', instance.__shikimoriWheelHandler);
  delete instance.__shikimoriWheelRoot;
  delete instance.__shikimoriWheelHandler;
}

function attachLifecycle(Component) {
  if (!Component || !Component.prototype) return Component;
  if (Object.prototype.hasOwnProperty.call(Component.prototype, '__shikimoriLifecycle')) return Component;
  Component.prototype.__shikimoriLifecycle = true;

  const start = Object.prototype.hasOwnProperty.call(Component.prototype, 'start') && Component.prototype.start;
  Component.prototype.start = function () {
    this.__shikimoriDestroyed = false;
    this.__shikimoriActive = true;
    if (start) start.call(this);
    else addContentController(this);
  };

  ['pause', 'stop'].forEach(function (name) {
    const original = Object.prototype.hasOwnProperty.call(Component.prototype, name) && Component.prototype[name];
    Component.prototype[name] = function () {
      rememberFocus(this);
      rememberScroll(this);
      this.__shikimoriActive = false;
      cancelFocusScroll(this);
      if (original) original.call(this);
    };
  });

  const destroy = Component.prototype.destroy;
  Component.prototype.destroy = function () {
    this.__shikimoriDestroyed = true;
    this.__shikimoriActive = false;
    cancelFocusScroll(this);
    unbindWheelScrolling(this);
    if (this.html && this.__shikimoriFocusHandler) {
      ['hover:focus', 'hover:hover', 'click'].forEach(function (name) { this.html.removeEventListener(name, this.__shikimoriFocusHandler, true); }, this);
      delete this.__shikimoriFocusHandler;
    }
    if (destroy) destroy.call(this);
  };

  return Component;
}

module.exports = {
  attachLifecycle: attachLifecycle,
  focusFirst: focusFirst,
  refocus: refocus,
  rememberFocus: rememberFocus,
  bindAction: bindAction,
  canFocus: canFocus,
  addContentController: addContentController
};
