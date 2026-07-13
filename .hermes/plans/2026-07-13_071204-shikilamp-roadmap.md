# ShikiLamp Development Pipeline

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Довести ShikiLamp от рабочего прототипа до стабильного TV-плагина с удобной авторизацией, полезным фильтром, единым UI и предсказуемой связкой Shikimori ↔ Lampa/TMDB.

**Architecture:** Сохраняем текущий CommonJS + esbuild IIFE без новых зависимостей. Сначала фиксируем спецификацию и качество данных, затем авторизацию, фильтр и UI; после каждого этапа — unit/integration smoke, сборка и проверка в реальной Lampa 3.2.8. `dist/plugin.js` и `docs/ShikiLamp.js` публикуются только после прохождения полного quality gate.

**Tech Stack:** JavaScript CommonJS, Lampa 3 API, Shikimori GraphQL/REST, Lampa TMDB/Search API, Jest, JSDOM/Puppeteer smoke, esbuild, GitHub Pages.

---

## Приоритеты

### P0 — стабилизация перед новыми функциями

1. Зафиксировать текущие рабочие сценарии regression-тестами.
2. Убрать разрозненное поведение карточек между главной, каталогом и `Мои списки`.
3. Централизовать TMDB matching/poster hydration, чтобы не запускать лишние запросы из каждого компонента.
4. Добавить экспорт/импорт ручных соответствий.
5. Версионировать cache и storage, чтобы будущие изменения не ломали сохранённые данные.

### P1 — задачи пользователя

1. Доработать фильтр.
2. Упростить авторизацию.
3. Доработать UI: каталоги, разделы, немного карточки.

### P2 — качество продукта

1. Улучшить производительность и ограничить параллельные TMDB-запросы.
2. Добавить управляемую диагностику ошибок и миграций storage.
3. Проверить пульт, long-press, back-stack и scroll во всех разделах.
4. Подготовить понятный onboarding и README.

---

## Этап 0: заморозка поведения и baseline

### Task 1: Записать acceptance matrix

**Objective:** Зафиксировать ожидаемое поведение до новых изменений.

**Files:**
- Create: `docs/ACCEPTANCE.md`

**Сценарии:**
- главная: строки, `Ещё`, правая панель;
- каталог: pagination, Enter, long-press;
- `Мои списки`: tabs, pagination, Enter, long-press;
- Shikimori card: status, score, episodes, delete/re-add;
- mapping: поиск Lampa, сохранение, повторное открытие;
- poster: Shikimori fallback, TMDB replacement, сохранённый mapping;
- диагностика: JSON без секретов.

**Verification:** Документ содержит вход, действие и ожидаемый результат для каждого сценария.

### Task 2: Добавить regression tests для уже исправленных багов

**Objective:** Не вернуть блокировку карточки, потерю `user_id`, ошибку GraphQL shape и потерю mapping poster.

**Files:**
- Modify: `tests/user-api.test.js`
- Modify: `tests/mapping.test.js`
- Modify: `tests/normalizer.test.js`
- Create: `tests/poster-mapping.test.js`

**Tests:**
- create rate содержит `user_id`;
- delete сбрасывает lock;
- `{data:{animes:[]}}` нормализуется;
- mapping сохраняет `poster`;
- старый mapping без poster может быть дополнен;
- token никогда не попадает в report.

**Verification:**
```bash
npm test
```
Expected: все suites passed.

---

## Этап 1: единый data/matching pipeline

### Task 3: Выделить единый каталоговый presenter

**Objective:** Убрать три копии логики карточки из `home.js`, `line.js`, `userlists.js`.

**Files:**
- Create: `src/ui/anime-card.js`
- Modify: `src/components/home.js`
- Modify: `src/components/line.js`
- Modify: `src/components/userlists.js`
- Test: `tests/anime-card.test.js`

**Contract:**
```js
createAnimeCard({
  anime,
  onEnter,
  onLongPress,
  hydratePoster
})
```

Один компонент отвечает за DOM, poster update, Enter, click и contextmenu.

### Task 4: Централизовать TMDB matching queue

**Objective:** При входе в каталог не отправлять десятки одновременных запросов.

