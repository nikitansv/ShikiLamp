/**
 * Settings registration for Lampa SettingsApi.
 */
const config = require('./config');
const logger = require('./logger');
const cache = require('./cache');
const mappingStorage = require('./mapping/storage');
const auth = require('./auth');
const authUi = require('./ui/auth');
const styles = require('./ui/styles');

const COMPONENT = 'shikilamp_local_settings';
const DEVELOPER_COMPONENT = 'shikilamp_local_developer';
const LEGACY_COMPONENT = 'shikimori_local';
let accountItem;
const SETTINGS_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function get(key, defaultValue) {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    return Lampa.Storage.get(config.STORAGE_KEYS[key], defaultValue);
  }
  return defaultValue;
}

function set(key, value) {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    Lampa.Storage.set(config.STORAGE_KEYS[key], value);
  }
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function isEnabled() {
  return bool(get('enabled', config.DEFAULTS.enabled));
}

function isDebug() {
  return bool(get('debug', config.DEFAULTS.debug));
}

function showMenu() {
  return bool(get('showMenu', config.DEFAULTS.showMenu));
}

function getLanguage() {
  return get('language', config.DEFAULTS.language);
}

function getApiBaseUrl() {
  return get('apiBaseUrl', config.DEFAULTS.apiBaseUrl);
}

function getPageSize() {
  const n = parseInt(get('pageSize', config.DEFAULTS.pageSize), 10);
  return isNaN(n) ? config.DEFAULTS.pageSize : Math.min(Math.max(n, 5), 50);
}

function getMappingThreshold() {
  const n = parseFloat(get('mappingThreshold', config.DEFAULTS.mappingThreshold));
  return isNaN(n) ? config.DEFAULTS.mappingThreshold : Math.min(Math.max(n, 0.5), 1.0);
}

function isExperimentalEnabled() {
  return bool(get('experimentalFeatures', false));
}

function getExperimentalToken() {
  return get('experimentalToken', '');
}

function getUi() {
  const value = get('ui', {});
  const ui = value && typeof value === 'object' ? value : {};
  return Object.assign({}, ui, { motion: get('motion', ui.motion || 'normal') });
}

function cleanupLegacySettings() {
  try {
    if (Lampa.SettingsApi.removeParams) {
      Lampa.SettingsApi.removeParams(LEGACY_COMPONENT);
      Lampa.SettingsApi.removeParams(COMPONENT);
      Lampa.SettingsApi.removeParams(DEVELOPER_COMPONENT);
    }
    if (Lampa.SettingsApi.removeComponent) {
      Lampa.SettingsApi.removeComponent(LEGACY_COMPONENT);
      Lampa.SettingsApi.removeComponent(COMPONENT);
      Lampa.SettingsApi.removeComponent(DEVELOPER_COMPONENT);
    }
  } catch (e) {
    logger.warn('Legacy settings cleanup failed', e.message);
  }
}

