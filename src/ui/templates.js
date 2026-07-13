/**
 * HTML templates for custom screens.
 */
function homeTemplate() {
  return '<div class="shikimori-local home-page">' +
    '<div class="shikimori-local__head">Shikimori Local</div>' +
    '<div class="shikimori-local__sections">' +
      '<div class="shikimori-local__section selector" data-section="popular">Популярное</div>' +
      '<div class="shikimori-local__section selector" data-section="ongoing">Онгоинги</div>' +
      '<div class="shikimori-local__section selector" data-section="latest">Недавно вышедшее</div>' +
      '<div class="shikimori-local__section selector" data-section="announced">Анонсы</div>' +
      '<div class="shikimori-local__section selector" data-section="search">Поиск</div>' +
      '<div class="shikimori-local__section selector" data-section="mappings">Локальные соответствия</div>' +
      '<div class="shikimori-local__section selector" data-section="diagnostics">Диагностика</div>' +
    '</div>' +
  '</div>';
}

function animeTemplate(anime) {
  const title = escapeHtml(anime.title || 'Unknown');
  const original = escapeHtml(anime.original_title || '');
  const russian = escapeHtml(anime.russian_title || '');
  const description = escapeHtml((anime.description || '').slice(0, 500));
  return '<div class="shikimori-local anime-detail">' +
    '<div class="shikimori-local__poster" style="background-image:url(' + (anime.poster || '') + ')"></div>' +
    '<div class="shikimori-local__info">' +
      '<h1>' + title + '</h1>' +
      (russian ? '<div class="shikimori-local__sub">' + russian + '</div>' : '') +
      (original ? '<div class="shikimori-local__sub">' + original + '</div>' : '') +
      '<div class="shikimori-local__meta">' +
        'Тип: ' + (anime.kind || '?') + ' · Статус: ' + (anime.status || '?') + ' · Эпизоды: ' + (anime.episodes || '?') + ' · Год: ' + (anime.year || '?') + ' · Рейтинг: ' + (anime.score || '?') +
      '</div>' +
      '<div class="shikimori-local__description">' + description + '</div>' +
      '<div class="shikimori-local__actions">' +
        '<div class="shikimori-local__action selector" data-action="tmdb">Найти в TMDB</div>' +
        '<div class="shikimori-local__action selector" data-action="add-planned">В планы</div>' +
        '<div class="shikimori-local__action selector" data-action="add-watching">Смотрю</div>' +
        '<div class="shikimori-local__action selector" data-action="add-completed">Просмотрено</div>' +
        '<div class="shikimori-local__action selector" data-action="set-score">Оценка</div>' +
        '<div class="shikimori-local__action selector" data-action="set-episodes">Эпизоды</div>' +
        '<div class="shikimori-local__action selector" data-action="delete-rate">Удалить из списка</div>' +
        '<div class="shikimori-local__action selector" data-action="mapping">Выбрать соответствие</div>' +
        '<div class="shikimori-local__action selector" data-action="external">Открыть на Shikimori</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function searchTemplate() {
  return '<div class="shikimori-local search-page">' +
    '<div class="shikimori-local__head">Поиск по Shikimori</div>' +
    '<input type="text" class="shikimori-local__input selector" placeholder="Название или Shikimori ID..." />' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
}

function diagnosticsTemplate(data) {
  return '<div class="shikimori-local diagnostics-page">' +
    '<div class="shikimori-local__head">Диагностика</div>' +
    '<div class="shikimori-local__diag">' +
      '<div>Версия плагина: ' + (data.version || '?') + '</div>' +
      '<div>Lampa Maker: ' + (data.hasMaker ? 'да' : 'нет') + '</div>' +
      '<div>Lampa ContentRows: ' + (data.hasContentRows ? 'да' : 'нет') + '</div>' +
      '<div>API Base URL: ' + escapeHtml(data.apiBaseUrl || '?') + '</div>' +
      '<div>Размер кэша: ' + (data.cacheSize || 0) + '</div>' +
      '<div>Mapping записей: ' + (data.mappingCount || 0) + '</div>' +
      '<div>Последний запрос: ' + (data.lastRequestStatus || '-') + '</div>' +
      '<div>CORS тест: ' + (data.corsTest || '-') + '</div>' +
      '<div>Экспериментальный токен: ' + (data.hasToken ? 'установлен' : 'не установлен') + '</div>' +
    '</div>' +
    '<div class="shikimori-local__actions">' +
      '<div class="shikimori-local__action selector" data-action="test-api">Проверить API</div>' +
      '<div class="shikimori-local__action selector" data-action="test-graphql">Проверить GraphQL</div>' +
      '<div class="shikimori-local__action selector" data-action="test-search">Тестовый поиск</div>' +
      '<div class="shikimori-local__action selector" data-action="clear-log">Очистить журнал</div>' +
      '<div class="shikimori-local__action selector" data-action="export-report">Экспортировать report</div>' +
    '</div>' +
  '</div>';
}

function mappingTemplate(anime, candidates) {
  let html = '<div class="shikimori-local mapping-page">' +
    '<div class="shikimori-local__head">Выберите соответствие для ' + escapeHtml(anime.title) + '</div>';
  if (candidates.length === 0) {
    html += '<div class="shikimori-local__empty">Варианты не найдены. Введите TMDB ID вручную.</div>';
  }
  candidates.forEach(function (c, i) {
    html += '<div class="shikimori-local__candidate selector" data-index="' + i + '" data-type="' + c.type + '" data-id="' + c.item.id + '" data-score="' + c.score + '" data-name="' + escapeHtml(c.item.name) + '">' +
      '<img src="' + (c.item.poster_path ? 'https://image.tmdb.org/t/p/w92' + c.item.poster_path : '') + '" />' +
      '<div class="shikimori-local__candidate-info">' +
        '<div class="shikimori-local__candidate-title">' + escapeHtml(c.item.name) + '</div>' +
        '<div class="shikimori-local__candidate-meta">' + (c.type || '?') + ' · ' + (c.item.year || '?') + ' · score ' + c.score + '</div>' +
      '</div>' +
    '</div>';
  });
  html += '<div class="shikimori-local__manual">' +
    '<label>TMDB ID: <input type="text" class="shikimori-local__manual-id selector" /></label>' +
    '<label>Тип: <select class="shikimori-local__manual-type selector"><option value="tv">TV</option><option value="movie">Movie</option></select></label>' +
    '<label>Сезон: <input type="text" class="shikimori-local__manual-season selector" value="1" /></label>' +
    '<div class="shikimori-local__action selector" data-action="manual-save">Сохранить вручную</div>' +
  '</div>';
  html += '</div>';
  return html;
}

function escapeHtml(text) {
  return String(text || '').replace(/[<>"'&]/g, function (m) {
    return { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[m];
  });
}

module.exports = {
  homeTemplate,
  animeTemplate,
  searchTemplate,
  diagnosticsTemplate,
  mappingTemplate,
  escapeHtml
};