**Files:**
- Create: `src/mapping/queue.js`
- Modify: `src/mapping/matcher.js`
- Modify: `src/components/home.js`
- Modify: `src/components/line.js`
- Modify: `src/components/userlists.js`
- Test: `tests/mapping-queue.test.js`

**Rules:**
- максимум 3 параллельных запроса;
- сначала local mapping/cache;
- dedupe по `shikimori_id`;
- poster update только если DOM card ещё существует;
- ошибка одного тайтла не останавливает очередь.

### Task 5: Миграция и резервная копия mappings

**Objective:** Ручные соответствия не должны пропадать при очистке/обновлении.

**Files:**
- Modify: `src/mapping/storage.js`
- Modify: `src/components/diagnostics.js`
- Modify: `src/ui/templates.js`
- Test: `tests/mapping.test.js`

**Features:**
- schema version 2;
- migration v1 → v2;
- export mappings JSON;
- import mappings JSON с validation;
- конфликт: новая запись побеждает только при явном подтверждении.

---

## Этап 2: упрощение авторизации

### Task 6: Реализовать прямой Shikimori OAuth по образцу `ARManakhov/shikimori_plugin`

**Objective:** Рядовой пользователь авторизуется через QR и вставляет короткий authorization code, не добывая access token вручную.

**Accepted trade-off:** По явному решению владельца проекта OAuth `client_id` и `client_secret` встраиваются в публичный bundle. Это позволяет обойтись без backend/Worker, но credentials приложения будут публичными. Риск принят для проекта с доступом только к Shikimori-профилю, спискам, статусам, оценкам и эпизодам.

**Files:**
- Modify: `src/config.js`
- Modify: `src/settings.js`
- Modify: `src/auth.js`
- Modify: `src/api/client.js`
- Modify: `src/ui/templates.js`
- Modify: `src/ui/styles.js`
- Create: `docs/AUTH.md`
- Create: `tests/auth.test.js`

**User flow:**
1. Пользователь нажимает `Войти через Shikimori`.
2. Lampa показывает QR-код и ссылку на `/oauth/authorize`.
3. Пользователь входит и подтверждает доступ на телефоне.
4. Shikimori показывает authorization code для OOB redirect.
5. Пользователь вводит этот code в одно поле Lampa.
6. Плагин напрямую вызывает `/oauth/token`.
7. Плагин сохраняет access token, refresh token, `created_at`, `expires_in` и автоматически вызывает `/api/users/whoami`.
8. После истечения access token плагин автоматически выполняет refresh и атомарно сохраняет новую пару tokens.

**OAuth parameters:**
```txt
redirect_uri=urn:ietf:wg:oauth:2.0:oob
response_type=code
scope=user_rates
```

**Required behavior:**
- QR генерировать локально, без стороннего QR API;
- authorization URL показывать текстом как fallback;
- один экран: QR, инструкция, поле code, `Подключить`, `Отмена`;
- после успеха показывать nickname/id;
- `Выйти` очищает access/refresh/user/expiry, но не mappings и настройки UI;
- refresh запускать до API-запроса, если token истёк;
- при refresh сохранять новую пару tokens атомарно;
- 401 после refresh переводит auth в `expired` и предлагает повторный вход;
- ручной access token оставить только в скрытом developer mode.

**Still required despite accepted public secret:**
- не печатать access/refresh token в logger/diagnostics;
- не помещать tokens и authorization code в URL;
- не коммитить пользовательские tokens;
- redaction audit bundle/log/report;
- QR URL содержит только публичные OAuth application credentials и redirect parameters.

**Verification:**
- QR ведёт на правильный authorization URL;
- реальный authorization code обменивается на token;
- `whoami` возвращает пользователя;
- restart Lampa сохраняет вход;
- искусственно истёкший access token обновляется через refresh token;
- после refresh используется новая пара;
- logout очищает auth-state;
- report содержит только `token_present`, без значений.

**Reference only:**
- `https://github.com/ARManakhov/shikimori_plugin`
- не копировать GPL-код; реализовать независимо.

### Task 7: Нормализовать auth-state

**Objective:** Убрать случаи token есть, user отсутствует.

**Files:**
- Modify: `src/auth.js`
- Modify: `src/api/client.js`
- Modify: `src/components/userlists.js`
- Test: `tests/auth.test.js`

