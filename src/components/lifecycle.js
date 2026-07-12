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

  Lampa.Controller.add('content', {
    toggle: function () {
      Lampa.Controller.collectionSet(instance.html);
      const focused = instance.html.querySelector('.selector.focus') || instance.html.querySelector('.selector');
      if (focused) Lampa.Controller.collectionFocus(focused, instance.html);
    },
    left: function () {
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('left')) Navigator.move('left');
      else Lampa.Controller.toggle('menu');
    },
    right: function () {
      if (typeof Navigator !== 'undefined' && Navigator.move) Navigator.move('right');
    },
    up: function () {
      if (typeof Navigator !== 'undefined' && Navigator.canmove && Navigator.canmove('up')) Navigator.move('up');
      else Lampa.Controller.toggle('head');
    },
    down: function () {
      if (typeof Navigator !== 'undefined' && Navigator.move) Navigator.move('down');
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
