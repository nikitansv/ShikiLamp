const config = require('../config');

const OPTIONS = {
  status: [['', 'Любой статус'], ['ongoing', 'Онгоинг'], ['released', 'Вышло'], ['anons', 'Анонсы'], ['latest', 'Новинки']],
  kind: [['', 'Любой тип'], ['tv', 'TV'], ['movie', 'Movie'], ['ova', 'OVA'], ['ona', 'ONA'], ['special', 'Special']],
  season: [['', 'Любой сезон'], ['summer_2026', 'Лето 2026'], ['fall_2026', 'Осень 2026'], ['winter_2026', 'Зима 2026'], ['spring_2026', 'Весна 2026'], ['2026', '2026'], ['2025', '2025']],
  score: [['', 'Любой рейтинг'], ['9', 'от 9'], ['8', 'от 8'], ['7', 'от 7'], ['6', 'от 6']],
  rating: [['', 'Любой возраст'], ['g', 'G'], ['pg', 'PG'], ['pg_13', 'PG-13'], ['r', 'R'], ['r_plus', 'R+']],
  duration: [['', 'Любая длительность'], ['S', 'до 10 мин'], ['D', '10–30 мин'], ['F', 'от 30 мин']],
  origin: [['', 'Любой источник'], ['manga', 'Manga'], ['light_novel', 'Light novel'], ['original', 'Original'], ['game', 'Game']],
  order: [['ranked', 'По рейтингу'], ['popularity', 'По популярности'], ['aired_on', 'По дате выхода'], ['name', 'По названию'], ['episodes', 'По сериям']]
};
function Filter() {
  this.html = null;
  this.filters = {};
}

Filter.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.filters = loadFilters();
  this.renderBody();
};

Filter.prototype.renderBody = function () {
  const self = this;
  const fields = Object.keys(OPTIONS).map(function (key) {
    return '<div class="shikimori-local__action shikimori-local__filter-field selector" data-field="' + key + '"><span>' + fieldName(key) + '</span><span class="shikimori-local__filter-value">' + optionTitle(key, self.filters[key]) + '</span></div>';
  }).join('');
  this.html.innerHTML = '<div class="shikimori-local filter-page">' +
    '<div class="shikimori-local__filter-main"><div class="shikimori-local__head">Библиотека Shikimori</div></div>' +
    '<div class="shikimori-local__filter-panel"><div class="shikimori-local__filter-title">Фильтр</div>' +
    '<div class="shikimori-local__filter-start selector" data-action="apply">Начать поиск</div>' +
    '<div class="shikimori-local__filter-fields">' + fields + '</div>' +
    '<div class="shikimori-local__filter-reset selector" data-action="reset">Сбросить фильтры</div></div>' +
  '</div>';
  this.html.querySelectorAll('[data-field]').forEach(function (el) {
    const open = function () { self.selectField(el.getAttribute('data-field')); };
    el.addEventListener('hover:enter', open); el.addEventListener('click', open);
  });
  this.html.querySelectorAll('[data-action]').forEach(function (el) {
    const run = function () { self.action(el.getAttribute('data-action')); };
    el.addEventListener('hover:enter', run); el.addEventListener('click', run);
  });
};

Filter.prototype.selectField = function (field) {
  const options = OPTIONS[field];
  const current = this.filters[field] || '';
  const index = options.map(function (item) { return item[0]; }).indexOf(current);
  this.filters[field] = options[(index + 1) % options.length][0];
  this.renderBody();
};

Filter.prototype.action = function (action) {
  if (action === 'reset') { this.filters = { order: 'ranked' }; saveFilters(this.filters); this.renderBody(); return; }
  if (action === 'apply') { saveFilters(this.filters); Lampa.Activity.push({ url: '', title: 'Каталог Shikimori', component: 'shikimori_local_line', section: 'filter', filters: this.filters }); }
};

function loadFilters() { return typeof Lampa !== 'undefined' && Lampa.Storage ? (Lampa.Storage.get(config.STORAGE_KEYS.filter, { order: 'ranked' }) || { order: 'ranked' }) : { order: 'ranked' }; }
function saveFilters(filters) { if (typeof Lampa !== 'undefined' && Lampa.Storage) Lampa.Storage.set(config.STORAGE_KEYS.filter, filters); }
function optionTitle(field, value) { const match = OPTIONS[field].filter(function (item) { return item[0] === (value || ''); })[0]; return match ? match[1] : 'Любой'; }
function fieldName(field) { return { status: 'Статус', kind: 'Тип', season: 'Сезон / год', score: 'Рейтинг', rating: 'Возраст', duration: 'Длительность', origin: 'Первоисточник', order: 'Сортировка' }[field]; }

Filter.prototype.render = function () {
  return this.html;
};

Filter.prototype.destroy = function () {
  this.html = null;
};

module.exports = Filter;
