/* Tiny original sound effects, synthesised with the Web Audio API.
 *
 * Nothing is loaded from disk or the network: every effect is a short envelope
 * on an oscillator, in the spirit of an 8-bit sound chip. No existing game's
 * audio is used or imitated.
 *
 * Rules this module keeps:
 *   - never autoplay. The context is only created after a real user gesture,
 *     and only once sound has been switched on;
 *   - never throw. If Web Audio or localStorage is unavailable the quiz must
 *     keep working silently, so every entry point is defensive;
 *   - keep its own preference under its own key, so the quiz progress store
 *     (js/store.js) is left exactly as it was.
 */
(function (global) {
  'use strict';

  var KEY = 'quiz-nautica.audio.v1';
  var ctx = null;
  var enabled = false;

  function readPref() {
    try {
      return global.localStorage && global.localStorage.getItem(KEY) === 'on';
    } catch (err) {
      return false;
    }
  }

  function writePref(on) {
    try {
      if (global.localStorage) global.localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch (err) {
      /* A private-mode browser that refuses writes just loses the preference. */
    }
  }

  function supported() {
    return !!(global.AudioContext || global.webkitAudioContext);
  }

  function ensureContext() {
    if (ctx) return ctx;
    var Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  /* One effect = one or more short notes. `type` is the oscillator shape,
   * `at` the start offset in seconds, `hz` the pitch and `dur` the length. */
  var EFFECTS = {
    move:   [{ type: 'square', at: 0.00, hz: 520, dur: 0.05 }],
    select: [{ type: 'square', at: 0.00, hz: 660, dur: 0.06 },
             { type: 'square', at: 0.06, hz: 880, dur: 0.08 }],
    correct: [{ type: 'triangle', at: 0.00, hz: 660, dur: 0.09 },
              { type: 'triangle', at: 0.09, hz: 990, dur: 0.16 }],
    wrong:  [{ type: 'sawtooth', at: 0.00, hz: 200, dur: 0.14 },
             { type: 'sawtooth', at: 0.12, hz: 140, dur: 0.20 }],
    complete: [{ type: 'square', at: 0.00, hz: 523, dur: 0.11 },
               { type: 'square', at: 0.11, hz: 659, dur: 0.11 },
               { type: 'square', at: 0.22, hz: 784, dur: 0.11 },
               { type: 'square', at: 0.33, hz: 1047, dur: 0.26 }]
  };

  /* Play a named effect. A no-op when sound is off or unavailable, so callers
   * can fire and forget without checking anything first. */
  function play(name) {
    if (!enabled) return false;
    var spec = EFFECTS[name];
    if (!spec) return false;
    var ac = ensureContext();
    if (!ac) return false;
    try {
      if (ac.state === 'suspended' && typeof ac.resume === 'function') ac.resume();
      var t0 = ac.currentTime;
      spec.forEach(function (note) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.type = note.type;
        osc.frequency.setValueAtTime(note.hz, t0 + note.at);
        /* Short attack, exponential decay: a chiptune envelope, no clicks. */
        gain.gain.setValueAtTime(0.0001, t0 + note.at);
        gain.gain.exponentialRampToValueAtTime(0.14, t0 + note.at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + note.dur);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + note.at);
        osc.stop(t0 + note.at + note.dur + 0.02);
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  function setEnabled(on) {
    enabled = !!on && supported();
    writePref(enabled);
    paintToggle();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function paintToggle() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('audioToggle');
    if (!btn) return;
    btn.textContent = enabled ? 'AUDIO ON' : 'AUDIO OFF';
    btn.classList.toggle('is-on', enabled);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function wire() {
    if (typeof document === 'undefined') return;
    var btn = document.getElementById('audioToggle');
    if (btn) btn.addEventListener('click', toggle);
    paintToggle();
  }

  /* Honour the stored preference without creating a context: a context built at
   * load time would either be blocked by autoplay policy or start suspended. */
  enabled = readPref() && supported();
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wire);
    } else {
      wire();
    }
  }

  global.Sfx = {
    play: play,
    toggle: toggle,
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    isSupported: supported,
    EFFECTS: EFFECTS
  };
}(this));