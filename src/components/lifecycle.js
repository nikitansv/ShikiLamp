function getLampa() {
  return typeof window !== 'undefined' ? window.Lampa : null;
}

function focusFirst(html) {
  const Lampa = getLampa();
  if (!Lampa || !Lampa.Controller || !html) return;

  const first = html.querySelector('.selector');
  if (!first) return;

  Lampa.Controller.collectionSet(html);
  Lampa.Controller.collectionFocus(first, html);
}

function addContentController(instance) {
  const Lampa = getLampa();
  if (!Lampa || !Lampa.Controller || !instance || !instance.html) return;

  const scrollFocusedIntoView = function () {
    const apply = function () {
      if (!instance.html) return;
      const focused = instance.html.querySelector('.selector.focus');
      if (!focused) return;

      if (typeof instance.onFocusChange === 'function') instance.onFocusChange(focused);

      if (focused.scrollIntoView) {
        focused.scrollIntoView({ block: 'center', inline: 'nearest' });
      }

      const rootRect = instance.html.getBoundingClientRect ? instance.html.getBoundingClientRect() : null;
      const itemRect = focused.getBoundingClientRect ? focused.getBoundingClientRect() : null;
      if (!rootRect || !itemRect) return;

      const topGap = itemRect.top - rootRect.top;
      const bottomGap = rootRect.bottom - itemRect.bottom;
      if (topGap < 90) instance.html.scrollTop -= 90 - topGap;
      else if (bottomGap < 140) instance.html.scrollTop += 140 - bottomGap;
    };

    apply();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(apply);
      requestAnimationFrame(function () { requestAnimationFrame(apply); });
    } else {
      setTimeout(apply, 16);
      setTimeout(apply, 50);
    }
  };

  Lampa.Controller.add('content', {
    toggle: function () {
      Lampa.Controller.collectionSet(instance.html);
      const focused = instance.html.querySelector('.selector.focus') || instance.html.querySelector('.selector');
      if (focused) Lampa.Controller.collectionFocus(focused, instance.html);
    },
    left: function () {
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onLeftWall === 'function' && instance.onLeftWall(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('left')) Navigator.move('left');
      else Lampa.Controller.toggle('menu');
      scrollFocusedIntoView();
    },
    right: function () {
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
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onUp === 'function' && instance.onUp(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('up')) {
        Navigator.move('up');
        scrollFocusedIntoView();
      } else if (instance.html && instance.html.scrollTop > 0) {
        instance.html.scrollTop = Math.max(0, instance.html.scrollTop - 260);
      } else {
        Lampa.Controller.toggle('head');
      }
    },
    down: function () {
      const focused = instance.html ? instance.html.querySelector('.selector.focus') : null;
      if (typeof instance.onDown === 'function' && instance.onDown(focused)) return;
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('down')) {
        Navigator.move('down');
        scrollFocusedIntoView();
      } else if (instance.html) {
        instance.html.scrollTop += 260;
      }
    },
    back: function () {
      if (Lampa.Activity && Lampa.Activity.backward) Lampa.Activity.backward();
    },
    enter: function () {
      const focused = instance.html.querySelector('.selector.focus');
      if (focused) focused.dispatchEvent(new Event('hover:enter'));
    }
  });

  Lampa.Controller.toggle('content');
  focusFirst(instance.html);
  scrollFocusedIntoView();
}

function attachLifecycle(Component) {
  if (!Component || !Component.prototype) return Component;

  if (!Component.prototype.start) {
    Component.prototype.start = function () {
      addContentController(this);
    };
  }

  if (!Component.prototype.pause) Component.prototype.pause = function () {};
  if (!Component.prototype.stop) Component.prototype.stop = function () {};

  return Component;
}

module.exports = {
  attachLifecycle: attachLifecycle,
  focusFirst: focusFirst,
  addContentController: addContentController
};