function register() {
  if (typeof Lampa === 'undefined' || !Lampa.SettingsApi) return;

  cleanupLegacySettings();

  Lampa.SettingsApi.addComponent({
    component: COMPONENT,
    icon: SETTINGS_ICON,
    name: 'ShikiLamp'
  });
  styles.applyUiSettings(getUi());

  addTitle('account', 'Аккаунт');
  addAction('account', 'Аккаунт Shikimori', openAccount, auth.statusText(), function (item) {
    accountItem = item;
    refreshAccount();
  });

  addTitle('catalog', 'Каталог и интерфейс');
  // One visibility switch preserves the effective state of the two old switches.
  if (!showMenu()) { set('enabled', false); set('showMenu', true); }
  addTrigger('enabled', 'Показывать Shikimori в меню', config.DEFAULTS.enabled);
  addSelect('language', 'Язык названий', [
    { title: 'Русский', code: 'russian' },
    { title: 'English', code: 'english' }
  ], config.DEFAULTS.language);
  const pageSizes = [10, 20, 30, 50];
  if (pageSizes.indexOf(getPageSize()) < 0) pageSizes.push(getPageSize());
  addSelect('pageSize', 'Тайтлов на странице', pageSizes.sort(function (a, b) { return a - b; }).map(function (n) {
    return { title: String(n), code: String(n) };
  }), config.DEFAULTS.pageSize);
  addSelect('motion', 'Плавность переходов', [
    { title: 'Обычная', code: 'normal' }, { title: 'Мягкая', code: 'soft' },
    { title: 'Быстрая', code: 'fast' }, { title: 'Без анимаций', code: 'off' }
  ], getUi().motion);
  addAction('resetAppearance', 'Сбросить оформление', function () {
    set('motion', getUi().motion);
    set('ui', {});
    styles.applyUiSettings(getUi());
    Lampa.Noty.show('ShikiLamp: восстановлено стандартное оформление');
  }, 'Стандартные размеры и цвета. Плавность переходов сохранится.');

  addTitle('maintenance', 'Данные и помощь');
  addAction('diagnostics', 'Проверить соединение', function () {
    openScreen('shikimori_local_diagnostics', 'Диагностика Shikimori');
  });
  addAction('clearCache', 'Очистить API-кэш', function () {
    cache.clear();
    Lampa.Noty.show('API-кэш плагина Shikimori очищен');
  }, 'Авторизация, списки и сопоставления сохранятся.');

  addAction('mappings', 'Сопоставления с TMDB', function () {
    openScreen('shikimori_local_mappings', 'Сопоставления с TMDB');
  });

  addAction('exportMappings', 'Экспортировать сопоставления', function () {
    const json = mappingStorage.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shikimori-local-mappings.json';
    a.click();
    URL.revokeObjectURL(url);
    Lampa.Noty.show('Сопоставления экспортированы');
  });

  addAction('importMappings', 'Импортировать сопоставления', function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function () {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = function () {
        const result = mappingStorage.importJson(reader.result);
        Lampa.Noty.show(result.success ? 'Импортировано: ' + result.count + ', сохранено прежних: ' + result.skipped : 'Ошибка импорта: ' + result.error);
      };
      reader.onerror = function () { Lampa.Noty.show('Не удалось прочитать файл сопоставлений'); };
      reader.readAsText(input.files[0]);
    };
    input.click();
  });

}

function openScreen(component, title) {
  Lampa.Controller.toggle('settings');
  Lampa.Controller.toggle('content');
  Lampa.Activity.push({ url: '', title: title, component: component });
}

function addTitle(name, title) {
  Lampa.SettingsApi.addParam({ component: COMPONENT, param: { name: 'shikimori_local_section_' + name, type: 'title' }, field: { name: title } });
}

function addTrigger(name, title, defaultValue) {
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: config.STORAGE_KEYS[name], type: 'trigger', default: defaultValue },
    field: { name: title },
    onChange: function (value) { onSettingChange({ name: config.STORAGE_KEYS[name], value: value }); }
  });
}

function addSelect(name, title, values, defaultValue) {
  const map = {};
  values.forEach(function (v) { map[v.code] = v.title; });
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: config.STORAGE_KEYS[name], type: 'select', values: map, default: defaultValue },
    field: { name: title },
    onChange: function (value) { onSettingChange({ name: config.STORAGE_KEYS[name], value: value }); }
  });
}

function addAction(name, title, onSelect, description, onRender) {
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: 'shikimori_local_action_' + name, type: 'button' },
    field: { name: title, description: description },
    onChange: onSelect,
    onRender: onRender
  });
}

function refreshAccount() {
  if (accountItem) accountItem.find('.settings-param__descr').text(auth.statusText());
}

