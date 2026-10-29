/* Official examination structure.
 *
 * An official paper is NOT a random sample of the whole bank: the number of
 * questions per subject is fixed by the exam regulations. This module owns that
 * distribution, so the quiz screen, the timer, the pass mark and the result
 * breakdown all read one description of each exam instead of repeating numbers.
 *
 * The TEMA strings below are the values that actually appear in
 * data/questions.js, not the wording of the regulations. They are verified at
 * run time by validate(); if the bank ever changes, an unmapped or too-small
 * category is reported instead of being quietly replaced by another subject.
 *
 * Training sessions do not use any of this: they stay free-form (see
 * buildPool in app.js).
 */
(function (global) {
  'use strict';

  /* QUIZ BASE: 20 questions in 30 minutes, at most 4 errors, 16 correct to
   * pass. The order below is the order of the official regulations. */
  var BASE_RULES = [
    { key: 'scafo', label: 'Teoria dello scafo', short: 'Teoria scafo',
      tema: 'TEORIA DELLO SCAFO', count: 1 },
    { key: 'motore', label: 'Motore', short: 'Motore',
      tema: 'MOTORI', count: 1 },
    { key: 'sicurezza', label: 'Sicurezza della navigazione', short: 'Sicurezza',
      tema: 'SICUREZZA DELLA NAVIGAZIONE', count: 3 },
    { key: 'manovra', label: 'Manovra e condotta', short: 'Manovra',
      tema: 'MANOVRA E CONDOTTA', count: 4 },
    { key: 'colreg', label: 'COLREG e segnalamento marittimo', short: 'COLREG',
      tema: 'COLREG E SEGNALAMENTO MARITTIMO', count: 2 },
    { key: 'meteo', label: 'Meteorologia', short: 'Meteorologia',
      tema: 'METEOROLOGIA', count: 2 },
    { key: 'navigazione', label: 'Navigazione cartografica ed elettronica',
      short: 'Navigazione',
      tema: 'NAVIGAZIONE CARTOGRAFICA ED ELETTRONICA', count: 4 },
    { key: 'normativa', label: 'Normativa diportistica e ambientale',
      short: 'Normativa',
      tema: 'NORMATIVA DIPORTISTICA E AMBIENTALE', count: 3 }
  ];

  /* QUIZ BASE is the only paper this build offers.
   *
   * A Vela paper (5 questions, 15 minutes, at most 1 error, 4 to pass) used to
   * be defined here. It was removed because the source PDF does not cover the
   * vela syllabus, so there is nothing to draw those questions from: the bank
   * has no `Teoria della Vela - Attrezzature - Manovre` TEMA. Offering the
   * paper would have meant either showing an empty exam or borrowing questions
   * from the motor subject and labelling them Vela, so it is gone rather than
   * disabled. If a genuine Vela source is added later, a second entry in EXAMS
   * plus a matching TEMA in the bank is all that is needed.
   */
  var EXAMS = {
    base: {
      id: 'base',
      label: 'QUIZ BASE',
      blurb: '20 domande · 30 minuti · massimo 4 errori',
      minutes: 30,
      maxErrors: 4,
      rules: BASE_RULES
    }
  };

  /* The pass mark is a regulation, not a percentage: 16/20 is 80%, but it must
   * stay 16 if the paper ever changes length. */
  Object.keys(EXAMS).forEach(function (id) {
    var exam = EXAMS[id];
    exam.seconds = exam.minutes * 60;
    exam.total = exam.rules.reduce(function (sum, r) { return sum + r.count; }, 0);
    exam.passMark = exam.total - exam.maxErrors;
  });

  var ORDER = ['base'];

  function get(id) { return EXAMS[id] || null; }

  function ids() { return ORDER.slice(); }

  function findRule(examId, tema) {
    var exam = EXAMS[examId];
    if (!exam) return null;
    for (var i = 0; i < exam.rules.length; i++) {
      if (exam.rules[i].tema === tema) return exam.rules[i];
    }
    return null;
  }

  /* Why an exam can or cannot be built from the bank that is actually loaded.
   * Returns { available, total, problems, shortfalls }. A problem is a rule
   * that names a TEMA the bank does not contain at all; a shortfall is a TEMA
   * that exists but holds fewer questions than the paper needs. Neither is ever
   * worked around by borrowing questions from another subject. */
  function validate(examId) {
    var exam = EXAMS[examId];
    var result = { id: examId, available: true, total: 0, problems: [], shortfalls: [] };
    if (!exam) {
      result.available = false;
      result.problems.push('Esame sconosciuto: ' + examId);
      return result;
    }

    var counts = Data.temaCounts();
    var declared = 0;
    exam.rules.forEach(function (rule) {
      declared += rule.count;
      var available = counts[rule.tema] || 0;
      if (!available) {
        result.problems.push(rule.label + ': il banco non contiene il TEMA "' +
          rule.tema + '"');
      } else if (available < rule.count) {
        result.shortfalls.push(rule.label + ': ' + available + ' domande disponibili, ' +
          'ne servono ' + rule.count);
      }
    });

    if (declared !== exam.total) {
      result.problems.push('La distribuzione dichiara ' + declared +
        ' domande ma l\'esame ne contiene ' + exam.total);
    }

    result.available = !result.problems.length && !result.shortfalls.length;
    result.total = declared;
    return result;
  }

  /* One line explaining an unavailable exam, for the UI. */
  function unavailableReason(examId) {
    var check = validate(examId);
    if (check.available) return '';
    var lines = check.problems.concat(check.shortfalls);
    return lines.join(' · ');
  }

  function available(examId) { return validate(examId).available; }

  /* Builds the paper: the required number of questions from every category,
   * drawn at random without repeats, then the whole paper shuffled so the
   * subject order is not a giveaway. Returns null and sets `error` when the
   * bank cannot satisfy the regulations. */
  function buildPaper(examId, rng) {
    var exam = EXAMS[examId];
    var outcome = { questions: [], error: null };
    if (!exam) {
      outcome.error = 'Esame sconosciuto: ' + examId;
      return outcome;
    }

    var check = validate(examId);
    if (!check.available) {
      outcome.error = unavailableReason(examId);
      return outcome;
    }

    /* Question numbers already used, so a question can never appear twice even
     * if two categories were ever mapped to the same TEMA. */
    var used = Object.create(null);

    exam.rules.forEach(function (rule) {
      var candidates = Data.questions.filter(function (q) {
        return q.tema === rule.tema && !used[q.n];
      });
      var picked = shuffle(candidates, rng).slice(0, rule.count);
      picked.forEach(function (q) { used[q.n] = true; });
      outcome.questions = outcome.questions.concat(picked);
    });

    if (outcome.questions.length !== exam.total) {
      outcome.error = 'Il banco ha prodotto ' + outcome.questions.length +
        ' domande invece di ' + exam.total;
      outcome.questions = [];
      return outcome;
    }

    outcome.questions = shuffle(outcome.questions, rng);
    return outcome;
  }

  /* Fisher-Yates, accepting an optional rng so a test can make it repeatable.
   * Math.random is read lazily so a stub installed after load still applies. */
  function shuffle(list, rng) {
    var random = rng || function () { return Math.random(); };
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* Per-category score for the result screen, in the official order.
   * `answerFor(n)` returns the chosen option index, or null when the question
   * was left unanswered, so this module stays free of any answer state. */
  function breakdown(examId, questions, answerFor) {
    var exam = EXAMS[examId];
    if (!exam) return [];
    return exam.rules.map(function (rule) {
      var inRule = questions.filter(function (q) { return q.tema === rule.tema; });
      var right = 0;
      var answered = 0;
      inRule.forEach(function (q) {
        var picked = answerFor(q.n);
        if (picked === null || picked === undefined) return;
        answered++;
        if (picked === q.correctAnswer) right++;
      });
      return {
        key: rule.key,
        label: rule.label,
        short: rule.short,
        tema: rule.tema,
        total: rule.count,
        answered: answered,
        right: right
      };
    });
  }

  /* Short rules line for the quiz header: "20 domande · 30 minuti · massimo 4
   * errori · 16 giuste per passare". */
  function rulesLine(examId) {
    var exam = EXAMS[examId];
    if (!exam) return '';
    return exam.total + ' domande · ' + exam.minutes + ' minuti · massimo ' +
      exam.maxErrors + ' error' + (exam.maxErrors === 1 ? 'e' : 'i') + ' · ' +
      exam.passMark + ' risposte giuste per passare';
  }

  global.Exam = {
    EXAMS: EXAMS,
    BASE_RULES: BASE_RULES,
    ids: ids,
    get: get,
    validate: validate,
    available: available,
    unavailableReason: unavailableReason,
    buildPaper: buildPaper,
    breakdown: breakdown,
    findRule: findRule,
    rulesLine: rulesLine
  };
}(this));