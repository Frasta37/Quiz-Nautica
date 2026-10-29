/* Session state for a running quiz.
 *
 * A Session owns the question order, the index, and the answers given so far.
 * Screens read it but only mutate it through the methods below, so the exam
 * timer, the review list, and the score all agree on one source of truth.
 *
 * Answering the same question twice in a session keeps the first answer. The
 * exam screen locks a question once answered, and practice unlocks it only
 * after a retry, so this rule is a safety net rather than normal behaviour.
 */
(function (global) {
  'use strict';

  function Session(opts) {
    opts = opts || {};
    this.mode = opts.mode || 'practice';        // 'exam' | 'practice'
    this.questions = opts.questions || [];
    this.index = 0;
    this.answers = {};                          // question number -> choice index
    this.startedAt = opts.startedAt || Date.now();
    this.finishedAt = null;

    /* An exam is described by js/exam.js: the timer and the pass mark come from
     * the official regulations, not from the length of the paper. */
    this.exam = this.mode === 'exam' ? Exam.get(opts.examId || 'base') : null;
    this.examId = this.exam ? this.exam.id : null;

    this.limitMs = this.exam ? this.exam.seconds * 1000 : null;
    this.finished = false;
    this.expiresAt = this.limitMs === null ? null : this.startedAt + this.limitMs;
    this.onChange = opts.onChange || function () {};
  }

  Session.prototype.isExam = function () { return this.mode === 'exam' && !!this.exam; };

  Session.prototype.current = function () {
    return this.questions[this.index] || null;
  };

  Session.prototype.total = function () { return this.questions.length; };

  Session.prototype.answeredCount = function () {
    return Object.keys(this.answers).length;
  };

  Session.prototype.isAnswered = function (n) {
    return Object.prototype.hasOwnProperty.call(this.answers, n);
  };

  Session.prototype.answerFor = function (n) {
    return this.isAnswered(n) ? this.answers[n] : null;
  };

  Session.prototype.answeredHere = function () {
    return this.isAnswered(this.current() ? this.current().n : -1);
  };

  Session.prototype.isCorrect = function (n) {
    var q = Data.get(n);
    if (!q) return false;
    return this.answers[n] === q.correctAnswer;
  };

  Session.prototype.rightCount = function () {
    var self = this;
    return Object.keys(this.answers).filter(function (n) {
      return self.isCorrect(Number(n));
    }).length;
  };

  Session.prototype.wrongList = function () {
    var self = this;
    return Object.keys(this.answers).map(Number).filter(function (n) {
      return !self.isCorrect(n);
    }).sort(function (a, b) { return a - b; });
  };

  /* Wrong answers given so far. For an official paper this is compared with the
   * number of errors the regulations allow. */
  Session.prototype.errorsUsed = function () {
    return this.answeredCount() - this.rightCount();
  };

  Session.prototype.errorsLeft = function () {
    return this.maxErrors() - this.errorsUsed();
  };

  Session.prototype.answer = function (choice) {
    var q = this.current();
    if (!q || this.finished) return false;
    if (this.isAnswered(q.n)) return false;
    if (typeof choice !== 'number' || !q.answers[choice]) return false;
    this.answers[q.n] = choice;
    Store.record(q.n, choice === q.correctAnswer);
    this.onChange('answer', { question: q, choice: choice });
    return true;
  };

  Session.prototype.goTo = function (index) {
    if (index < 0 || index >= this.questions.length) return false;
    if (index === this.index) return true;
    this.index = index;
    this.onChange('move', { index: index });
    return true;
  };

  Session.prototype.next = function () { return this.goTo(this.index + 1); };
  Session.prototype.prev = function () { return this.goTo(this.index - 1); };

  Session.prototype.unansweredNumbers = function () {
    var self = this;
    return this.questions.map(function (q) { return q.n; })
      .filter(function (n) { return !self.isAnswered(n); });
  };

  Session.prototype.isComplete = function () {
    return this.answeredCount() === this.total() && this.total() > 0;
  };

  Session.prototype.timeLeftMs = function (now) {
    if (this.expiresAt === null) return null;
    return Math.max(0, this.expiresAt - (now || Date.now()));
  };

  Session.prototype.isOutOfTime = function (now) {
    return this.limitMs !== null && this.timeLeftMs(now) <= 0;
  };

  /* Wall-clock time the session has been running, whether or not it is over. */
  Session.prototype.elapsedMs = function (now) {
    var end = this.finishedAt === null ? (now || Date.now()) : this.finishedAt;
    return Math.max(0, end - this.startedAt);
  };

  Session.prototype.finish = function () {
    if (this.finished) return false;
    this.finished = true;
    this.finishedAt = Date.now();
    this.onChange('finish', this.summary());
    return true;
  };

  Session.prototype.summary = function () {
    var right = this.rightCount();
    var seen = this.answeredCount();
    var isExam = this.isExam();
    var sum = {
      mode: this.mode,
      examId: this.examId,
      total: this.total(),
      answered: seen,
      right: right,
      wrong: seen - right,
      errors: seen - right,
      unanswered: this.total() - seen,
      percent: UI.percent(right, this.total()),
      passed: isExam ? right >= this.passMark() : null,
      passMark: isExam ? this.passMark() : null,
      maxErrors: isExam ? this.exam.maxErrors : null,
      timeUsedMs: this.elapsedMs(),
      timeLeftMs: this.timeLeftMs(),
      wrongList: this.wrongList(),
      breakdown: isExam
        ? Exam.breakdown(this.examId, this.questions, this.answerFor.bind(this))
        : [],
      byNumber: this.questions.map(function (q) {
        return {
          n: q.n,
          picked: this.answerFor(q.n),
          ok: q.correctAnswer,
          correct: this.answerFor(q.n) === q.correctAnswer
        };
      }, this)
    };
    /* Fails as soon as the allowed number of errors is exceeded, even if the
     * remaining questions are still unanswered. */
    sum.failedOnErrors = isExam ? sum.errors > this.exam.maxErrors : false;
    return sum;
  };

  /* The pass mark is fixed by the regulations: 16 of 20 for Quiz Base. It is
   * deliberately not derived from the paper length. */
  Session.prototype.passMark = function () {
    return this.exam ? this.exam.passMark : Math.ceil(this.total() * 0.9);
  };

  Session.prototype.maxErrors = function () {
    return this.exam ? this.exam.maxErrors : 0;
  };

  Session.prototype.rulesLine = function () {
    return this.exam ? Exam.rulesLine(this.examId) : '';
  };

  global.Session = Session;
}(this));