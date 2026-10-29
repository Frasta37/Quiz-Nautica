/* Progress persistence.
 *
 * localStorage holds one small record per question: right/wrong/unseen. That is
 * all the statistics and error-retry screens need, and it stays well under the
 * storage limit even with every question answered.
 *
 * When localStorage is unavailable (some file:// sandboxes, private mode) the
 * store degrades to in-memory only, so the quiz still runs for the session.
 */
(function (global) {
  'use strict';

  var KEY = 'quiz-nautica.progress.v1';
  var SETTINGS_KEY = 'quiz-nautica.settings.v1';

  var UNSEEN = 0, RIGHT = 1, WRONG = 2;

  var memory = null;
  var settingsMemory = null;
  var usable = true;

  function readStore() {
    if (memory) return memory;
    memory = {};
    if (!usable) return memory;
    try {
      var txt = global.localStorage.getItem(KEY);
      if (txt) {
        var parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          memory = parsed;
        }
      }
    } catch (err) {
      usable = false;
    }
    return memory;
  }

  function writeStore() {
    if (!usable) return;
    try {
      global.localStorage.setItem(KEY, JSON.stringify(memory));
    } catch (err) {
      usable = false;
    }
  }

  /* Defensive against a truncated or hand-edited file. */
  function coerceState(v) {
    return v === UNSEEN || v === RIGHT || v === WRONG ? v : UNSEEN;
  }

  function stateOf(n) {
    var entry = readStore()[n];
    if (!entry) return UNSEEN;
    return coerceState(entry.s);
  }

  function record(n, correct) {
    var store = readStore();
    store[n] = {
      s: correct ? RIGHT : WRONG,
      a: (store[n] && store[n].a ? store[n].a : 0) + 1
    };
    writeStore();
  }

  function reset() {
    memory = {};
    if (!usable) return;
    try { global.localStorage.removeItem(KEY); } catch (err) { usable = false; }
  }

  function summary() {
    var store = readStore();
    var right = 0, wrong = 0, seen = 0;
    for (var k in store) {
      if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
      var s = coerceState(store[k].s);
      if (s === RIGHT) { right++; seen++; }
      else if (s === WRONG) { wrong++; seen++; }
    }
    return { right: right, wrong: wrong, seen: seen };
  }

  function numbersWith(state) {
    var store = readStore();
    var out = [];
    for (var k in store) {
      if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
      if (coerceState(store[k].s) === state) out.push(Number(k));
    }
    return out.sort(function (a, b) { return a - b; });
  }

  /* ---------- settings ---------- */

var DEFAULT_SETTINGS = {
  practiceSize: 20,
    practiceWrongOnly: false,
    practiceUnseenOnly: false,
    theme: 'deep'
  };

  function loadSettings() {
    if (settingsMemory) return settingsMemory;
    settingsMemory = Object.assign({}, DEFAULT_SETTINGS);
    if (!usable) return settingsMemory;
    try {
      var txt = global.localStorage.getItem(SETTINGS_KEY);
      if (txt) {
        var parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
            if (typeof parsed[k] === typeof DEFAULT_SETTINGS[k]) {
              settingsMemory[k] = parsed[k];
            }
          });
        }
      }
    } catch (err) {
      usable = false;
    }
    return settingsMemory;
  }

  function saveSettings(patch) {
    var current = loadSettings();
    Object.keys(patch || {}).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k)) {
        current[k] = patch[k];
      }
    });
    if (usable) {
      try { global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(current)); }
      catch (err) { usable = false; }
    }
    return current;
  }

  /* Probes storage rather than assuming it. Some file:// contexts and private
   browsing modes expose localStorage but throw on write, and the quiz should
   say so up front instead of silently losing progress later. */
function isPersistent() {
  if (!usable) return false;
  var probe = KEY + '.probe';
  try {
    global.localStorage.setItem(probe, '1');
    global.localStorage.removeItem(probe);
  } catch (err) {
    usable = false;
  }
  return usable;
}

global.Store = {
    UNSEEN: UNSEEN,
    RIGHT: RIGHT,
    WRONG: WRONG,
    stateOf: stateOf,
    record: record,
    reset: reset,
    summary: summary,
    numbersWith: numbersWith,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    isPersistent: isPersistent
  };
}(this));