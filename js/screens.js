/* Screen rendering. Each screen is a pure function returning a DOM node, except
 * the quiz screen, which keeps a local timer because it re-renders in place. */
(function (global) {
  'use strict';

  var el = UI.el;
  var button = UI.button;
  var tag = UI.tag;

  /* ---------------- HOME ---------------- */

  /* A menu panel. The whole card is clickable, and the button inside repeats
   * the same action, so the shortcut never becomes the only way in. */
  function modeCard(opts) {
    var card = el('div', {
      class: 'mode-card' + (opts.featured ? ' is-featured' : ''),
      onclick: opts.onClick
    }, [
      el('div', { class: 'mode-art' }, [
        UI.icon(opts.art),
        el('h3', { text: opts.title })
      ]),
      el('p', { text: opts.text }),
      button(opts.action, {
        variant: opts.featured ? 'primary' : null,
        onClick: opts.onClick
      })
    ]);
    return card;
  }

  function home(ctx) {
    var s = Store.summary();
    var total = Data.total;
    var wrap = el('div');

    wrap.appendChild(el('div', { class: 'hero' }, [
      el('h1', { class: 'game-title', text: 'Quiz Patente Nautica' }),
      el('div', { class: 'game-sub' }, [
        UI.icon('anchor'),
        el('span', { text: 'Preparati alla rotta giusta.' }),
        UI.icon('wheel')
      ]),
      el('p', { class: 'muted', text:
        'Banca dati di ' + total + ' domande estratte dal PDF ufficiale ' +
        "dell'esame. Ogni domanda è collegata alla pagina e alla riga di " +
        'provenienza.' }),
      el('div', { class: 'stat-row' }, [
        UI.stat('DOMANDE', total, '', 'chart'),
        UI.stat('CON FIGURA', Data.figureCount, '', 'island'),
        UI.stat('VISTE', s.seen, '', 'eye'),
        UI.stat('RISPOSTE GIUSTE', s.right, 'ok', 'flag-green'),
        UI.stat('RISPOSTE SBAGLIATE', s.wrong, 'bad', 'buoy-red')
      ])
    ]));

    if (!Store.isPersistent()) {
      wrap.appendChild(el('div', { class: 'panel panel-tight' }, [
        el('p', { class: 'small', style: 'margin:0;color:var(--gold)', text:
          'Avviso: questo browser non permette la scrittura su disco, quindi i ' +
          'progressi valgono solo per la sessione corrente.' })
      ]));
    }

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h2', { text: 'SCEGLI LA MISSIONE' }),
      el('div', { class: 'grid home-grid' }, [
        modeCard({
          art: 'lighthouse', title: 'Esame', featured: true,
          text: 'Simulazione ufficiale: 20 domande in 30 minuti, massimo 4 errori, ' +
            '16 risposte giuste per superare. Una sola risposta per domanda.',
          action: 'SCEGLI ESAME',
          onClick: function () { ctx.go('examtype'); }
        }),
        modeCard({
          art: 'buoy', title: 'Allenamento',
          text: 'Scegli quantità e filtro: solo sbagliate, solo non viste, o tutto.',
          action: 'ALLENATI',
          onClick: function () { ctx.go('practice'); }
        }),
        modeCard({
          art: 'chart', title: 'Archivio',
          text: 'Cerca per testo, tema o voce e controlla la fonte.',
          action: 'APRI ARCHIVIO',
          onClick: function () { ctx.go('bank'); }
        }),
        modeCard({
          art: 'logbook', title: 'Statistiche',
          text: 'Andamento per tema e per voce, più le domande più sbagliate.',
          action: 'VEDI STATISTICHE',
          onClick: function () { ctx.go('stats'); }
        })
      ])
    ]));

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h2', { text: 'DIARIO DI BORDO' }),
      el('p', { class: 'small muted', text:
        'Il diario tiene conto di dove sei arrivato. Riprendi la rotta da ' +
        'qualsiasi riva.' }),
      el('div', { class: 'diary' }, [
        el('div', { class: 'diary-item' }, [
          UI.icon('buoy-red'),
          el('div', { class: 'diary-text' }, [
            el('div', { class: 'diary-label', text: 'ERRORI DA RIPASSARE' }),
            el('div', { class: 'diary-value', text: String(s.wrong) })
          ])
        ]),
        el('div', { class: 'diary-item' }, [
          UI.icon('compass'),
          el('div', { class: 'diary-text' }, [
            el('div', { class: 'diary-label', text: 'DOMANDE NON VISTE' }),
            el('div', { class: 'diary-value', text: String(total - s.seen) })
          ])
        ]),
        el('div', { class: 'diary-item' }, [
          UI.icon('lifering'),
          el('div', { class: 'diary-text' }, [
            el('div', { class: 'diary-label', text: 'PROGRESSO SALVATO' }),
            el('div', { class: 'diary-value',
              text: Store.isPersistent() ? 'IN ROTTA' : 'SOLO SESSIONE' })
          ])
        ])
      ]),
      el('div', { class: 'row', style: 'margin-top:14px' }, [
        button('RIPRESENTA SOLO SBAGLIATE (' + s.wrong + ')', {
          disabled: s.wrong === 0,
          onClick: function () { ctx.start('practice', { wrongOnly: true }); }
        }),
        button('RIPRESENTA NON VISTE (' + (total - s.seen) + ')', {
          disabled: s.seen >= total,
          onClick: function () { ctx.start('practice', { unseenOnly: true }); }
        }),
        button('AZZERA PROGRESSO', {
          variant: 'danger',
          onClick: function () {
            if (global.confirm('Cancellare tutti i progressi salvati?')) {
              Store.reset();
              ctx.go('home');
            }
          }
        })
      ])
    ]));

    return wrap;
  }

  /* ---------------- SCEGLI ESAME ---------------- */

  /* One official exam. The card states the rules in the order a candidate
   * needs them: how many questions, how long, how many errors are tolerated
   * and how many correct answers are required. When the bank cannot supply the
   * paper the card says so instead of quietly starting something else. */
  function examCard(examId, ctx) {
    var exam = Exam.get(examId);
    var ok = Exam.available(examId);

    var facts = [
      [String(exam.total), 'domande'],
      [exam.minutes + ' min', 'tempo'],
      ['max ' + exam.maxErrors, 'error' + (exam.maxErrors === 1 ? 'e' : 'i')],
      [exam.passMark + '/' + exam.total, 'per passare']
    ];

    var card = el('div', { class: 'mode-card exam-card' + (ok ? '' : ' is-off') }, [
      el('div', { class: 'mode-art' }, [
        UI.icon('lighthouse'),
        el('h3', { text: exam.label })
      ]),
      el('p', { class: 'exam-blurb', text: exam.blurb }),
      el('div', { class: 'fact-row' }, facts.map(function (f) {
        return el('div', { class: 'fact' }, [
          el('b', { text: f[0] }),
          el('span', { text: f[1] })
        ]);
      })),
      /* The official distribution is part of the exam description, so it is
       * shown rather than hidden: the candidate can see what is coming. */
      el('ul', { class: 'rule-list' }, exam.rules.map(function (r) {
        var have = Data.temaCounts()[r.tema] || 0;
        return el('li', {}, [
          el('span', { text: r.short || r.label }),
          el('b', { text: String(r.count) }),
          el('span', { class: 'muted small', text: ' (' + have + ' nel banco)' })
        ]);
      })),
      ok ? button('SALPA! · INIZIA ' + exam.label, {
        variant: 'primary',
        onClick: function () {
          var error = ctx.startExam(examId);
          if (error) global.alert('Esame non disponibile: ' + error);
        }
      }) : el('div', { class: 'exam-off' }, [
        el('p', { class: 'small', style: 'margin:0', text:
          'Non disponibile con il banco attuale: ' +
          Exam.unavailableReason(examId) })
      ]),
      button('INDIETRO', { variant: 'ghost', onClick: function () { ctx.go('home'); } })
    ]);

    return card;
  }

  function examtype(ctx) {
    var wrap = el('div');

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h1', { text: 'SCEGLI ESAME' }),
      el('p', { class: 'muted', text:
        'Ogni simulazione riproduce la struttura ufficiale: il numero di ' +
        'domande per materia è fisso, il tempo è cronometrato e una sola ' +
        'risposta per domanda non può essere modificata.' }),
      el('div', { class: 'grid' }, Exam.ids().map(function (id) {
        return examCard(id, ctx);
      }))
    ]));

    return wrap;
  }

  /* ---------------- PRACTICE SETUP ---------------- */

  function practice(ctx) {
    var settings = Store.loadSettings();
    var pool = Data.questions;
    var s = Store.summary();

    var wrongNums = Store.numbersWith(Store.WRONG);
    var unseenCount = Data.total - s.seen;

    /* Free-text search: narrow the pool before it is sampled, so a theme or a
     * voice (or the wording of a question) can be found without scrolling the
     * dropdowns. It matches the same fields the archive does. */
    var search = el('input', { type: 'text',
      placeholder: 'Cerca nel testo, nel tema o nella voce',
      class: 'opt',
      'aria-label': 'Cerca nel testo, nel tema o nella voce' });
    search.style.flex = '1 1 100%';

    /* Live readout of what INIZIA will actually draw: the same Pool the app
     * samples at start, so the number on screen is the session that begins.
     * It follows every filter, not just the search box. */
    var matchLine = el('p', { class: 'small muted', 'aria-live': 'polite' });

    /* "Where are they?": while a free-text search is active, list the TEMA and
     * VOCE the matches fall under. A bare count tells you *how many* but not
     * *where*; these chips are the topics to click to drill in. Clicking one
     * filters by that value (click again to clear). */
    var matchesBox = el('div', { class: 'matches-box is-hidden',
      'aria-live': 'polite' });

    var sizeInput = el('input', { type: 'number', min: 1, max: pool.length,
      value: settings.practiceSize, class: 'opt' });
    sizeInput.dataset.role = 'size';

    var wrongBox = el('input', { type: 'checkbox' });
    wrongBox.checked = false;
    var unseenBox = el('input', { type: 'checkbox' });
    unseenBox.checked = false;

    var temaSel = el('select', { class: 'opt' },
      [el('option', { value: '', text: 'Tutti i temi' })].concat(
        Object.keys(Data.temaCounts()).sort().map(function (t) {
          return el('option', { value: t, text: t + ' (' + Data.temaCounts()[t] + ')' });
        })));

    var voceSel = el('select', { class: 'opt' },
      [el('option', { value: '', text: 'Tutte le voci' })].concat(
        Object.keys(Data.voceCounts()).sort().map(function (v) {
          return el('option', { value: v, text: v + ' (' + Data.voceCounts()[v] + ')' });
        })));

    /* Quick filter chips, one per TEMA. They are the same filter as the
     * dropdown below, not a second source of truth: clicking a chip writes to
     * the dropdown, and choosing in the dropdown updates the chips. */
    var chips = [];
    var chipRow = el('div', { class: 'chip-row', role: 'group',
      'aria-label': 'Filtro rapido per tema' });

    Object.keys(Data.temaCounts()).sort().forEach(function (t) {
      var rule = Exam.findRule('base', t);
      var chip = el('button', {
        type: 'button',
        class: 'chip',
        'aria-pressed': 'false',
        title: t + ' · ' + Data.temaCounts()[t] + ' domande'
      }, [
        el('span', { class: 'chip-name', text: rule ? rule.short : t }),
        el('span', { class: 'chip-count', text: String(Data.temaCounts()[t]) })
      ]);
      chip.addEventListener('click', function () {
        temaSel.value = temaSel.value === t ? '' : t;
        syncChips();
        updateMatchCount();
      });
      chips.push(chip);
      chip.dataset.tema = t;
      chipRow.appendChild(chip);
    });

    function syncChips() {
      chips.forEach(function (chip) {
        var on = temaSel.value !== '' && chip.dataset.tema === temaSel.value;
        chip.classList.toggle('is-on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    temaSel.addEventListener('change', function () {
      syncChips();
      updateMatchCount();
    });

    var startBtn = button('INIZIA', {
      variant: 'primary',
      onClick: function () {
        var opts = {
          size: Number(sizeInput.value) || settings.practiceSize,
          wrongOnly: wrongBox.checked,
          unseenOnly: unseenBox.checked,
          tema: temaSel.value,
          voce: voceSel.value,
          search: search.value
        };
        Store.saveSettings({ practiceSize: opts.size });
        ctx.start('practice', opts);
      }
    });

    function currentOpts() {
      return {
        wrongOnly: wrongBox.checked,
        unseenOnly: unseenBox.checked,
        tema: temaSel.value,
        voce: voceSel.value,
        search: search.value
      };
    }

    /* Same pool, same order as Pool.filter: what is counted here is exactly
     * what ctx.start will sample. Zero matches disables INIZIA, so the user
     * sees "nothing to start" on screen instead of a silent full-bank run. */
    function updateMatchCount() {
      var n = Pool.count(currentOpts());
      matchLine.textContent = n === 0
        ? 'Nessuna domanda corrisponde alla ricerca o ai filtri.'
        : n + ' domande su ' + Data.total + ' corrispondono ai filtri.';
      startBtn.disabled = n === 0;
      updateMatches();
    }

    /* Tally one field (tema/voce) across a list of questions, most populated
     * first, so the busiest topics surface on the left. */
    function groupByField(list, field, emptyLabel) {
      var map = {};
      list.forEach(function (q) {
        var k = q[field] || emptyLabel;
        map[k] = (map[k] || 0) + 1;
      });
      return Object.keys(map).map(function (k) {
        return { key: k, name: k, count: map[k] };
      }).sort(function (a, b) {
        return (b.count - a.count) || a.name.localeCompare(b.name);
      });
    }

    /* Render "where the matches live" as clickable TEMA/VOCE chips. Only shown
     * while a search is active: that is the moment a bare count stops being
     * useful and the topics become the thing to click. */
    function updateMatches() {
      UI.clear(matchesBox);
      var term = search.value.trim();
      if (!term) { matchesBox.classList.add('is-hidden'); return; }
      matchesBox.classList.remove('is-hidden');

      var pool = Pool.filter(currentOpts());
      if (!pool.length) return; /* the count line already says "nessuna" */

      matchesBox.appendChild(el('h3', { class: 'matches-title',
        text: 'DOVE SI TROVANO' }));

      [['tema', 'Temi', '(senza tema)'], ['voce', 'Voci', '(senza voce)']]
        .forEach(function (cfg) {
          var field = cfg[0], label = cfg[1], empty = cfg[2];
          var groups = groupByField(pool, field, empty);
          if (!groups.length) return;
          var MAX = 15;
          var sel = field === 'tema' ? temaSel : voceSel;
          var row = el('div', { class: 'matches-row' });
          row.appendChild(el('span', { class: 'matches-label', text: label + ':' }));
          groups.slice(0, MAX).forEach(function (g) {
            var on = sel.value === g.key;
            var chip = el('button', {
              type: 'button',
              class: 'chip match-chip' + (on ? ' is-on' : ''),
              title: g.name + ' · ' + g.count + ' domande',
              'data-kind': field
            }, [
              el('span', { class: 'chip-name', text: g.name }),
              el('span', { class: 'chip-count', text: String(g.count) })
            ]);
            chip.addEventListener('click', function () {
              sel.value = sel.value === g.key ? '' : g.key;
              if (field === 'tema') syncChips();
              updateMatchCount();
            });
            row.appendChild(chip);
          });
          var rest = groups.length - Math.min(groups.length, MAX);
          if (rest > 0) {
            row.appendChild(el('span', { class: 'muted small',
              text: '+ ' + rest + ' altri' }));
          }
          matchesBox.appendChild(row);
        });
    }

    search.addEventListener('input', updateMatchCount);
    voceSel.addEventListener('change', updateMatchCount);
    wrongBox.addEventListener('change', updateMatchCount);
    unseenBox.addEventListener('change', updateMatchCount);

    var wrap = el('div');

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h1', { text: 'Allenamento' }),
      el('p', { class: 'muted', text:
        'Il progresso viene registrato a ogni risposta. Le domande sono ' +
        'mescolate in ordine casuale.' }),
      el('div', { class: 'game-sub', style: 'margin-bottom:14px' }, [
        UI.icon('buoy'),
        el('span', { text: 'SCEGLI QUANTO E DOVE NAVIGARE' }),
        UI.icon('compass')
      ]),
      el('label', { class: 'field' }, [
        'CERCA',
        search
      ]),
      matchLine,
      matchesBox,
      el('h2', { class: 'filter-head', text: 'FILTRA PER TEMA' }),
      chipRow,
      el('div', { class: 'grid' }, [
        el('label', { class: 'field' }, ['Quante domande', sizeInput]),
        el('label', { class: 'field' }, ['Tema', temaSel]),
        el('label', { class: 'field' }, ['Voce', voceSel])
      ]),
      el('div', { class: 'stack', style: 'margin-top:12px' }, [
        el('label', { class: 'check' }, [wrongBox,
          el('span', { text: 'Solo domande sbagliate (' + wrongNums.length + ')' })]),
        el('label', { class: 'check' }, [unseenBox,
          el('span', { text: 'Solo domande non ancora viste (' + unseenCount + ')' })]),
        el('label', { class: 'check' }, [
          el('input', { type: 'checkbox' }),
          el('span', { text: 'Mostra subito la risposta corretta' })
        ])
      ]),
      el('div', { class: 'row', style: 'margin-top:14px' }, [
        startBtn,
        button('INDIETRO', { variant: 'ghost', onClick: function () { ctx.go('home'); } })
      ])
    ]));

    updateMatchCount();
    return wrap;
  }

  /* ---------------- QUIZ ---------------- */

  function formatClock(ms) {
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /* Short sound effect, if the optional sound module is present. Kept in one
   * place so screens never have to care whether it loaded. */
  function sfx(name) {
    if (global.Sfx && typeof global.Sfx.play === 'function') global.Sfx.play(name);
  }

  function quiz(ctx) {
    var session = ctx.session;
    var wrap = el('div');
    var timerNode = null;
    var timerId = null;

    function stopTimer() {
      if (timerId !== null) { global.clearInterval(timerId); timerId = null; }
    }

    function tick() {
      if (!timerNode) return;
      var left = session.timeLeftMs();
      timerNode.textContent = formatClock(left);
      timerNode.style.color = left < 5 * 60 * 1000 ? 'var(--bad)' : 'var(--foam)';
      if (errorsNode) {
        errorsNode.textContent = session.errorsUsed() + ' / ' + session.exam.maxErrors;
        errorsNode.style.color = session.errorsUsed() > session.exam.maxErrors
          ? 'var(--bad)' : 'var(--ink)';
      }
      if (ctx.hud) ctx.hud();
      if (left <= 0) {
        stopTimer();
        ctx.finish('Tempo scaduto');
      }
    }

    function questionCard() {
      var q = session.current();
      if (!q) return el('div', { class: 'panel' }, 'Nessuna domanda disponibile.');

      var picked = session.answerFor(q.n);
      var locked = picked !== null;

      var answers = el('div', { class: 'answers' }, q.answers.map(function (a, i) {
        var cls = 'answer-btn';
        if (locked && i === q.correctAnswer) cls += ' is-ok';
        else if (locked && i === picked) cls += ' is-bad';
        return el('button', {
          type: 'button',
          class: cls,
          disabled: locked,
          onclick: function () {
            session.answer(i);
            sfx(i === q.correctAnswer ? 'correct' : 'wrong');
            /* Re-render in place: locking the buttons and the feedback must not
             * drag the page back to the top, or on a phone the AVANTI button
             * ends up below the fold again right when it is needed. */
            ctx.render({ scroll: 'keep' });
          }
        }, [
          el('span', { class: 'answer-key', text: a.letter }),
          el('span', { text: a.text })
        ]);
      }));

      var head = el('div', { class: 'qhead' }, [
        el('span', { class: 'crumb', text:
          'Domanda ' + (session.index + 1) + ' / ' + session.total() }),
        el('div', { class: 'row', style: 'gap:6px' }, [
          q.needsReview ? tag('DA VERIFICARE', 'warn') : null,
          q.image ? tag('FIGURA', 'info') : null,
          tag('n. ' + q.n),
          el('button', { class: 'xbtn', type: 'button', text: 'VERIFICA FONTE',
            title: 'Mostra pagina, riga e testo originale del PDF',
            onclick: function () { Source.open(q); } })
        ])
      ]);

      var footItems = [];
      footItems.push(button('‹ PRECEDENTE', {
        variant: 'ghost', disabled: session.index === 0,
        onClick: function () { session.prev(); ctx.render(); }
      }));

      var done = session.answeredCount();
      footItems.push(el('div', { style: 'flex:1 1 240px;min-width:200px' }, [
        UI.voyage(done, session.total()),
        el('div', { class: 'small muted', style: 'margin-top:6px',
          text: done + ' / ' + session.total() + ' risposte' })
      ]));

      if (session.isComplete()) {
        footItems.push(button('RISULTATO', {
          variant: 'primary', onClick: function () { ctx.finish('Completato'); }
        }));
      } else {
        footItems.push(button(session.index === session.total() - 1
          ? 'ULTIMA ›' : 'AVANTI ›', {
          onClick: function () { session.next(); ctx.render(); }
        }));
      }
      if (session.mode === 'exam') {
        footItems.push(button('CONSEGNA', {
          variant: 'danger', onClick: function () { ctx.finish('Consegna anticipata'); }
        }));
      }

      var meta = el('div', { class: 'row small muted', style: 'margin-top:10px' }, [
        el('span', { text: 'TEMA: ' + (q.tema || '—') }),
        el('span', { text: 'VOCE: ' + (q.voce || '—') }),
        el('span', { text: 'PROGRESSIVO: ' + (q.progressivo || '—') })
      ]);

      /* Training mode gives an immediate verdict. In exam mode this stays null, so
       * nothing reveals the right answer before the paper is handed in. */
      var feedback = null;
      var cardClass = 'qcard';
      if (locked && session.mode === 'practice') {
        if (session.isCorrect(q.n)) {
          feedback = el('div', { class: 'fx-star' }, [
            UI.icon('star'),
            el('span', { text: 'ROTTA CORRETTA! Risposta corretta.' })
          ]);
        } else {
          feedback = el('div', { class: 'fx-bad' }, [
            UI.icon('buoy-red'),
            el('span', { text: 'ROTTA SBAGLIATA! Risposta corretta: ' +
              q.answers[q.correctAnswer].letter + ') ' +
              q.answers[q.correctAnswer].text })
          ]);
          cardClass += ' shake';
        }
      }

      return el('div', { class: cardClass }, [
        head,
        el('div', { class: 'qbody' }, [
          q.image ? el('img', { class: 'figure', src: q.image, loading: 'lazy',
            alt: 'Figura della domanda ' + q.n }) : null,
          el('div', { class: 'qtext', text: q.question }),
          answers,
          meta,
          feedback
        ]),
        el('div', { class: 'qfoot' }, footItems)
      ]);
    }

    /* The exam banner: which paper, how much time is left, how many errors have
     * been spent against the number the regulations allow, and what is needed
     * to pass. The clock is the only part that ticks. */
    var timerRow = null;
    var errorsNode = null;

    if (session.isExam()) {
      var exam = session.exam;

      timerNode = el('strong', { class: 'clock',
        text: formatClock(session.timeLeftMs()) });
      errorsNode = el('strong', { class: 'err-num',
        text: session.errorsUsed() + ' / ' + exam.maxErrors });

      timerRow = el('div', { class: 'panel panel-tight exam-bar' }, [
        el('div', { class: 'exam-bar-main' }, [
          el('span', { class: 'exam-bar-label', text: exam.label }),
          el('div', { class: 'clock-row' }, [
            el('span', { class: 'muted small', text: 'Tempo rimanente' }),
            timerNode
          ])
        ]),
        el('div', { class: 'exam-bar-side' }, [
          el('div', { class: 'bar-cell' }, [
            el('span', { class: 'muted small', text: 'Errori' }), errorsNode
          ]),
          el('div', { class: 'bar-cell' }, [
            el('span', { class: 'muted small', text: 'Per passare' }),
            el('strong', { class: 'bar-num',
              text: exam.passMark + ' / ' + exam.total })
          ])
        ])
      ]);
      timerId = global.setInterval(tick, 1000);
    }

    wrap.appendChild(el('div', { class: 'panel panel-tight row spread' }, [
      el('div', {}, [
        el('strong', { text: session.isExam()
          ? session.exam.label
          : 'Allenamento' }),
        el('div', { class: 'small muted', text: session.isExam()
          ? 'Una sola risposta per domanda, non modificabile. ' + session.rulesLine()
          : 'Puoi tornare indietro e rivedere le risposte date.' })
      ]),
      button('ESCI', { variant: 'ghost', onClick: function () {
        stopTimer();
        ctx.quit();
      } })
    ]));

    if (timerRow) wrap.appendChild(timerRow);
    wrap.appendChild(questionCard());
    wrap.__stopTimer = stopTimer;
    return wrap;
  }

  /* ---------------- RESULT ---------------- */

  function result(ctx) {
    var session = ctx.session;
    var sum = session.summary();
    var wrap = el('div');

    var isExam = session.isExam();
    var verdict;
    if (isExam) {
      verdict = sum.passed
        ? { text: session.exam.label + ' SUPERATO', cls: 'ok' }
        : { text: session.exam.label + ' NON SUPERATO', cls: 'bad' };
    } else {
      verdict = { text: 'SESSIONE COMPLETATA', cls: '' };
    }

    sfx('complete');

    /* The boat has arrived: harbour on one side, lighthouse on the other. */
    wrap.appendChild(el('div', { class: 'voyage-done' }, [
      el('i', { class: 'scene-lighthouse', 'aria-hidden': 'true' }),
      el('i', { class: 'scene-harbor', 'aria-hidden': 'true' }),
      el('i', { class: 'scene-boat', 'aria-hidden': 'true' }),
      el('div', { style: 'position:relative' }, [
        el('div', { class: 'voyage-banner' + (verdict.cls ? ' ' + verdict.cls : ''),
          text: verdict.text }),
        el('div', { class: 'row spread' }, [
          el('div', {}, [
            el('div', { class: 'score-big' + (verdict.cls ? ' ' + verdict.cls : ''),
              text: sum.percent + '%' }),
            el('div', { class: 'small muted', text:
              sum.right + ' risposte giuste su ' + sum.total }),
            isExam ? el('div', { class: 'small muted', text:
              'Soglia di passaggio: ' + sum.passMark + ' risposte giuste su ' +
                sum.total + ' · massimo ' + sum.maxErrors +
                ' error' + (sum.maxErrors === 1 ? 'e' : 'i') }) : null
          ]),
          el('div', {}, [UI.rankBadge(sum.percent)])
        ])
      ])
    ]));

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('div', { class: 'stat-row' }, [
        UI.stat('GIUSTE', sum.right + '/' + sum.total, 'ok', 'flag-green'),
        UI.stat('ERRORI', sum.errors + '/' + sum.total, 'bad', 'buoy-red'),
        UI.stat('TEMPO USATO', formatClock(sum.timeUsedMs), '', 'compass'),
        UI.stat('NON RISPOSTE', sum.unanswered, '', 'chart')
      ]),
      el('div', { class: 'row', style: 'margin-top:14px' }, [
        button('RIPROVA SOLO SBAGLIATE', {
          disabled: sum.wrongList.length === 0,
          onClick: function () {
            var qs = sum.wrongList.map(Data.get).filter(Boolean);
            ctx.start('practice', { questions: qs, size: qs.length });
          }
        }),
        isExam ? button('SCEGLI ESAME', { variant: 'primary',
          onClick: function () { ctx.go('examtype'); } }) : null,
        /* An exam's "new session" restarts the same official paper; a training
         * session goes back to the setup screen. The previous build sent both
         * to ALLENAMENTO, so a finished exam never offered to try the paper
         * again without leaving the debrief. */
        button('NUOVA SESSIONE', {
          onClick: function () {
            if (isExam) {
              var error = ctx.startExam(session.examId);
              if (error) global.alert('Esame non disponibile: ' + error);
            } else {
              ctx.go('practice');
            }
          } }),
        button('ARCHIVIO', { variant: 'ghost',
          onClick: function () { ctx.go('bank'); } })
      ])
    ]));

    /* Official exams also report the score per subject, in the order of the
     * regulations, so a candidate can see which part of the syllabus to
     * revise. Only shown once the paper has been handed in. */
    if (isExam && sum.breakdown.length) {
      wrap.appendChild(el('div', { class: 'panel' }, [
        el('h2', { text: 'Risultato per materia' }),
        el('div', {}, sum.breakdown.map(function (row) {
          var pct = row.total ? UI.percent(row.right, row.total) : 0;
          var ok = row.right === row.total;
          return el('div', { class: 'bar-row' }, [
            el('div', { class: 'lbl' }, [
              el('span', { text: row.label }),
              el('span', { class: 'muted', text: row.right + '/' + row.total +
                (ok ? ' ✓' : '') })
            ]),
            UI.bar(pct, ok ? 'good' : pct >= 50 ? '' : 'bad')
          ]);
        }))
      ]));
    }

    if (sum.wrongList.length) {
      wrap.appendChild(el('div', { class: 'panel' }, [
        el('h2', { text: 'Da rivedere (' + sum.wrongList.length + ')' }),
        el('div', {}, sum.byNumber.filter(function (r) {
          return r.picked !== null && !r.correct;
        }).map(function (r) {
          var q = Data.get(r.n);
          return el('div', { class: 'result-item is-wrong' }, [
            el('div', { class: 'row spread' }, [
              el('strong', { text: 'n. ' + r.n }),
              el('span', { class: 'small muted', text: q.tema || '' })
            ]),
            el('div', { text: q.question }),
            el('div', { class: 'small', style: 'margin-top:4px' }, [
              el('span', { class: 'muted', text: 'Hai risposto: ' +
                q.answers[r.picked].letter }),
              el('span', { text: ' · Corretta: ' + q.answers[r.ok].letter + ') ' +
                q.answers[r.ok].text, style: 'color:var(--ok)' })
            ]),
            el('div', { style: 'margin-top:6px' }, [
              el('button', { class: 'xbtn', type: 'button', text: 'VERIFICA FONTE',
                onclick: function () { Source.open(q); } })
            ])
          ]);
        }))
      ]));
    }

    if (isExam && sum.unanswered > 0) {
      wrap.appendChild(el('div', { class: 'panel panel-tight' }, [
        el('p', { class: 'small muted', style: 'margin:0', text:
          sum.unanswered + ' domande non sono state risposte e non contano ' +
          'come giuste.' })
      ]));
    }

    if (isExam && sum.failedOnErrors) {
      wrap.appendChild(el('div', { class: 'panel panel-tight exam-fail' }, [
        el('p', { class: 'small', style: 'margin:0', text:
          'Errori ' + sum.errors + ' su un massimo di ' + sum.maxErrors +
          ' consentiti: l\'esame non è superato.' })
      ]));
    }

    return wrap;
  }

  /* ---------------- ARCHIVE ---------------- */

  function bank(ctx) {
    var wrap = el('div');
    var listNode = el('div');

    var search = el('input', { type: 'text', placeholder: 'testo, TEMA, VOCE o n.',
      class: 'opt' });
    search.style.flex = '1 1 260px';

    var temaSel = el('select', { class: 'opt' },
      [el('option', { value: '', text: 'Tutti i temi' })].concat(
        Object.keys(Data.temaCounts()).sort().map(function (t) {
          return el('option', { value: t, text: t });
        })));
    var voceSel = el('select', { class: 'opt' },
      [el('option', { value: '', text: 'Tutte le voci' })].concat(
        Object.keys(Data.voceCounts()).sort().map(function (v) {
          return el('option', { value: v, text: v });
        })));
    var stateSel = el('select', { class: 'opt' }, [
      el('option', { value: '', text: 'Stato: tutte' }),
      el('option', { value: 'right', text: 'Stato: giuste' }),
      el('option', { value: 'wrong', text: 'Stato: sbagliate' }),
      el('option', { value: 'unseen', text: 'Stato: non viste' })
    ]);

    function refresh() {
      var needle = search.value.trim().toLowerCase();
      var tema = temaSel.value;
      var voce = voceSel.value;
      var state = stateSel.value;

      var rows = Data.questions.filter(function (q) {
        if (tema && q.tema !== tema) return false;
        if (voce && q.voce !== voce) return false;
        var st = Store.stateOf(q.n);
        if (state === 'right' && st !== Store.RIGHT) return false;
        if (state === 'wrong' && st !== Store.WRONG) return false;
        if (state === 'unseen' && st !== Store.UNSEEN) return false;
        if (!needle) return true;
        return (q.n + ' ' + q.question + ' ' + (q.tema || '') + ' ' + (q.voce || '') +
          ' ' + (q.progressivo || '') + ' ' +
          q.answers.map(function (a) { return a.text; }).join(' '))
          .toLowerCase().indexOf(needle) >= 0;
      });

      UI.clear(listNode);
      listNode.appendChild(el('p', { class: 'small muted', text:
        rows.length + ' domande su ' + Data.total + ' corrispondono ai filtri.' }));

      rows.forEach(function (q) {
        var st = Store.stateOf(q.n);
        var cls = 'bank-row' + (st === Store.RIGHT ? ' is-right' :
          st === Store.WRONG ? ' is-wrong' : ' is-new');
        listNode.appendChild(el('div', { class: cls }, [
          el('span', { class: 'num', text: String(q.n) }),
          el('span', { class: 'txt', text: q.question, title: q.question }),
          el('span', { class: 'right row', style: 'gap:6px' }, [
            q.image ? tag('FIG', 'info') : null,
            q.needsReview ? tag('!', 'warn') : null,
            st === Store.RIGHT ? tag('OK', 'ok') : null,
            st === Store.WRONG ? tag('NO', 'bad') : null,
            el('button', { class: 'xbtn', type: 'button', text: 'SORGENTE',
              onclick: function () { Source.open(q); } }),
            el('button', { class: 'xbtn', type: 'button', text: 'PROVA',
              title: 'Avvia una sessione di 1 domanda su questa voce',
              onclick: function () {
                ctx.start('practice', { questions: [q], size: 1 });
              } })
          ])
        ]));
      });
    }

    [search, temaSel, voceSel, stateSel].forEach(function (node) {
      node.addEventListener('input', refresh);
      node.addEventListener('change', refresh);
    });

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h1', { text: 'Archivio domande' }),
      el('div', { class: 'row' }, [search, temaSel, voceSel, stateSel])
    ]));
    wrap.appendChild(el('div', { class: 'panel' }, [listNode]));

    refresh();
    return wrap;
  }

  /* ---------------- STATISTICS ---------------- */

  function stats(ctx) {
    var wrap = el('div');
    var s = Store.summary();

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h1', { text: 'Statistiche' }),
      el('p', { class: 'muted', text:
        'DIARIO DI BORDO: annotazioni, cappa e distintivi della rotta.' }),
      el('div', { class: 'stat-row' }, [
        UI.stat('DOMANDE TOTALI', Data.total, '', 'chart'),
        UI.stat('VISTE', s.seen, '', 'eye'),
        UI.stat('GIUSTE', s.right, 'ok', 'flag-green'),
        UI.stat('SBAGLIATE', s.wrong, 'bad', 'buoy-red'),
        UI.stat('COPERTURA', UI.percent(s.seen, Data.total) + '%', '', 'compass'),
        UI.stat('PRECISIONE', (s.seen ? UI.percent(s.right, s.seen) : 0) + '%', '',
          'lighthouse')
      ]),
      s.seen ? null : el('p', { class: 'small muted', style: 'margin-top:12px',
        text: 'Nessuna domanda ancora risposta. Inizia una sessione per popolare le statistiche.' })
    ]));

    /* Per-question right/wrong totals, so a theme shows a real rate. */
    function perTheme(key, label) {
      var counts = Data[key]();
      var keys = Object.keys(counts).sort(function (a, b) {
        return counts[b] - counts[a];
      });
      var rows = keys.map(function (k) {
        var total = counts[k];
        var right = 0;
        var seen = 0;
        Data.questions.forEach(function (q) {
          if ((q[key === 'temaCounts' ? 'tema' : 'voce']) !== k) return;
          var st = Store.stateOf(q.n);
          if (st === Store.RIGHT) { right++; seen++; }
          else if (st === Store.WRONG) seen++;
        });
        var pct = UI.percent(right, seen);
        return el('div', { class: 'bar-row' }, [
          el('div', { class: 'lbl' }, [
            el('span', { text: k }),
            el('span', { class: 'muted', text: right + '/' + total +
              ' giuste · ' + (seen ? pct + '%' : 'non vista') })
          ]),
          UI.bar(seen ? pct : 0, pct >= 70 ? 'good' : pct >= 40 ? '' : 'bad')
        ]);
      });
      return el('div', { class: 'panel' }, [
        el('h2', { text: label }),
        rows.length ? el('div', {}, rows) : el('p', { class: 'muted', text: '—' })
      ]);
    }

    wrap.appendChild(perTheme('temaCounts', 'Precisione per TEMA'));
    wrap.appendChild(perTheme('voceCounts', 'Precisione per VOCE'));

    var worst = Store.numbersWith(Store.WRONG).map(Data.get).filter(Boolean);

    if (worst.length) {
      wrap.appendChild(el('div', { class: 'panel' }, [
        el('h2', { text: 'Domande sbagliate (' + worst.length + ')' }),
        el('div', { class: 'row' }, [
          button('RIPRESENTA TUTTE', { variant: 'primary',
            onClick: function () { ctx.start('practice', { wrongOnly: true }); } })
        ]),
        el('div', { style: 'margin-top:10px' }, worst.slice(0, 60).map(function (q) {
          return el('div', { class: 'result-item is-wrong' }, [
            el('div', { class: 'row spread' }, [
              el('strong', { text: 'n. ' + q.n }),
              el('span', { class: 'small muted', text: q.tema || '' })
            ]),
            el('div', { text: q.question })
          ]);
        }))
      ]));
    }

    wrap.appendChild(el('div', { class: 'panel' }, [
      el('h2', { text: 'Dati e provenienza' }),
      el('table', { class: 'kv' }, [
        el('tbody', {}, [
          el('tr', {}, [el('th', { text: 'Domande nel banco' }),
            el('td', { text: String(Data.total) })]),
          el('tr', {}, [el('th', { text: 'Domande con figura' }),
            el('td', { text: String(Data.figureCount) })]),
          el('tr', {}, [el('th', { text: 'Correzioni ortografiche applicate' }),
            el('td', { text: String(countCorrections()) })]),
          el('tr', {}, [el('th', { text: 'Domande da verificare' }),
            el('td', { text: String(Data.questions.filter(function (q) {
              return q.needsReview; }).length) })]),
          el('tr', {}, [el('th', { text: 'Salvataggio locale' }),
            el('td', { text: Store.isPersistent() ? 'attivo' : 'non disponibile' })])
        ])
      ])
    ]));

    return wrap;
  }

  function countCorrections() {
    var n = 0;
    Data.questions.forEach(function (q) { n += q.corrections.length; });
    return n;
  }

  global.Screens = {
    home: home,
    practice: practice,
    quiz: quiz,
    result: result,
    bank: bank,
    stats: stats,
    examtype: examtype,
    formatClock: formatClock
  };
}(this));