**States:**
```txt
anonymous
checking
authorized
expired
error
```

**Verification:** restart Lampa сохраняет authorized state; 401 переводит в expired; повторный token восстанавливает user.

---

## Этап 3: фильтр

### Task 8: Утвердить минимальную модель фильтра

**Objective:** Добавить полезный фильтр без перегруженного конструктора запросов.

**Files:**
- Create: `src/filter/model.js`
- Test: `tests/filter.test.js`

**MVP fields:**
- статус релиза: ongoing/released/upcoming;
- тип: tv/movie/ova/ona/special;
- жанры: include/exclude;
- год: from/to;
- минимальный Shikimori score;
- порядок: popularity/ranked/aired_on/name;
- adult content: скрыт по умолчанию.

**Not now:** studio, duration ranges, franchise graph, arbitrary GraphQL builder.

### Task 9: Реализовать query translation

**Objective:** Один filter state формирует GraphQL variables и REST fallback params.

**Files:**
- Create: `src/filter/query.js`
- Modify: `src/api/graphql.js`
- Modify: `src/api/index.js`
- Test: `tests/filter.test.js`

**Verification:** одинаковый filter state даёт сопоставимый GraphQL/REST результат; пустые значения не отправляются.

### Task 10: Реализовать правую панель фильтра

**Objective:** Панель открывается с правой границы только на главной/каталоге и работает пультом.

**Files:**
- Create: `src/components/filter.js`
- Modify: `src/components/home.js`
- Modify: `src/components/line.js`
- Modify: `src/components/lifecycle.js`
- Modify: `src/ui/templates.js`
- Modify: `src/ui/styles.js`

**UX:**
- hidden by default;
- right at last card opens panel;
- Apply, Reset, Close;
- active filter count visible;
- state persists in `Lampa.Storage`;
- нет панели в `Мои списки`.

**Verification:** keyboard/remote matrix: right, left, up/down, Enter, Back; after Apply focus returns to first result.

---

## Этап 4: UI каталога и разделов

### Task 11: Унифицировать каталоговые layouts

**Objective:** Главная, полный каталог и `Мои списки` выглядят и управляются одинаково.

**Files:**
- Modify: `src/ui/styles.js`
- Modify: `src/ui/templates.js`
- Modify: `src/components/home.js`
- Modify: `src/components/line.js`
- Modify: `src/components/userlists.js`

**Changes:**
- одинаковый aspect ratio и fallback poster;
- skeleton вместо скачков layout;
- единый title/meta block;
- индикатор статуса пользователя на карточке;
- lazy poster replacement без потери focus;
- заметный `Ещё`, но не похожий на anime card.

### Task 12: Пересобрать разделы главной

**Objective:** Сделать разделы понятными и не дублирующимися.

**Предлагаемый порядок:**
1. Недавно вышедшие.
2. Онгоинги.
3. Запланировано.
4. Популярное.
5. Высокий рейтинг.
6. Мои списки — отдельный entry, не строка каталога.

**Files:**
- Modify: `src/components/home.js`
- Modify: `src/api/graphql.js`
- Modify: `src/ui/templates.js`

### Task 13: Лёгкая доработка detail card

**Objective:** Не ломать рабочее управление, улучшить ясность.

**Files:**
- Modify: `src/components/anime.js`
- Modify: `src/ui/templates.js`
- Modify: `src/ui/styles.js`

**Changes:**
- status остаётся dropdown;
- score/episodes остаются ↑/↓;
- current mapping/source показывается мелкой строкой;
- `Найти в Lampa` явно подписать как изменение соответствия;
- poster сохраняет верхнее выравнивание;
- error/noty тексты единообразны.

---

## Этап 5: UX надёжность

### Task 14: Проверить навигацию и lifecycle

**Objective:** Устранить double-back, dead focus и разные long-press handlers.

**Files:**
- Modify: `src/components/lifecycle.js`
- Modify: `src/ui/anime-card.js`
- Modify: components по результатам теста
- Create: `scripts/navigation-smoke.js`

