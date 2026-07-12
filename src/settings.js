/**
 * Settings registration for Lampa SettingsApi.
 */
const config = require('./config');
const logger = require('./logger');
const cache = require('./cache');
const mappingStorage = require('./mapping/storage');

const COMPONENT = 'shikimori_local';

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

function register() {
  if (!Lampa || !Lampa.SettingsApi) return;

  Lampa.SettingsApi.addComponent({
    component: COMPONENT,
    name: 'Shikimori Local'
  });

  addTrigger('enabled', 'Включить плагин', config.DEFAULTS.enabled);
  addInput('apiBaseUrl', 'API Base URL', config.DEFAULTS.apiBaseUrl, 'Например https://shikimori.io или http://192.168.1.10:8080');
  addSelect('language', 'Язык результатов', [
    { title: 'Русский', code: 'russian' },
    { title: 'English', code: 'english' }
  ], config.DEFAULTS.language);
  addTrigger('showMenu', 'Показывать кнопку в меню', config.DEFAULTS.showMenu);
  addInput('pageSize', 'Число результатов на страницу', String(config.DEFAULTS.pageSize));
  addInput('mappingThreshold', 'Порог автоматического mapping', String(config.DEFAULTS.mappingThreshold));
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

  addTrigger('experimentalFeatures', 'Включить экспериментальные пользовательские функции', false);
  addInput('experimentalToken', 'Экспериментальный access token', '', '⚠️ Опасно: токен хранится только локально и никогда не передаётся в логи.');
}

function addTrigger(name, title, defaultValue) {
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: config.STORAGE_KEYS[name], type: 'trigger', default: defaultValue },
    field: { name: title },
    onChange: onSettingChange
  });
}

function addInput(name, title, defaultValue, description) {
  Lampa.SettingsApi.addParam({
    component: COMPONENT,
    param: { name: config.STORAGE_KEYS[name], type: 'input', default: defaultValue },
    field: { name: title, description: description || '' },
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
