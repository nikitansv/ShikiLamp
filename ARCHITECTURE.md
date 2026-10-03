# Архитектура ShikiLamp

ShikiLamp — клиентский плагин Lampa 3. Backend отсутствует: интерфейс, сетевые запросы и OAuth выполняются на устройстве пользователя.

## Поток данных

```text
Lampa UI
  ├─ src/components/*, src/ui/*
  ├─ src/api/index.js ── GraphQL / REST ── Shikimori
  ├─ src/api/user.js ─── user_rates API ─ Shikimori
  └─ src/mapping/* ──── Lampa.Api.search ─ TMDB-кандидаты
       └─ Lampa.Storage: настройки, токены, кэш и mappings
```

`src/index.js` ждёт готовности Lampa, затем однократно регистрирует компоненты и настройки. `src/api/client.js` обслуживает очередь, повторы, отмену и авторизацию. Ревизия сессии отсекает ответы и отложенные записи прежнего аккаунта. Авторизованные ответы не попадают в публичный кэш. `src/api/normalizer.js` приводит ответы к общей форме, `src/cache.js` хранит ограниченный TTL-кэш.

`src/mapping/` сохраняет соответствия Shikimori ↔ TMDB. Очередь допускает до трёх одновременно ожидаемых TMDB-запросов; одинаковые запросы объединяются, ожидание отдельного ответа ограничено 12 секундами. Если API Lampa не позволяет отменить запрос, истечение ожидания не отменяет его на транспортном уровне. Порог соответствия применяется к кэшированным кандидатам заново, поэтому настройка действует сразу.

Каталог и карточки используют Shikimori GraphQL (`/api/graphql`) и REST (`/api/animes`). Авторизованные функции используют `/api/users/...`, `/api/v2/user_rates` и запросы списка аниме. Сопоставление ищет кандидатов через `Lampa.Api.search`, затем открывает стандартную карточку Lampa.

## OAuth и локальные данные

Авторизация реализована непосредственно в плагине: authorization code обменивается на токены, access token обновляется через refresh token. Предусмотрен также ручной ввод access token. Токены и OAuth client credentials хранятся в `Lampa.Storage`; client secret также входит в клиентский код. Его нельзя считать конфиденциальным. Backend-посредника нет, поэтому данная схема не обеспечивает серверную защиту OAuth credentials.

В локальном хранилище также находятся настройки, пользовательские mappings, фильтр и кэш. Импорт mappings дополняет сохранённые данные; конфликты пропускаются с отчётом о числе записей. Повреждённый импорт и ошибки записи показываются пользователю. Телеметрии в архитектуре не предусмотрено.

## Среда и ограничения

- Плагин обращается к Shikimori непосредственно из WebView Lampa. Доступность зависит от CORS, сети и реализации WebView.
- HTTPS-страница не может загружать HTTP-плагин/API из-за политики mixed content.
- TMDB-поиск зависит от внутреннего `Lampa.Api.search`.
- Jest и визуальные сценарии выполняются с mock Lampa/браузерным окружением; они не гарантируют совместимость с конкретной прошивкой телевизора, WebView или пультом.
- OAuth credentials в клиенте не подходят для модели, где client secret должен оставаться закрытым. Перенос OAuth на backend отложен.

## Разработка и проверки

Требуется Node.js 22.12+ из-за Puppeteer 25. Основные исходники: `src/`; unit-тесты: `tests/`; браузерные сценарии: `scripts/`.

```bash
npm test
npm run check
npm run test:visual
```

`check` выполняет согласованный набор проверок синтаксиса, тестов, сборки и артефактов. `test:visual` проверяет интерфейс в браузерном mock. Сборка `npm run build` формирует browser IIFE и записывает `dist/plugin.js` и `docs/ShikiLamp.js`.

Результаты mock-проверок не равны приёмке на устройстве: запуск в Lampa на целевом телевизоре остаётся отдельной проверкой.

Контракты сверены с исходниками Lampa: [готовность приложения](https://github.com/yumata/lampa-source/blob/master/src/app.js), [поиск TMDB](https://github.com/yumata/lampa-source/blob/master/src/core/api/api.js), [SettingsApi](https://github.com/yumata/lampa-source/blob/master/src/interaction/settings/api.js), [подписки на события](https://github.com/yumata/lampa-source/blob/master/src/utils/subscribe.js).
