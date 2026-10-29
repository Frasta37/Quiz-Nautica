/* Data access layer.
 *
 * Questions arrive from data/questions.js as a compact array, because
 * fetch() of a local JSON file is blocked on file://. This module unwraps that
 * compact form into full objects and offers the lookups the UI needs.
 */
(function (global) {
  'use strict';

  var raw = global.QUIZ_QUESTIONS || [];
  var rawCategories = global.QUIZ_CATEGORIES || [];

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /* These labels must match the ones tools/extract_quiz.py writes into
   * data/categories.js, otherwise the archive filters and the category tree
   * would disagree about a question with a blank cell in the source. */
  var NO_VOCE = '(VOCE vuota nel sorgente)';
  var NO_TEMA = '(senza TEMA nel sorgente)';

  function unwrap(r) {
    var s = r.s || {};
    return {
      id: r.id,
      n: r.n,
      progressivo: r.prog,
      tema: r.tema,
      voce: r.voce,
      question: r.q,
      answers: (r.a || []).map(function (a, i) {
        return { text: a.t, correct: !!a.c, letter: LETTERS[i] || String(i + 1) };
      }),
      correctAnswer: typeof r.ok === 'number' ? r.ok : -1,
      image: r.img || null,
      images: r.imgs || [],
      needsReview: !!r.rev,
      reviewFlags: r.flags || [],
      corrections: r.fix || [],
      source: {
        page: s.page,
        rowNumber: s.row,
        progressivoRaw: s.prog,
        numberRaw: s.numRaw,
        vfRaw: s.vf || [],
        questionRaw: s.qRaw,
        answersRaw: s.aRaw || [],
        temaRaw: s.temaRaw,
        voceRaw: s.voceRaw,
        bbox: s.bbox || null,
        cellBbox: s.cellBox || null,
        imageCellBbox: s.imgCell || null,
        figureBbox: s.figBox || null,
        rowImage: s.rowImg || null,
        rowImageSha256: s.rowSha || null,
        rowImageDpi: s.rowDpi || null,
        rowImageSize: s.rowSize || null,
        figureSha256: s.figSha || null,
        figureIsVectorOnly: !!s.figVectorOnly
      }
    };
  }

  var QUESTIONS = raw.map(unwrap);
  var CATEGORIES = rawCategories;

  var byNumber = Object.create(null);
  QUESTIONS.forEach(function (q) { byNumber[q.n] = q; });

  function get(n) { return byNumber[n] || null; }

  function temaCounts() {
    var counts = Object.create(null);
    QUESTIONS.forEach(function (q) {
      var key = q.tema || NO_TEMA;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  function voceCounts() {
    var counts = Object.create(null);
    QUESTIONS.forEach(function (q) {
      var key = q.voce || NO_VOCE;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  /* Fisher-Yates, so a test session is a random sample rather than a run of
   * adjacent question numbers. */
  function shuffled(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function sample(list, n) {
    if (n >= list.length) return list.slice();
    return shuffled(list).slice(0, n);
  }

  function hasFigures() { return QUESTIONS.some(function (q) { return !!q.image; }); }

  global.Data = {
    questions: QUESTIONS,
    categories: CATEGORIES,
    letters: LETTERS,
    noVoce: NO_VOCE,
    noTema: NO_TEMA,
    total: QUESTIONS.length,
    figureCount: QUESTIONS.filter(function (q) { return !!q.image; }).length,
    get: get,
    temaCounts: temaCounts,
    voceCounts: voceCounts,
    shuffled: shuffled,
    sample: sample,
    hasFigures: hasFigures
  };
}(this));
