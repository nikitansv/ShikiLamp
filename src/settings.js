/**
 * Settings registration for Lampa SettingsApi.
 */
const config = require('./config');
const logger = require('./logger');
const cache = require('./cache');
const mappingStorage = require('./mapping/storage');
const auth = require('./auth');

const COMPONENT = 'shikilamp_local_settings';
const LEGACY_COMPONENT = 'shikimori_local';

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

function cleanupLegacySettings() {
  try {
    if (Lampa.SettingsApi.removeParams) {
      Lampa.SettingsApi.removeParams(LEGACY_COMPONENT);
      Lampa.SettingsApi.removeParams(COMPONENT);
    }
    if (Lampa.SettingsApi.removeComponent) {
      Lampa.SettingsApi.removeComponent(LEGACY_COMPONENT);
      Lampa.SettingsApi.removeComponent(COMPONENT);
    }
  } catch (e) {
    logger.warn('Legacy settings cleanup failed', e.message);
  }
}

function register() {
  if (!Lampa || !Lampa.SettingsApi) return;

  cleanupLegacySettings();

  Lampa.SettingsApi.addComponent({
    component: COMPONENT,
    name: 'ShikiLamp Local'
  });

  addTrigger('enabled', 'Включить плагин', config.DEFAULTS.enabled);
  addAction('apiBaseUrl', 'API Base URL: ' + getApiBaseUrl(), function () {
    askSettingValue('apiBaseUrl', 'API Base URL', getApiBaseUrl(), function (value) {
      const url = String(value || '').trim().replace(/\/$/, '');
      if (!/^https?:\/\//i.test(url)) {
        Lampa.Noty.show('ShikiLamp: URL должен начинаться с http:// или https://');
        return;
      }
      set('apiBaseUrl', url);
      Lampa.Noty.show('ShikiLamp: API Base URL сохранён');
    });
  });
  addSelect('language', 'Язык результатов', [
    { title: 'Русский', code: 'russian' },
    { title: 'English', code: 'english' }
  ], config.DEFAULTS.language);
  addTrigger('showMenu', 'Показывать кнопку в меню', config.DEFAULTS.showMenu);
  addAction('pageSize', 'Число результатов: ' + getPageSize(), function () {
    askSettingValue('pageSize', 'Число результатов на страницу', String(getPageSize()), function (value) {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 5 || n > 50) {
        Lampa.Noty.show('ShikiLamp: число должно быть от 5 до 50');
        return;
      }
      set('pageSize', String(n));
      Lampa.Noty.show('ShikiLamp: число результатов сохранено');
    });
  });
  addAction('mappingThreshold', 'Порог mapping: ' + getMappingThreshold(), function () {
    askSettingValue('mappingThreshold', 'Порог mapping 0.5–1.0', String(getMappingThreshold()), function (value) {
      const n = parseFloat(value);
      if (isNaN(n) || n < 0.5 || n > 1.0) {
        Lampa.Noty.show('ShikiLamp: порог должен быть 0.5–1.0');
        return;
      }
      set('mappingThreshold', String(n));
      Lampa.Noty.show('ShikiLamp: порог mapping сохранён');
    });
  });
  addTrigger('autoOpenExact', 'Автоматически открывать точное соответствие', config.DEFAULTS.autoOpenExact);
  addTrigger('debug', 'Показывать диагностические сообщения', config.DEFAULTS.debug);

  addAction('clearCache', 'Очистить API-кэш', function () {
    cache.clear();
    Lampa.Noty.show('API-кэш плагина Shikimori очищен');
  });

  addAction('clearMappings', 'Очистить mapping', function () {
    mappingStorage.clear();
    Lampa.Noty.show('Mapping плагина Shikimori очищен');
  });

  addAction('exportMappings', 'Экспортировать mapping', function () {
    const json = mappingStorage.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shikimori-local-mappings.json';
    a.click();
    URL.revokeObjectURL(url);
    Lampa.Noty.show('Mapping экспортирован');
  });

  addAction('importMappings', 'Импортировать mapping', function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function () {
      if (!input.files || !input.files[0]) return;
      const reader = new FileReader();
      reader.onload = function () {
        const result = mappingStorage.importJson(reader.result);
        Lampa.Noty.show(result.success ? 'Импортировано mapping: ' + result.count : 'Ошибка импорта: ' + result.error);
      };
      reader.readAsText(input.files[0]);
    };
    input.click();
  });

  addAction('authStatus', 'Авторизация: ' + auth.statusText(), function () {
    showAuthInfo();
  });

  addAction('oauthCredentials', 'Настроить OAuth приложение', function () {
    askOAuthCredentials();
  });

  addAction('oauthAuthorize', 'Войти через Shikimori', function () {
    openOAuthAuthorization();
  });

  addAction('oauthCode', 'Ввести код авторизации', function () {
    askAuthorizationCode();
  });

  addAction('authToken', 'Режим разработчика: access token', function () {
    askToken();
  });

  addAction('authCheck', 'Проверить вход Shikimori', function () {
    checkAuth();
  });

  addAction('authLogout', 'Выйти из Shikimori', function () {
    auth.clearToken();
    Lampa.Noty.show('ShikiLamp: авторизация удалена');
  });
}