function openAccount() {
  const previous = Lampa.Controller.enabled().name;
  const items = [
    { title: 'Войти через Shikimori', action: openOAuthAuthorization },
    { title: 'Ввести полученный код', action: askAuthorizationCode },
    { title: 'Войти по access token', action: askToken }
  ];
  if (auth.getToken()) {
    items.push({ title: 'Проверить вход', action: checkAuth });
    items.push({ title: 'Выйти из аккаунта', action: function () {
      auth.clearToken();
      refreshAccount();
      Lampa.Noty.show('ShikiLamp: выполнен выход');
    } });
  }
  // Lampa hides the select before calling onBack/onSelect; close() here would recurse.
  function restore() { Lampa.Controller.toggle(previous); }
  Lampa.Select.show({ title: 'Аккаунт Shikimori', items: items, onBack: restore, onSelect: function (item) { restore(); item.action(); } });
}

function askSettingValue(title, currentValue, onSave) {
  const save = function (value) {
    if (value === null || value === undefined) return;
    onSave(value);
  };

  if (Lampa.Input && Lampa.Input.edit) {
    Lampa.Input.edit({
      title: title,
      value: String(currentValue || ''),
      free: true
    }, save);
    return;
  }

  save(prompt(title, String(currentValue || '')));
}

function openOAuthAuthorization() {
  let url;
  try {
    url = auth.buildAuthorizationUrl();
  } catch (err) {
    Lampa.Noty.show('ShikiLamp: сначала настройте OAuth приложение');
    return;
  }
  authUi.open({
    url: url,
    onCode: askAuthorizationCode
  });
}

function askAuthorizationCode() {
  askSettingValue('Код авторизации Shikimori', '', function (code) {
    code = String(code || '').trim();
    if (!code) {
      Lampa.Noty.show('ShikiLamp: код пустой');
      return;
    }
    Lampa.Noty.show('ShikiLamp: выполняю вход...');
    auth.exchangeCode(code).then(function (user) {
      refreshAccount();
      Lampa.Noty.show('ShikiLamp: вход выполнен как ' + (user.nickname || user.name || ('ID ' + user.id)));
    }).catch(function (err) {
      Lampa.Noty.show('ShikiLamp: ошибка OAuth — ' + err.message);
    });
  });
}

function askToken() {
  const current = auth.getToken();
  const save = function (value) {
    if (value === null || value === undefined) return;
    const token = String(value || '').trim();
    if (!token) {
      Lampa.Noty.show('ShikiLamp: пустой токен не сохранён');
      return;
    }
    auth.setToken(token);
    refreshAccount();
    Lampa.Noty.show('ShikiLamp: токен сохранён локально');
  };

  if (Lampa.Input && Lampa.Input.edit) {
    Lampa.Input.edit({
      title: 'Access token Shikimori',
      value: current,
      free: true
    }, save);
    return;
  }

  save(prompt('Access token Shikimori', current));
}

function checkAuth() {
  Lampa.Noty.show('ShikiLamp: проверяю вход...');
  auth.check().then(function (user) {
    refreshAccount();
    Lampa.Noty.show('ShikiLamp: вход выполнен как ' + (user.nickname || user.name || ('ID ' + user.id)));
  }).catch(function (err) {
    Lampa.Noty.show('ShikiLamp: ошибка входа — ' + err.message);
  });
}

function onSettingChange(e) {
  if (!e) return;
  if (e.name === config.STORAGE_KEYS.motion) styles.applyUiSettings(getUi());
  if (e.name === config.STORAGE_KEYS.debug) {
    logger.setDebug(bool(e.value));
  }
  if (e.name === config.STORAGE_KEYS.showMenu || e.name === config.STORAGE_KEYS.enabled) require('./ui/menu').register();
}

module.exports = {
  register,
  isEnabled,
  isDebug,
  showMenu,
  getLanguage,
  getApiBaseUrl,
  getPageSize,
  getMappingThreshold,
  isExperimentalEnabled,
  getExperimentalToken,
  getUi,
  get,
  set
};
