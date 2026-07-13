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

const STATUS_LABELS = {
  planned: 'В планах',
  watching: 'Смотрю',
  completed: 'Просмотрено',
  on_hold: 'Отложено',
  dropped: 'Брошено'
};

const KIND_LABELS = { tv: 'Сериал', ona: 'ONA', ova: 'OVA', movie: 'Фильм', special: 'Спешл' };
const API_STATUS_LABELS = { released: 'Завершено', ongoing: 'Выпускается', anons: 'Анонсировано', latest: 'Выпускается' };

function animeTemplate(anime) {
  const title = escapeHtml(anime.title || anime.russian_title || anime.original_title || 'Unknown');
  const altTitle = getAltTitle(anime);
  const description = cleanDescription(anime.description || '');
  const poster = escapeHtml(anime.poster || anime.image || '');
  return '<div class="shikimori-local anime-detail">' +
    '<div class="shikimori-local__poster">' + (poster ? '<img src="' + poster + '" />' : '<div class="shikimori-local__poster-fallback">' + title + '</div>') + '</div>' +
    '<div class="shikimori-local__info">' +
      '<h1>' + title + '</h1>' +
      (altTitle ? '<div class="shikimori-local__sub">' + escapeHtml(altTitle) + '</div>' : '') +
      metadataTemplate(anime) +
      (description ? '<div class="shikimori-local__description collapsed" data-description="text">' + escapeHtml(description) + '</div><div class="shikimori-local__text-toggle selector" data-action="toggle-description">Показать полностью</div>' : '') +
      '<div class="shikimori-local__primary-actions">' +
        dropdownButton('status-menu', statusButtonText(anime), 'primary') +
        dropdownButton('score-menu', scoreButtonText(anime), 'secondary') +
        episodesButton(anime) +
      '</div>' +
      statusMenu(anime) +
      scoreMenu(anime) +
      '<div class="shikimori-local__service-actions">' +
        '<div class="shikimori-local__action tertiary selector" data-action="tmdb">Найти в TMDB</div>' +
        '<div class="shikimori-local__action tertiary selector" data-action="external">Открыть на Shikimori ↗</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function getAltTitle(anime) {
  const title = String(anime.title || '').trim();
  const russian = String(anime.russian_title || '').trim();
  const original = String(anime.original_title || '').trim();
  if (original && original !== title && original !== russian) return original;
  if (russian && russian !== title) return russian;
  return '';
}

function metadataTemplate(anime) {
  const parts = [];
  if (anime.kind) parts.push(KIND_LABELS[anime.kind] || String(anime.kind).toUpperCase());
  if (anime.episodes) parts.push(formatEpisodes(anime.episodes));
  if (anime.year) parts.push(String(anime.year));
  if (anime.score) parts.push('Рейтинг ' + anime.score);
  if (anime.status) parts.push(API_STATUS_LABELS[anime.status] || anime.status);
  return '<div class="shikimori-local__meta">' + parts.map(function (part) {
    return '<span>' + escapeHtml(part) + '</span>';
  }).join('') + '</div>';
}

function formatEpisodes(count) {
  const n = Number(count);
  if (!n) return '? эпизодов';
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return n + ' эпизод';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return n + ' эпизода';
  return n + ' эпизодов';
}

function dropdownButton(menu, text, kind) {
  return '<div class="shikimori-local__action ' + kind + ' selector" role="button" aria-haspopup="listbox" aria-expanded="false" data-action="toggle-' + menu + '">' + escapeHtml(text) + ' ▾</div>';
}

function episodesButton(anime) {
  if (!anime.episodes) return '';
  const watched = anime.user_episodes || 0;
  return '<div class="shikimori-local__action secondary selector" data-action="set-episodes">Эпизоды: ' + escapeHtml(watched + ' / ' + anime.episodes) + '</div>';
}

function statusButtonText(anime) {
  return anime.user_rate_status ? 'Статус: ' + (STATUS_LABELS[anime.user_rate_status] || anime.user_rate_status) : 'Добавить в список';
}

