# Архитектурный отчёт: lampa-shikimori-local v0.1.0

## Цель MVP

Добавить в Lampa 3 отдельный раздел Shikimori с поиском, каталогом, карточкой аниме, локальным mapping на TMDB и диагностикой — без облачного backend, без OAuth и без секретов в коде.

## Проверенные endpoint Shikimori

| Endpoint | Метод | Результат |
|----------|-------|-----------|
| `https://shikimori.io/api/graphql` | POST introspection | ✅ 200, схема доступна |
| `https://shikimori.io/api/graphql` `animes(search:, limit:)` | POST | ✅ работает |
| `https://shikimori.io/api/graphql` `animes(ids:)` | POST | ✅ работает |
| `https://shikimori.io/api/graphql` `animes(order: popularity, status: ...)` | POST | ✅ работает |
| `https://shikimori.io/api/animes/...` | REST | ✅ 301 на shikimori.io, затем работает |

Важные поля GraphQL Anime: `id`, `name`, `russian`, `english`, `synonyms`, `kind`, `score`, `status`, `episodes`, `episodesAired`, `duration`, `rating`, `url`, `malId`, `description`, `descriptionHtml`, `descriptionSource`, `airedOn`, `releasedOn`, `nextEpisodeAt`, `poster { originalUrl mainUrl mainAltUrl }`, `genres`, `studios`, `externalLinks`.

## CORS и User-Agent

- Preflight OPTIONS на `/api/graphql` возвращает `access-control-allow-origin: *`, `access-control-allow-methods: GET, OPTIONS, POST, PUT, PATCH, DELETE`, `access-control-allow-headers: Content-Type`.
- Прямой browser-запрос (fetch/XMLHttpRequest) должен работать, если Lampa открыта по HTTP или HTTPS-источник разрешён.
- **Mixed content:** если Lampa открыта по HTTPS, а плагин или API Base URL указывает на HTTP, браузер заблокирует запрос.
- **User-Agent:** из браузера нельзя переопределить User-Agent; API пока не блокирует стандартные браузерные UA.
- Рекомендация: размещать плагин и API Base URL по HTTPS или на том же протоколе, что и Lampa.

## Использованные API Lampa 3

| Назначение | API | Статус |
|------------|-----|--------|
| Глобальный namespace | `window.Lampa` | стабильный |
| Готовность приложения | `window.appready`, событие `app/ready` | стабильный |
| Меню | DOM `.menu__list` + `Lampa.Listener.send('menu', ...)` | внутренний, зависит от темы |
| Компоненты | `Lampa.Component.add(name, Class)` | стабильный |
| Навигация | `Lampa.Activity.push({ component, title, ... })` | стабильный |
| Фокус пульта | `Lampa.Controller.collectionSet`, `collectionFocus` | стабильный |
| Настройки | `Lampa.SettingsApi.addComponent/addParam` | стабильный |
| Хранилище | `Lampa.Storage.get/set` | стабильный |
| Сеть | `Lampa.Reguest` / `Lampa.Network` | стабильный |
| TMDB поиск | `Lampa.Api.search` | внутренний |
| Открытие карточки | `Lampa.Router.call('full', card)` | стабильный |
| Уведомления | `Lampa.Noty.show` | стабильный |
| Maker/ContentRows | `Lampa.Maker`, `Lampa.ContentRows` | используется только в диагностике |

## Архитектура плагина

```text
src/
  index.js          — инициализация, регистрация компонентов, меню
  config.js         — константы, ключи Lampa.Storage, TTL
  settings.js       — раздел настроек через Lampa.SettingsApi
  logger.js         — логирование без утечки токенов
  cache.js          — TTL-кэш поверх Lampa.Storage
  api/
    client.js       — HTTP-клиент с queue/retry/cancel, fallback на fetch
    graphql.js      — GraphQL queries
    normalizer.js   — нормализация ответов Shikimori
    index.js        — high-level adapter для UI
  mapping/
    storage.js      — локальное хранилище mapping
    scoring.js      — similarity + confidence
    matcher.js      — поиск лучшего соответствия + открытие Lampa карточки
  components/
    home.js         — главный экран
    search.js       — поиск
    line.js         — популярное/онгоинги/новинки/анонсы
    anime.js        — карточка аниме
    mapping.js      — ручной выбор/сохранение mapping
    mappings.js     — список сохранённых mapping
    diagnostics.js  — диагностика
  ui/
    menu.js         — пункт в меню Lampa
    cards.js        — helpers карточек
    templates.js    — HTML-шаблоны
    styles.js       — CSS
```

## Сборка

- `npm run build` — esbuild bundling в IIFE, uglify-js без минификации (только форматирование).
- Итоговый `dist/plugin.js` — один browser-ready файл без `import`/`export`.

## Проверки

```text
npm test        → 4 suites, 12 tests passed
npm run build   → dist/plugin.js 63 KB
node --check dist/plugin.js → OK
grep secrets    → no matches
grep eval/new Function/document.write → no matches
grep import/export at top → no matches
```

## Ограничения первой версии

- Нет автоматической синхронизации просмотра.
- Нет OAuth — только экспериментальный токен, выключенный по умолчанию.
- Автоматический mapping зависит от `Lampa.Api.search`; если TMDB недоступен, только ручной ввод.
- Возможны проблемы CORS / mixed content в некоторых WebView.

## Следующие шаги

1. Реальный запуск в Lampa через LAN URL.
2. Проверка управления пультом и фокуса.
3. Доработка UI на основе Lampa.Maker/ContentRows при наличии стабильных примеров.
4. Подготовка локального LAN-proxy для CORS/User-Agent при необходимости.
5. OAuth-авторизация через пользовательский backend.
