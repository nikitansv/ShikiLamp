/**
 * Shikimori home screen component.
 */
const templates = require('../ui/templates');
const logger = require('../logger');

function Home() {
  this.html = null;
  this.scroll = null;
}

Home.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = templates.homeTemplate();
  this.bindEvents();
};

Home.prototype.bindEvents = function () {
  const self = this;
  this.html.querySelectorAll('.shikimori-local__section').forEach(function (el) {
    el.addEventListener('hover:enter', function () {
      const section = el.getAttribute('data-section');
      self.openSection(section);
    });
    el.addEventListener('click', function () {
      const section = el.getAttribute('data-section');
      self.openSection(section);
    });
  });
};

Home.prototype.openSection = function (section) {
  if (section === 'search') {
    Lampa.Activity.push({ url: '', title: 'Поиск Shikimori', component: 'shikimori_local_search' });
  } else if (section === 'mappings') {
    Lampa.Activity.push({ url: '', title: 'Локальные соответствия', component: 'shikimori_local_mappings' });
  } else if (section === 'diagnostics') {
    Lampa.Activity.push({ url: '', title: 'Диагностика Shikimori', component: 'shikimori_local_diagnostics' });
  } else {
    Lampa.Activity.push({
      url: '',
      title: 'Shikimori: ' + section,
      component: 'shikimori_local_line',
      section: section
    });
  }
};

Home.prototype.render = function () {
  return this.html;
};

Home.prototype.destroy = function () {
  this.html = null;
};

module.exports = Home;