function addTrigger(name, title, defaultValue) {
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: config.STORAGE_KEYS[name], type: 'trigger', default: defaultValue },
    field: { name: title },
    onChange: onSettingChange
  });
}

function addSelect(name, title, values, defaultValue) {
  const map = {};
  values.forEach(function (v) { map[v.code] = v.title; });
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: config.STORAGE_KEYS[name], type: 'select', values: map, default: defaultValue },
    field: { name: title },
    onChange: onSettingChange
  });
}

function addAction(name, title, onSelect) {
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: 'shikimori_local_action_' + name, type: 'button' },
    field: { name: title },
    onChange: onSelect
  });
}

function askSettingValue(name, title, currentValue, onSave) {
  const save = function (value) {
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

function showAuthInfo() {
  const user = auth.getCachedUser();
  if (user && (user.nickname || user.name || user.id)) {
    Lampa.Noty.show('ShikiLamp: вход выполнен как ' + (user.nickname || user.name || ('ID ' + user.id)));
    return;
  }
  if (auth.getToken()) {
    Lampa.Noty.show('ShikiLamp: токен введён, нажмите «Проверить вход Shikimori»');
    return;
  }
  Lampa.Noty.show('ShikiLamp: не авторизован. Введите Shikimori access token.');
}

function askOAuthCredentials() {
  askSettingValue('oauthClientId', 'OAuth Client ID', auth.getClientId(), function (clientId) {
    clientId = String(clientId || '').trim();
    if (!clientId) {
      Lampa.Noty.show('ShikiLamp: Client ID пустой');
      return;
    }
    askSettingValue('oauthClientSecret', 'OAuth Client Secret', auth.getClientSecret(), function (clientSecret) {
      clientSecret = String(clientSecret || '').trim();
      if (!clientSecret) {
        Lampa.Noty.show('ShikiLamp: Client Secret пустой');
        return;
      }
      auth.setCredentials(clientId, clientSecret);
      Lampa.Noty.show('ShikiLamp: OAuth приложение сохранено');
    });
  });
}

function openOAuthAuthorization() {
  let url;
  try {
    url = auth.buildAuthorizationUrl();
  } catch (err) {
    Lampa.Noty.show('ShikiLamp: сначала настройте OAuth приложение');
    return;
  }
  try {
    if (Lampa.Utils && Lampa.Utils.openUrl) Lampa.Utils.openUrl(url);
    else if (typeof window !== 'undefined' && window.open) window.open(url, '_blank');
  } catch (err) {
    logger.warn('OAuth open error', err.message);
  }
  Lampa.Noty.show('ShikiLamp: подтвердите доступ и введите полученный код');
}

function askAuthorizationCode() {
  askSettingValue('oauthCode', 'Код авторизации Shikimori', '', function (code) {
    code = String(code || '').trim();
    if (!code) {
      Lampa.Noty.show('ShikiLamp: код пустой');
      return;
    }
    Lampa.Noty.show('ShikiLamp: выполняю вход...');
    auth.exchangeCode(code).then(function (user) {
      Lampa.Noty.show('ShikiLamp: вход выполнен как ' + (user.nickname || user.name || ('ID ' + user.id)));
    }).catch(function (err) {
      Lampa.Noty.show('ShikiLamp: ошибка OAuth — ' + err.message);
    });
  });
}

function askToken() {
  const current = auth.getToken();
  const save = function (value) {
    const token = String(value || '').trim();
    if (!token) {
      Lampa.Noty.show('ShikiLamp: пустой токен не сохранён');
      return;
    }
    auth.setToken(token);
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
    Lampa.Noty.show('ShikiLamp: вход выполнен как ' + (user.nickname || user.name || ('ID ' + user.id)));
  }).catch(function (err) {
    Lampa.Noty.show('ShikiLamp: ошибка входа — ' + err.message);
  });
}

function onSettingChange(e) {
  if (e.name === config.STORAGE_KEYS.debug) {
    logger.setDebug(e.value);
  }
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
  get,
  set
};
