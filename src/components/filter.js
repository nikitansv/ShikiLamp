/**
 * Placeholder for the future Shikimori library filter.
 */
function Filter() {
  this.html = null;
}

Filter.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local filter-page">' +
    '<div class="shikimori-local__head">Библиотека Shikimori</div>' +
    '<div class="shikimori-local__empty">Фильтр будет добавлен следующим этапом</div>' +
  '</div>';
};

Filter.prototype.render = function () {
  return this.html;
};

Filter.prototype.destroy = function () {
  this.html = null;
};

module.exports = Filter;