**Scenarios:**
- home → catalog → card → back;
- home → userlists → status tab → card → back;
- long-press во всех каталогах;
- filter open/apply/back;
- delete/re-add without reopening card;
- scroll to page 3 and return focus.

### Task 15: Ошибки, offline и retry

**Objective:** Плагин остаётся понятным при Shikimori/TMDB outage.

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/logger.js`
- Modify: `src/components/diagnostics.js`
- Modify: `src/mapping/matcher.js`

**Rules:**
- cached data показывается при network error;
- TMDB failure не ломает Shikimori cards;
- retry только для 0/408/429/5xx;
- no retry для validation/401/403/404;
- лог содержит endpoint class/status, но не token/query secrets.

---

## Этап 6: release pipeline

### Task 16: Автоматизировать build artifact sync

**Objective:** Исключить ручное забывание `docs/ShikiLamp.js`.

**Files:**
- Modify: `build.js`
- Modify: `package.json`

**Commands:**
```bash
npm run build
npm run verify
```

`build` должен собирать `dist/plugin.js` и атомарно копировать его в `docs/ShikiLamp.js`.

### Task 17: Один quality gate перед push

**Objective:** Публиковать только реально проверенный bundle.

**Files:**
- Create: `scripts/verify.js`
- Modify: `package.json`

**Gate:**
```bash
npm test
npm run build
node --check dist/plugin.js
node scripts/integration-smoke.js
node scripts/browser-check.js
```

Проверки bundle:
- browser IIFE;
- нет `import`/`export`;
- нет token/client_secret;
- `docs/ShikiLamp.js` byte-identical `dist/plugin.js`;
- menu/component registration существует.

### Task 18: Release checklist

**Objective:** Сделать выпуск воспроизводимым.

**Files:**
- Create: `docs/RELEASE.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Checklist:**
1. пройти acceptance matrix;
2. `npm run verify`;
3. version bump;
4. changelog;
5. commit/push;
6. проверить GitHub Pages с cache-busting query;
7. проверить реальную Lampa 3.2.8;
8. при регрессии откатить на предыдущий bundle.

---

## Рекомендуемый порядок спринтов

### Sprint 1 — фундамент
- Tasks 1–5.
- Результат: regression safety, единые карточки, надёжные mappings/posters.

### Sprint 2 — авторизация
- Tasks 6–7.
- Результат: один понятный flow подключения Shikimori.

### Sprint 3 — фильтр
- Tasks 8–10.
- Результат: рабочий фильтр с правой панелью и сохранением состояния.

### Sprint 4 — UI
- Tasks 11–13.
- Результат: согласованные каталоги, разделы и detail card.

### Sprint 5 — hardening/release
- Tasks 14–18.
- Результат: навигационный smoke, offline behavior, автоматическая публикация.

---

## Главные риски

1. **TMDB request storm:** поиск всего каталога без очереди даст лаги/rate limits. Сначала Task 4.
2. **Lampa API нестабилен:** `Search`, `Input`, `Controller` и discovery source contracts нужно проверять на 3.2.8, не только mock.
3. **Auth UX:** полноценный OAuth без безопасного backend нельзя внедрять в статический plugin. MVP — безопасный token onboarding; OAuth только через отдельный сервер позже.
4. **Storage loss:** local mappings исчезнут при очистке Lampa. Export/import обязателен до большой ручной разметки.
5. **UI drift:** нельзя отдельно править три каталога. Сначала единый presenter.
6. **GitHub Pages cache:** verification всегда делать с `?v=<commit-or-timestamp>`.

## Что сознательно не делаем сейчас

- новый framework;
- собственный backend только ради фильтра/UI;
- прямые интеграции с неофициальными медиакаталогами;
- сложный recommendation engine;
- синхронизацию mappings между устройствами до export/import;
- массовый редизайн до стабилизации навигации.

## Definition of Done

- `npm run verify` проходит;
- acceptance matrix пройдена в Lampa 3.2.8;
- filter работает пультом и сохраняется;
- auth подключается одним flow, token не утекает;
- главная, каталог и `Мои списки` используют единое поведение карточки;
- posters подменяются из cache/mapping/TMDB без request storm;
- mappings можно экспортировать и восстановить;
- опубликованный GitHub Pages bundle совпадает с локальным `dist/plugin.js`.