function scoreButtonText(anime) {
  return anime.user_score ? 'Оценка: ' + anime.user_score : 'Оценить';
}

function statusMenu(anime) {
  const items = [
    ['planned', 'В планах'], ['watching', 'Смотрю'], ['completed', 'Просмотрено'], ['on_hold', 'Отложено'], ['dropped', 'Брошено']
  ];
  let html = '<div class="shikimori-local__dropdown" data-menu="status-menu" role="listbox">';
  items.forEach(function (item) {
    const active = anime.user_rate_status === item[0];
    html += '<div class="shikimori-local__dropdown-item selector' + (active ? ' active' : '') + '" aria-selected="' + (active ? 'true' : 'false') + '" data-action="status-' + item[0] + '">' + (active ? '✓ ' : '') + item[1] + '</div>';
  });
  html += '<div class="shikimori-local__dropdown-separator"></div>' +
    '<div class="shikimori-local__dropdown-item destructive selector" data-action="delete-rate">Удалить из списка</div>' +
  '</div>';
  return html;
}

function scoreMenu(anime) {
  let html = '<div class="shikimori-local__dropdown score-grid" data-menu="score-menu" role="listbox">';
  for (let i = 10; i >= 1; i -= 1) {
    const active = Number(anime.user_score) === i;
    html += '<div class="shikimori-local__dropdown-item score selector' + (active ? ' active' : '') + '" aria-selected="' + (active ? 'true' : 'false') + '" data-action="score-' + i + '">' + (active ? '✓ ' : '') + i + '</div>';
  }
  if (anime.user_score) {
    html += '<div class="shikimori-local__dropdown-separator score-separator"></div><div class="shikimori-local__dropdown-item destructive selector" data-action="score-0">Удалить оценку</div>';
  }
  html += '</div>';
  return html;
}

function cleanDescription(text) {
  return String(text || '')
    .replace(/\[br\]/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
      '<div class="shikimori-local__action selector" data-action="export-report">Скачать логи JSON</div>' +
    '</div>' +
  '</div>';
}

function mappingTemplate(anime, candidates) {
  let html = '<div class="shikimori-local mapping-page">' +
    '<div class="shikimori-local__head">Выберите соответствие для ' + escapeHtml(anime.title) + '</div>';
  if (candidates.length === 0) html += '<div class="shikimori-local__empty">Варианты не найдены. Введите TMDB ID вручную.</div>';
  candidates.forEach(function (c, i) {
    html += '<div class="shikimori-local__candidate selector" data-index="' + i + '" data-type="' + c.type + '" data-id="' + c.item.id + '" data-score="' + c.score + '" data-name="' + escapeHtml(c.item.name) + '">' +
      '<img src="' + (c.item.poster_path ? 'https://image.tmdb.org/t/p/w92' + c.item.poster_path : '') + '" />' +
      '<div class="shikimori-local__candidate-info"><div class="shikimori-local__candidate-title">' + escapeHtml(c.item.name) + '</div>' +
      '<div class="shikimori-local__candidate-meta">' + (c.type || '?') + ' · ' + (c.item.year || '?') + ' · score ' + c.score + '</div></div></div>';
  });
  html += '<div class="shikimori-local__manual">' +
    '<label>TMDB ID: <input type="text" class="shikimori-local__manual-id selector" /></label>' +
    '<label>Тип: <select class="shikimori-local__manual-type selector"><option value="tv">TV</option><option value="movie">Movie</option></select></label>' +
    '<label>Сезон: <input type="text" class="shikimori-local__manual-season selector" value="1" /></label>' +
    '<div class="shikimori-local__action selector" data-action="manual-save">Сохранить вручную</div></div></div>';
  return html;
}

function escapeHtml(text) {
  return String(text || '').replace(/[<>"'&]/g, function (m) {
    return { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[m];
  });
}

module.exports = { homeTemplate, animeTemplate, searchTemplate, diagnosticsTemplate, mappingTemplate, escapeHtml, cleanDescription };
