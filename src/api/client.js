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
let jobs = {};
let scopeSequence = 0;

function getAuth() {
  try {
    return require('../auth');
  } catch (e) {
    return null;
  }
}

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
  job.started = true;
  execute(job);
}

function executeFetch(url, params, id, done, fail) {
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
      return response.text().then(function (text) {
        const fakeXhr = { status: response.status, decode_error: text || ('HTTP ' + response.status) };
        fail(fakeXhr, new Error(fakeXhr.decode_error));
      });
    }
    if (response.status === 204) {
      done({}, false);
      return null;
    }
    return response.text().then(function (text) {
      if (!text) return done({}, false);
      try {
        done(JSON.parse(text), false);
      } catch (e) {
        fail({ status: 500, decode_error: 'JSON parse error: ' + e.message }, e);
      }
      return null;
    });
  }).catch(function (e) {
    delete abortControllers[id];
    if (e.name === 'AbortError') return;
    fail({ status: 0, decode_error: e.message }, e);
  });
}

function execute(job) {
  if (job.cancelled || job.settled) return;

  if (job.authenticated && !job.authPrepared) {
    const auth = getAuth();
    job.authPrepared = true;
    if (!auth || typeof auth.ensureValidToken !== 'function') {
      return finish(job, new Error('Authentication helper unavailable'), null);
    }
    auth.ensureValidToken(false).then(function () {
      execute(job);
    }).catch(function (error) {
      finish(job, error, null);
    });
    return;
  }

  const network = getNetwork();
  const url = buildUrl(job.path);
  const cacheKey = { method: job.method || 'GET', path: job.path, body: job.body };

  const cached = cache.get('api', cacheKey, job.cacheTtl || job.ttl || 0);
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

  const id = job.id;
  let aborted = false;

  job.abort = function () {
    job.cancelled = true;
    aborted = true;
    if (job.retryTimer) {
      clearTimeout(job.retryTimer);
      job.retryTimer = null;
    }
    if (abortControllers[id]) {
      try { abortControllers[id].abort(); } catch (e) {}
      delete abortControllers[id];
    }
  };

  const done = function (data, fromCache) {
    if (aborted || job.cancelled || job.settled) return;
    if (!fromCache && job.cacheTtl > 0) {
      cache.set('api', cacheKey, data);
    }
    finish(job, null, data);
  };

  const shouldRetry = function (err) {
    return err && (err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500);
  };

  function makeRequest(attemptsLeft) {
    if (aborted || job.cancelled || job.settled) return;

    const requestParams = Object.assign({}, params, {
      headers: Object.assign({}, params.headers)
    });
    if (job.authenticated) {
      const token = getExperimentalToken();
      if (token) requestParams.headers['Authorization'] = 'Bearer ' + token;
      else delete requestParams.headers['Authorization'];
    }

    const fail = function (xhr, exception) {
      if (aborted || job.cancelled || job.settled) return;
      const err = normalizeError(xhr, exception);
      if (err.status === 401 && job.authenticated && !job.authRetried) {
        const auth = getAuth();
        job.authRetried = true;
        if (!auth || typeof auth.ensureValidToken !== 'function') {
          finish(job, err, null);
          return;
        }
        auth.ensureValidToken(true).then(function () {
          makeRequest(attemptsLeft);
        }).catch(function (refreshError) {
          finish(job, refreshError, null);
        });
        return;
      }
      if (attemptsLeft > 0 && shouldRetry(err)) {
        const delay = Math.min(1000 * Math.pow(2, RETRIES - attemptsLeft), 8000);
        job.retryTimer = setTimeout(function () {
          job.retryTimer = null;
          makeRequest(attemptsLeft - 1);
        }, delay);
        return;
      }
      finish(job, err, null);
    };

    const preferFetch = typeof fetch === 'function' && job.authenticated && params.type && params.type !== 'GET';
    if (preferFetch) {
      executeFetch(url, requestParams, id, done, fail);
      return;
    }

    if (network && network.quiet) {
      network.quiet(url, done, fail, requestParams.post_data, requestParams);
    } else if (typeof fetch === 'function') {
      const controller = new AbortController();
      abortControllers[id] = controller;
      fetch(url, {
        method: requestParams.type || 'GET',
        headers: requestParams.headers,
        body: requestParams.post_data,
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
        if (e.name === 'AbortError' && (aborted || job.cancelled)) return;
        fail({ status: 0, decode_error: e.message }, e);
      });
      return;
    } else {
      fail({ status: 0, decode_error: 'No network backend available' }, new Error('No network'));
      return;
    }

  }

  makeRequest(RETRIES);

}

function finish(job, err, data) {
  if (!job || job.settled) return;
  job.settled = true;
  delete jobs[job.id];
  if (job.retryTimer) {
    clearTimeout(job.retryTimer);
    job.retryTimer = null;
  }
  if (job.started) active = Math.max(0, active - 1);
  try {
    if (err) {
      if (job.onError) job.onError(err);
    } else if (job.onSuccess) {
      job.onSuccess(data);
    }
    if (job.onFinally) job.onFinally(err, data);
  } finally {
    if (job.started) runNext();
  }
}

function request(path, options) {
  options = options || {};
  let resolveRequest;
  let rejectRequest;
  const promise = new Promise(function (resolve, reject) {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
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
    scope: options.scope,
    onSuccess: resolveRequest,
    onError: rejectRequest,
    onFinally: options.onFinally,
    started: false,
    settled: false,
    cancelled: false
  };
  jobs[id] = job;
  promise.requestId = id;
  promise.cancel = function () { return cancel(id); };
  queue.push(job);
  runNext();
  return promise;
}

function cancellationError() {
  const error = new Error('REQUEST_CANCELLED');
  error.code = 'REQUEST_CANCELLED';
  return error;
}

function cancelJob(job) {
  if (!job || job.settled) return false;
  job.cancelled = true;
  if (typeof job.abort === 'function') job.abort();
  finish(job, cancellationError(), null);
  return true;
}

function cancel(id) {
  return cancelJob(jobs[id]);
}

function cancelAll() {
  const pending = Object.keys(jobs).map(function (id) { return jobs[id]; });
  queue = [];
  pending.forEach(cancelJob);
  abortControllers = {};
}

function createScope(prefix) {
  scopeSequence += 1;
  return String(prefix || 'request') + '_' + scopeSequence + '_' + Date.now();
}

function cancelScope(scope) {
  if (!scope) return 0;
  const pending = Object.keys(jobs).map(function (id) { return jobs[id]; }).filter(function (job) {
    return job.scope === scope;
  });
  pending.forEach(cancelJob);
  return pending.length;
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
  createScope,
  cancelScope,
  setDebug,
  getApiBaseUrl,
  getExperimentalToken
};
