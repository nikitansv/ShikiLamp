/**
 * Lightweight logger. Does not leak tokens.
 */
const config = require('./config');

const prefix = '[' + config.PLUGIN_ID + ']';
const MAX_ENTRIES = 200;
let debugEnabled = false;
let entries = [];

function sanitize(value) {
  const text = typeof value === 'string' ? value : safeStringify(value);
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/access_token["'=:\s]+[A-Za-z0-9._~+\/-]+=*/gi, 'access_token=[REDACTED]')
    .replace(/refresh_token["'=:\s]+[A-Za-z0-9._~+\/-]+=*/gi, 'refresh_token=[REDACTED]')
    .slice(0, 1000);
}

function safeStringify(value) {
  if (value instanceof Error) return value.message;
  try { return JSON.stringify(value); } catch (e) { return String(value); }
}

function remember(level, args) {
  entries.push({
    ts: Date.now ? Date.now() : new Date().getTime(),
    level: level,
    message: Array.prototype.slice.call(args).map(sanitize).join(' ')
  });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);
}

function setDebug(enabled) {
  debugEnabled = Boolean(enabled);
}

function isDebug() {
  return debugEnabled;
}

function log() {
  remember('log', arguments);
  if (typeof console !== 'undefined' && console.log) {
    console.log.apply(console, [prefix].concat(Array.prototype.slice.call(arguments)));
  }
}

function warn() {
  remember('warn', arguments);
  if (typeof console !== 'undefined' && console.warn) {
    console.warn.apply(console, [prefix].concat(Array.prototype.slice.call(arguments)));
  }
}

function error() {
  remember('error', arguments);
  if (typeof console !== 'undefined' && console.error) {
    console.error.apply(console, [prefix].concat(Array.prototype.slice.call(arguments)));
  }
}

function debug() {
  if (!debugEnabled) return;
  remember('debug', arguments);
  if (typeof console !== 'undefined' && console.log) {
    console.log.apply(console, [prefix + ' [debug]'].concat(Array.prototype.slice.call(arguments)));
  }
}

function getEntries() {
  return entries.slice();
}

function clear() {
  entries = [];
}

module.exports = { setDebug, isDebug, log, warn, error, debug, getEntries, clear };
