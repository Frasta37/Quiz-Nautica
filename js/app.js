/* Routing and session lifecycle.
 *
 * Screens are swapped by clearing #app and appending a freshly built node. The
 * quiz screen owns a timer, so before every swap we call the teardown hook it
 * leaves on its node (see Screens.quiz -> wrap.__stopTimer).
 */
(function (global) {
  'use strict';

  var el = UI.el;
  var appNode = null;
  var navNode = null;
  var currentScreen = null;
  var session = null;

  function stopActiveTimers() {
    var node = appNode.firstChild;
    if (node && typeof node.__stopTimer === 'function') node.__stopTimer();
  }

  function setActiveNav(name) {
    if (!navNode) return;
    Array.prototype.forEach.call(navNode.querySelectorAll('.mbtn'), function (b) {
      b.classList.toggle('is-active', b.dataset.screen === name);
    });
  }

  var ctx = {
    get session() { return session; },

    go: function (name) {
      if (name !== 'quiz') { stopActiveTimers(); session = null; }
      render(name);
    },

    render: function () { render(currentScreen); },

    /* Lets the quiz screen refresh the HUD clock without reaching into this
     * module, so there is still a single owner of the session state. */
    hud: syncExamHud,

    start: function (mode, opts) {
      opts = opts || {};
      var pool = buildPool(mode, opts);
      if (!pool.length) {
        global.alert('Nessuna domanda corrisponde ai filtri scelti.');
        return;
      }
      session = new Session({
        mode: mode,
        examId: opts.examId,
        questions: pool
      });
      stopActiveTimers();
      render('quiz');
    },

    /* Starts an official paper. Returns an error string instead of throwing so
     * the screen can explain a missing bank rather than opening an exam that
     * could never be passed. */
    startExam: function (examId) {
      var check = Exam.validate(examId);
      if (!check.available) return Exam.unavailableReason(examId);
      var paper = Exam.buildPaper(examId);
      if (!paper.questions.length) return paper.error;
      session = new Session({ mode: 'exam', examId: examId, questions: paper.questions });
      stopActiveTimers();
      render('quiz');
      return '';
    },

    finish: function (reason) {
      if (!session || session.finished) return;
      session.finish();
      render('result');
      if (reason) {
        var note = document.createElement('p');
        note.className = 'small muted';
        note.textContent = 'Sessione conclusa: ' + reason.toLowerCase() + '.';
        var panel = appNode.querySelector('.panel');
        if (panel) panel.appendChild(note);
      }
    },

    quit: function () {
      stopActiveTimers();
      session = null;
      render('home');
    }
  };

  function buildPool(mode, opts) {
    if (Array.isArray(opts.questions) && opts.questions.length) {
      return opts.questions.slice(0, Math.max(1, opts.size || opts.questions.length));
    }

    /* An official paper is composed by js/exam.js so the fixed number of
     * questions per subject is respected. Sampling the whole bank at random
     * would produce a paper that does not exist in the regulations. */
    if (mode === 'exam') {
      var paper = Exam.buildPaper(opts.examId || 'base');
      if (!paper.questions.length) {
        if (global.console && global.console.error) {
          global.console.error('Esame non disponibile:', paper.error);
        }
        return [];
      }
      return paper.questions;
    }

    /* One filter chain for the whole app (js/pool.js): the ALLENAMENTO setup
     * screen shows its count live, and an empty result stays empty, so a
     * search that finds nothing lands on the "no match" alert in ctx.start
     * instead of silently starting a random full-bank session. */
    var pool = Pool.filter(opts);

    /* Training sessions use the remembered size; the filters may have shrunk
     * the pool, so the sample never exceeds what is left (an empty pool
     * stays empty and ctx.start explains why nothing started). */
    var settings = Store.loadSettings();
    var size = Math.max(1, Math.min(Number(opts.size) || settings.practiceSize, pool.length));
    return Data.sample(pool, size);
  }

  function render(name) {
    currentScreen = name;
    stopActiveTimers();
    UI.clear(appNode);

    var node;
    switch (name) {
      case 'quiz':
        if (!session) { name = currentScreen = 'home'; node = Screens.home(ctx); break; }
        node = Screens.quiz(ctx);
        break;
      case 'result':
        if (!session) { name = currentScreen = 'home'; node = Screens.home(ctx); break; }
        node = Screens.result(ctx);
        break;
      case 'home':
      case 'examtype':
      case 'practice':
      case 'bank':
      case 'stats':
        node = Screens[name](ctx);
        break;
      default:
        /* An unknown screen name is a programming error; surface it instead of
         * quietly showing the home screen, which hides typos like a nav button
         * pointing at a screen that was never implemented. */
        if (global.console && global.console.error) {
          global.console.error('Unknown screen requested:', name);
        }
        name = currentScreen = 'home';
        node = Screens.home(ctx);
    }

    appNode.appendChild(node);
    /* The exam chooser belongs to the ESAME tab, and so does the debrief. */
    setActiveNav(name === 'result' || name === 'examtype' ? 'exam' : name);

    /* Presentation only: refresh the HUD counters and let CSS know which
     * screen is showing, so the scene can change with it. */
    if (typeof UI.hud === 'function') UI.hud();
    syncExamHud();
    if (document.body && document.body.setAttribute) {
      document.body.setAttribute('data-screen', name);
    }

    appNode.focus();
    global.scrollTo(0, 0);
  }

  /* While an official paper is running the HUD shows which exam it is, how far
   * through the paper the candidate is and how much time is left, so that
   * information is on screen everywhere instead of only inside the quiz. */
  function syncExamHud() {
    var examChip = document.getElementById('hudExam');
    var clockChip = document.getElementById('hudClock');
    if (!examChip || !clockChip) return;

    var on = !!(session && session.isExam());
    examChip.hidden = !on;
    clockChip.hidden = !on;
    if (!on) {
      /* Leaving the paper brings the daylight back. */
      document.documentElement.style.removeProperty('--dusk');
      var world = document.querySelector('.world');
      if (world) world.classList.remove('is-dark');
      return;
    }

    document.getElementById('hudExamLabel').textContent = session.exam.label;
    document.getElementById('hudExamPos').textContent =
      (session.index + 1) + '/' + session.total();

    var left = session.timeLeftMs();
    var time = document.getElementById('hudClockTime');
    time.textContent = Screens.formatClock(left);
    clockChip.classList.toggle('is-low', left <= 5 * 60 * 1000);
    clockChip.classList.toggle('is-over', left <= 0);
    setDusk(left, session.exam.seconds * 1000);
  }

  /* The world behind the interface darkens as the exam clock runs down, so a
   * paper in trouble looks like it. The last quarter of the time is what turns
   * to dusk; before that it stays midday, because a sky that dims from the
   * first second would be noise rather than information. */
  function setDusk(leftMs, totalMs) {
    var world = document.querySelector('.world');
    if (!world) return;

    var root = document.documentElement;
    if (!(leftMs < totalMs)) {
      root.style.setProperty('--dusk', '0');
      world.classList.remove('is-dark');
      return;
    }

    /* 1 at the start of the last quarter, 0 at half of it, clamped after. */
    var startOfDusk = totalMs * 0.25;
    var dusk = leftMs >= startOfDusk
      ? 0
      : Math.min(1, (startOfDusk - leftMs) / (startOfDusk * 0.5));

    root.style.setProperty('--dusk', String(Math.round(dusk * 20) / 20));
    world.classList.toggle('is-dark', leftMs <= 0);
  }

  function ensureDialog() {
    if (document.getElementById('sourceDialog')) return;
    var dlg = document.createElement('dialog');
    dlg.id = 'sourceDialog';
    dlg.className = 'sheet';
    dlg.setAttribute('aria-label', 'Verifica fonte');
    document.body.appendChild(dlg);
  }

  /* Every nav button now maps to a screen. ESAME opens the rules sheet for the
   * official paper instead of starting it straight away, so nothing is launched
   * by accident and the rules are read first. */
  var NAV_ACTIONS = {
    exam: function () { ctx.go('examtype'); },
    home: function () { ctx.quit(); },
    practice: function () { ctx.go('practice'); },
    bank: function () { ctx.go('bank'); },
    stats: function () { ctx.go('stats'); }
  };

  function boot() {
    appNode = document.getElementById('app');
    navNode = document.getElementById('modeNav');
    ensureDialog();

    if (!Data.total) {
      UI.clear(appNode);
      appNode.appendChild(el('div', { class: 'panel' }, [
        el('h1', { text: 'Nessun dato caricato' }),
        el('p', { text:
          'Il file data/questions.js non contiene domande. Rigeneralo con: ' +
          'python tools\\extract_quiz.py "<pdf>" --all-pages' })
      ]));
      return;
    }

    navNode.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.mbtn');
      if (!btn) return;
      var target = btn.dataset.screen;
      var action = NAV_ACTIONS[target];
      if (!action) {
        if (global.console) global.console.error('Nav button without an action:', target);
        return;
      }
      if (session && (target === 'home' || target === 'exam' ||
          target === 'practice')) {
        if (!global.confirm('Abbandonare la sessione in corso?')) return;
        stopActiveTimers();
        session = null;
      }
      action();
    });

    document.addEventListener('keydown', function (ev) {
      if (!session || currentScreen !== 'quiz') return;
      var tagName = (ev.target.tagName || '').toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;

      if (ev.key >= '1' && ev.key <= '6') {
        var idx = Number(ev.key) - 1;
        var q = session.current();
        if (q && q.answers[idx]) { session.answer(idx); render('quiz'); }
      } else if (ev.key === 'ArrowRight') {
        session.next(); render('quiz');
      } else if (ev.key === 'ArrowLeft') {
        session.prev(); render('quiz');
      }
    });

    render('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.App = { ctx: ctx, render: render };
}(this));