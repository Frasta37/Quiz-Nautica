/* Small DOM helpers shared by the screens. */
(function (global) {
  'use strict';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined) return node;
    if (Array.isArray(children)) {
      children.forEach(function (c) { append(node, c); });
      return node;
    }
    if (children instanceof Node) node.appendChild(children);
    else node.appendChild(document.createTextNode(String(children)));
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function button(label, opts) {
    opts = opts || {};
    var cls = 'pbtn' + (opts.variant ? ' pbtn-' + opts.variant : '') +
      (opts.className ? ' ' + opts.className : '');
    return el('button', {
      type: 'button',
      class: cls,
      text: label,
      disabled: !!opts.disabled,
      title: opts.title || null,
      onclick: opts.onClick || null
    });
  }

  /* A cell in the status strip. `ic` is a key of SPRITES; it decorates the
   * cell through a data attribute so the CSS can pick the matching sprite. */
  function stat(k, v, vClass, ic) {
    return el('div', { class: 'stat', 'data-ic': ic || null }, [
      el('div', { class: 'k', text: k }),
      el('div', { class: 'v' + (vClass ? ' ' + vClass : ''), text: String(v) })
    ]);
  }

  function tag(text, variant) {
    return el('span', { class: 'tag' + (variant ? ' tag-' + variant : ''), text: text });
  }

  function bar(pct, cls) {
    var track = el('div', { class: 'bar' });
    var fill = el('i', { class: cls || '' });
    fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    track.appendChild(fill);
    return track;
  }

  function percent(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  /* ---------------- 8-bit presentation helpers ----------------
   * These build decorative markup only. Nothing here reads or writes quiz
   * state, so the presentation can be reworked without touching the logic. */

  var SPRITES = {
    anchor: 'spr-anchor', boat: 'spr-boat', sailboat: 'spr-sailboat',
    lighthouse: 'spr-lighthouse', island: 'spr-island',
    'island-palm': 'spr-island-palm', buoy: 'spr-buoy', 'buoy-red': 'spr-buoy-red',
    wheel: 'spr-wheel', compass: 'spr-compass', chart: 'spr-chart',
    logbook: 'spr-logbook', cloud: 'spr-cloud', sun: 'spr-sun', star: 'spr-star',
    medal: 'spr-medal', lifering: 'spr-lifering', dock: 'spr-dock',
    harbor: 'spr-harbor', bird: 'spr-bird', 'flag-green': 'spr-flag-green',
    'flag-red': 'spr-flag-red', eye: 'spr-eye', heart: 'spr-heart',
    wave: 'spr-wave'
  };

  /* Decorative sprite. `name` must be one of SPRITES; anything else is ignored
   * rather than emitted, so a typo cannot leak a broken class into the DOM. */
  function icon(name, className) {
    var cls = SPRITES[name];
    if (!cls) return el('span', { class: 'mi ' + (className || 'is-missing') });
    return el('i', {
      class: 'mi ' + cls + (className ? ' ' + className : ''),
      'aria-hidden': 'true'
    });
  }

  /* The quiz progress bar, restaged as a voyage: the boat sails from the
   * harbour to the lighthouse. `done` and `total` are plain numbers. */
  function voyage(done, total) {
    var pct = total ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
    var boat = el('i', { class: 'voyage-boat' });
    boat.style.left = pct + '%';
    return el('div', { class: 'voyage' }, [
      el('div', { class: 'voyage-track' }, [
        el('i', { class: 'voyage-dots' }),
        el('i', { class: 'voyage-dock' }),
        boat,
        el('i', { class: 'voyage-goal' }),
        el('span', { class: 'voyage-count', text: done + ' / ' + total })
      ])
    ]);
  }

  /* Decorative nautical ranks for the results screen. */
  var RANKS = [
    { min: 95, name: 'CAPITANO', key: 'capitano' },
    { min: 85, name: 'SKIPPER', key: 'skipper' },
    { min: 70, name: 'TIMONIERE', key: 'timoniere' },
    { min: 50, name: 'MARINAIO', key: 'marinaio' },
    { min: 0, name: 'MOZZO', key: 'mozzo' }
  ];

  function rank(pct) {
    var found = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (pct >= RANKS[i].min) { found = RANKS[i]; break; }
    }
    var stars = pct >= 95 ? 5 : pct >= 85 ? 4 : pct >= 70 ? 3 : pct >= 50 ? 2 : 1;
    return { name: found.name, key: found.key, stars: stars };
  }

  function starRow(filled, total) {
    var row = el('div', { class: 'star-row' });
    for (var i = 0; i < (total || 5); i++) {
      row.appendChild(el('i', {
        class: 'spr-star' + (i < filled ? ' is-on' : ' is-off'),
        'aria-hidden': 'true'
      }));
    }
    return row;
  }

  /* Nautical rank badge: a medal sprite, the rank name and its stars. */
  function rankBadge(pct) {
    var r = rank(pct);
    return el('div', { class: 'rank-badge rank-' + r.key }, [
      icon('medal', 'rank-medal'),
      el('div', { class: 'rank-text' }, [
        el('div', { class: 'rank-name', text: r.name }),
        starRow(r.stars, 5)
      ])
    ]);
  }

  /* Status-bar readout in the HUD. Safe to call before the DOM exists. */
  function hud() {
    if (typeof document === 'undefined') return;
    var set = function (id, value) {
      var node = document.getElementById(id);
      if (node) node.textContent = String(value);
    };
    var s = global.Store ? global.Store.summary() : { seen: 0, right: 0, wrong: 0 };
    set('hudTotal', global.Data ? global.Data.total : 0);
    set('hudSeen', s.seen);
    set('hudRight', s.right);
    set('hudWrong', s.wrong);
  }

  global.UI = {
    el: el,
    append: append,
    clear: clear,
    button: button,
    stat: stat,
    tag: tag,
    bar: bar,
    percent: percent,
    icon: icon,
    voyage: voyage,
    rank: rank,
    starRow: starRow,
    rankBadge: rankBadge,
    hud: hud,
    RANKS: RANKS,
    SPRITES: SPRITES
  };
}(this));