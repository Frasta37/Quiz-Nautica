/* The practice pool, filtered.
 *
 * The ALLENAMENTO setup screen and app.buildPool both answer "which questions
 * will this session draw from?" and they must never disagree: the setup screen
 * shows Pool.count live while the user types, and app.js samples from
 * Pool.filter when INIZIA is pressed. One filter chain, used by both, so the
 * number on screen is the session that actually starts.
 */
(function (global) {
  'use strict';

  /* The same fields ARCHIVIO searches, so a term that is found in the bank is
   * found here too. */
  function matches(q, needle) {
    return (q.n + ' ' + q.question + ' ' + (q.tema || '') + ' ' +
      (q.voce || '') + ' ' + (q.progressivo || '') + ' ' +
      q.answers.map(function (a) { return a.text; }).join(' '))
      .toLowerCase().indexOf(needle) >= 0;
  }

  /* Every active filter narrows the pool, and an empty result stays empty.
   * The caller decides what "nothing left" means (a disabled INIZIA, the
   * start alert), so a search that finds nothing can never quietly fall back
   * to the whole bank and start a session that looks unfiltered. */
  function filter(opts) {
    opts = opts || {};
    var pool = Data.questions;

    if (opts.wrongOnly) {
      pool = Store.numbersWith(Store.WRONG).map(Data.get).filter(Boolean);
      if (!pool.length) return [];
    }
    if (opts.unseenOnly) {
      pool = pool.filter(function (q) {
        return Store.stateOf(q.n) === Store.UNSEEN;
      });
      if (!pool.length) return [];
    }
    if (opts.tema) {
      pool = pool.filter(function (q) { return q.tema === opts.tema; });
      if (!pool.length) return [];
    }
    if (opts.voce) {
      pool = pool.filter(function (q) { return q.voce === opts.voce; });
      if (!pool.length) return [];
    }
    if (opts.search) {
      var needle = String(opts.search).trim().toLowerCase();
      if (needle) {
        pool = pool.filter(function (q) { return matches(q, needle); });
        if (!pool.length) return [];
      }
    }
    return pool;
  }

  function count(opts) { return filter(opts).length; }

  global.Pool = { filter: filter, count: count };
}(this));
