/**
 * Lightweight logger. Does not leak tokens.
 */
const config = require('./config');

const prefix = '[' + config.PLUGIN_ID + ']';
let debugEnabled = false;

function setDebug(enabled) {
  debugEnabled = Boolean(enabled);
}

function isDebug() {
  return debugEnabled;
}

function log() {
  if (typeof console !== 'undefined' && console.log) {
    console.log.apply(console, [prefix].concat(Array.prototype.slice.call(arguments)));
  }
}

function warn() {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn.apply(console, [prefix].concat(Array.prototype.slice.call(arguments)));
  }
}

function error() {
  if (typeof console !== 'undefined' && console.error) {
    console.error.apply(console, [prefix].concat(Array.prototype.slice.call(arguments)));
  }
}

function debug() {
  if (debugEnabled && typeof console !== 'undefined' && console.log) {
    console.log.apply(console, [prefix + ' [debug]'].concat(Array.prototype.slice.call(arguments)));
  }
}

module.exports = { setDebug, isDebug, log, warn, error, debug };
