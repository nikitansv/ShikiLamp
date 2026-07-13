/**
 * Network client with queue, retry, cache, and cancellation support.
 */
const config = require('../config');
const logger = require('../logger');
const cache = require('../cache');

const DEFAULT_TIMEOUT = 30000;
const MAX_CONCURRENT = 3;
const RETRIES = 2;

let queue = [];
let active = 0;
let networkInstance = null;
let abortControllers = {};

function getNetwork() {
  if (networkInstance) return networkInstance;
  if (typeof Lampa !== 'undefined' && Lampa.Network) {
    networkInstance = Lampa.Network;
  } else if (typeof Lampa !== 'undefined' && Lampa.Reguest) {
    networkInstance = new Lampa.Reguest();
  }
  return networkInstance;
}

function getApiBaseUrl() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    const url = Lampa.Storage.get(config.STORAGE_KEYS.apiBaseUrl, config.DEFAULTS.apiBaseUrl);
    if (typeof url === 'string' && url.length > 0) return url.replace(/\/$/, '');
  }
  return config.SHIKIMORI_HOST_DEFAULT;
}

function setDebug(enabled) {
  logger.setDebug(enabled);
}

function buildUrl(path) {
  const base = getApiBaseUrl();
  if (/^https?:\/\//i.test(path)) return path;
  return base + path;
}

function normalizeError(xhr, exception) {
  const status = xhr && xhr.status ? xhr.status : 0;
  const code = xhr && xhr.decode_code ? xhr.decode_code : status;
  const message = (xhr && xhr.decode_error) || (exception && exception.message) || 'Network error';
  return { status, code, message, xhr, exception };
}

function runNext() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  const job = queue.shift();
  active++;
  execute(job);
}

function execute(job) {
  const network = getNetwork();
  const url = buildUrl(job.path);
  const cacheKey = { method: job.method || 'GET', path: job.path, body: job.body };

  const cached = cache.get('api', cacheKey, job.ttl || 0);
  if (cached.hit && !job.skipCache) {
    logger.debug('Cache hit', url);
    return finish(job, null, cached.data);
  }

  const params = {
    url: url,
    timeout: job.timeout || DEFAULT_TIMEOUT,
    headers: Object.assign({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }, job.headers || {}),
    dataType: 'json'
  };

  if (job.method && job.method !== 'GET') {
    params.type = job.method;
    if (job.body) params.post_data = typeof job.body === 'string' ? job.body : JSON.stringify(job.body || {});
  } else if (job.body) {
    params.type = 'POST';
    params.post_data = typeof job.body === 'string' ? job.body : JSON.stringify(job.body || {});
  }

  const token = getExperimentalToken();
  if (token && job.authenticated) {
    params.headers['Authorization'] = 'Bearer ' + token;
  }

  const id = job.id;
  let aborted = false;

  const done = function (data, fromCache) {
    if (aborted) return;
    if (!fromCache && job.cacheTtl > 0) {
      cache.set('api', cacheKey, data);
    }
    finish(job, null, data);
  };

  const shouldRetry = function (err) {
    return err && (err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500);
  };

  function makeRequest(attemptsLeft) {
    if (aborted) return;

    const fail = function (xhr, exception) {
      if (aborted) return;
      const err = normalizeError(xhr, exception);
      if (attemptsLeft > 0 && shouldRetry(err)) {
        const delay = Math.min(1000 * Math.pow(2, RETRIES - attemptsLeft), 8000);
        setTimeout(function () {
          makeRequest(attemptsLeft - 1);
        }, delay);
        return;
      }
      finish(job, err, null);
    };

    if (network && network.quiet) {
      network.quiet(url, done, fail, params.post_data, params);
    } else if (typeof fetch === 'function') {
      const controller = new AbortController();
      abortControllers[id] = controller;
      fetch(url, {
        method: params.type || 'GET',
        headers: params.headers,
        body: params.post_data,
        signal: controller.signal,
        mode: 'cors'
      }).then(function (response) {
        delete abortControllers[id];
        if (!response.ok) {
          const fakeXhr = { status: response.status, decode_error: 'HTTP ' + response.status };
          return fail(fakeXhr, new Error(fakeXhr.decode_error));
        }
        return response.json().then(function (json) {
          done(json, false);
        }).catch(function (e) {
          fail({ status: 500, decode_error: 'JSON parse error: ' + e.message }, e);
        });
      }).catch(function (e) {
        delete abortControllers[id];
        if (e.name === 'AbortError') return;
        fail({ status: 0, decode_error: e.message }, e);
      });
      return;
    } else {
      fail({ status: 0, decode_error: 'No network backend available' }, new Error('No network'));
      return;
    }

  }

  makeRequest(RETRIES);

  job.abort = function () {
    aborted = true;
    if (abortControllers[id]) {
      try { abortControllers[id].abort(); } catch (e) {}
      delete abortControllers[id];
    }
  };
}

function finish(job, err, data) {
  active--;
  if (err) {
    if (job.onError) job.onError(err);
  } else {
    if (job.onSuccess) job.onSuccess(data);
  }
  if (job.onFinally) job.onFinally(err, data);
  runNext();
}

function request(path, options) {
  return new Promise(function (resolve, reject) {
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const job = {
      id: id,
      path: path,
      method: options.method || 'GET',
      body: options.body || null,
      headers: options.headers || {},
      timeout: options.timeout,
      ttl: options.ttl || 0,
      skipCache: options.skipCache,
      cacheTtl: options.cacheTtl || 0,
      authenticated: options.authenticated,
      onSuccess: resolve,
      onError: reject,
      onFinally: options.onFinally
    };
    queue.push(job);
    runNext();
  });
}

function cancel(id) {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].id === id) {
      queue.splice(i, 1);
      return true;
    }
  }
  return false;
}

function cancelAll() {
  queue = [];
  Object.keys(abortControllers).forEach(function (id) {
    try { abortControllers[id].abort(); } catch (e) {}
  });
  abortControllers = {};
}

function getExperimentalToken() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    const raw = Lampa.Storage.get(config.STORAGE_KEYS.experimentalToken, '');
    if (typeof raw === 'string' && raw.length > 0) return raw;
  }
  return '';
}

module.exports = {
  request,
  cancel,
  cancelAll,
  setDebug,
  getApiBaseUrl,
  getExperimentalToken
};
