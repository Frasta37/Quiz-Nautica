/* "Verifica fonte": show exactly where a question came from.
 *
 * Everything displayed here is taken from data/questions.js, which is written
 * by tools/extract_quiz.py. The row screenshot is a 150 dpi crop of the source
 * PDF, so the text on screen can be compared against the original page without
 * reopening the PDF.
 *
 * The raw values are always shown next to the cleaned-up ones. Where a verified
 * typo correction was applied, the raw spelling is highlighted and the reason
 * plus reference link are listed, so no edit is silently hidden.
 */
(function (global) {
  'use strict';

  var el = UI.el;

  /* Highlight a corrected word inside its sentence by wrapping it in <mark>. */
  function markFix(text, wrong, right) {
    var frag = document.createDocumentFragment();
    if (!text) return frag;
    var lower = String(text).toLowerCase();
    var needle = String(wrong).toLowerCase();
    var at = 0;
    var hit = lower.indexOf(needle, at);
    if (hit < 0) {
      frag.appendChild(document.createTextNode(text));
      return frag;
    }
    while (hit >= 0) {
      if (hit > at) frag.appendChild(document.createTextNode(text.slice(at, hit)));
      var m = el('mark', { class: 'fix', text: text.substr(hit, needle.length),
        title: 'Corretto: ' + wrong + ' → ' + right });
      frag.appendChild(m);
      at = hit + needle.length;
      hit = lower.indexOf(needle, at);
    }
    if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
    return frag;
  }

  function group(fields, label) {
    /* Callers pass conditional rows as null, so drop the empties first. */
    var kids = fields.filter(Boolean).filter(function (f) {
      /* A row may carry either a plain value or a prebuilt node (used for the
       * checksums, which need <code> styling). Accept either. */
      if (f.node) return true;
      return f.value !== null && f.value !== undefined && f.value !== '';
    });
    if (!kids.length) return null;
    return el('div', { class: 'srcbox' }, [
      el('h3', { text: label }),
      el('div', {}, kids.map(function (f) {
        return el('dl', {}, [
          el('dt', { text: f.k }),
          el('dd', {}, [f.node || String(f.value)])
        ]);
      }))
    ]);
  }

  /* A collapsible block. <details>/<summary> is used on purpose: it works
   * without script, is reachable by keyboard, and keeps the modal short while
   * leaving the audit trail one click away. */
  function details(summaryLabel, kids) {
    var body = kids.filter(Boolean);
    if (!body.length) return null;
    var node = el('details', { class: 'srcbox src-details' }, [
      el('summary', {}, [
        UI.icon('logbook'),
        el('span', { text: summaryLabel })
      ])
    ]);
    body.forEach(function (kid) { node.appendChild(kid); });
    return node;
  }

  function fixList(q) {
    if (!q.corrections.length) return null;
    var items = q.corrections.map(function (c) {
      var links = (c.src || []).map(function (href) {
        return el('a', { href: href, target: '_blank', rel: 'noopener noreferrer',
          text: href });
      });
      return el('li', {}, [
        el('strong', { text: c.f + ' → ' + c.t }),
        ' ',
        el('span', { class: 'muted', text: 'in ' + c.fld }),
        c.why ? el('div', { class: 'muted', text: c.why }) : null,
        links.length ? el('div', {}, links) : null
      ]);
    });
    return el('div', { class: 'srcbox' }, [
      el('h3', { text: 'Correzioni ortografiche verificate' }),
      el('p', { class: 'small muted', text:
        'Il testo originale del PDF è conservato invariato. Queste correzioni ' +
        'ortografiche verificate online riguardano solo il testo visualizzato.' }),
      el('ul', { class: 'fixlist' }, items)
    ]);
  }

  function flagList(q) {
    if (!q.reviewFlags.length) return null;
    return el('div', { class: 'srcbox' }, [
      el('h3', { text: 'Segnalazioni del controllo qualità' }),
      el('ul', { class: 'flaglist' }, q.reviewFlags.map(function (f) {
        return el('li', { text: f });
      }))
    ]);
  }

  function rowImage(q) {
    if (!q.source.rowImage) {
      return el('div', { class: 'rawbox', text: 'Immagine di riga non disponibile.' });
    }
    return el('figure', { class: 'figure', style: 'max-width:100%;' }, [
      el('img', { src: q.source.rowImage, alt: 'Riga ' + (q.source.rowNumber || '?') +
        ' della pagina ' + q.source.page + ' del PDF originale', loading: 'lazy' }),
      el('figcaption', { class: 'small muted center',
        text: 'Pagina ' + q.source.page + ', riga ' + q.source.rowNumber +
          ' · ' + (q.source.rowImageDpi || '?') + ' dpi' })
    ]);
  }

  function rawBox(text, changed, wrong, right) {
    var box = el('div', { class: 'rawbox' + (changed ? ' changed' : '') });
    if (changed && wrong) box.appendChild(markFix(text, wrong, right));
    else box.textContent = text;
    return box;
  }

  /* Maps each corrected word back to the sentence it lives in, so the raw and
   * cleaned text can be shown side by side with the change highlighted. */
  function fixFor(q, field) {
    var found = q.corrections.filter(function (c) { return c.fld === field; });
    return found.length ? found[0] : null;
  }

  /* What the modal shows by default is the six numbers that identify the
   * question in the PDF, plus the crop of the original row. Bounding boxes,
   * checksums and the raw text dump are audit data: they stay available but
   * collapsed, because they are long and rarely needed to answer "where does
   * this come from?". */
  function build(q) {
    var s = q.source;
    var body = [];

    body.push(el('div', { class: 'row spread small muted', style: 'margin-bottom:10px' }, [
      el('span', { text: 'Domanda n. ' + q.n }),
      q.needsReview ? UI.tag('DA VERIFICARE', 'warn') : null
    ]));

    body.push(rowImage(q));

    body.push(group([
      /* numberRaw is the number printed on the question in the PDF, which is
       * what someone reading the paper will look for. */
      { k: 'Numero domanda PDF', value: s.numberRaw },
      { k: 'Pagina', value: s.page },
      { k: 'Riga', value: s.rowNumber },
      { k: 'Progressivo', value: s.progressivoRaw || q.progressivo },
      { k: 'Tema', value: s.temaRaw || q.tema },
      { k: 'Voce', value: s.voceRaw || q.voce }
    ], 'Identificativi nel PDF'));

    var qFix = fixFor(q, 'question');

    body.push(details('Testo originale dal PDF', [
      el('div', { class: 'srcbox src-nested' }, [
        el('h3', { text: 'Testo nel PDF (originale)' }),
        rawBox(s.questionRaw, !!qFix, qFix && qFix.f, qFix && qFix.t)
      ]),
      el('div', { class: 'srcbox src-nested' }, [
        el('h3', { text: 'Risposte nel PDF (originali)' }),
        el('table', { class: 'kv' }, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: '' }), el('th', { text: 'Testo' }),
            el('th', { text: 'V/F' })
          ])]),
          el('tbody', {}, s.answersRaw.map(function (raw, i) {
            var f = fixFor(q, 'answers[' + i + '].text');
            return el('tr', {}, [
              el('td', { text: Data.letters[i] || String(i + 1) }),
              el('td', {}, [rawBox(raw, !!f, f && f.f, f && f.t)]),
              el('td', { text: (s.vfRaw[i] || '—') })
            ]);
          }))
        ])
      ]),
      fixList(q),
      flagList(q)
    ]));

    body.push(details('Dettagli tecnici', [
      group([
        s.numberRaw ? { k: 'Numero grezzo', value: s.numberRaw } : null,
        s.cellBbox ? { k: 'Riquadro cella (pt)',
          value: '[' + s.cellBbox.join(', ') + ']' } : null,
        s.bbox ? { k: 'Riquadro riga (pt)',
          value: '[' + s.bbox.join(', ') + ']' } : null,
        s.imageCellBbox ? { k: 'Riquadro cella immagine (pt)',
          value: '[' + s.imageCellBbox.join(', ') + ']' } : null,
        s.figureBbox ? { k: 'Riquadro figura (pt)',
          value: '[' + s.figureBbox.join(', ') + ']' } : null,
        s.rowImageDpi ? { k: 'Risoluzione riga', value: s.rowImageDpi + ' dpi' } : null,
        s.rowImageSize ? { k: 'Dimensione riga', value: s.rowImageSize } : null,
        s.figureIsVectorOnly ? { k: 'Figura vettoriale',
          value: 'sì, nessuna immagine estratta' } : null,
        s.rowImageSha256 ? { k: 'SHA-256 riga',
          node: el('code', { text: s.rowImageSha256 }) } : null,
        s.figureSha256 ? { k: 'SHA-256 figura',
          node: el('code', { text: s.figureSha256 }) } : null
      ], 'Riquadri e impronte digitali')
    ]));

    return el('div', {}, body);
  }

  /* Opens the modal. Falls back to an inline section where <dialog> is
   * unavailable, so the feature never becomes a dead button. */
  function open(q) {
    var dlg = document.getElementById('sourceDialog');
    if (!dlg || typeof dlg.showModal !== 'function') {
      var host = document.getElementById('app');
      var box = el('div', { class: 'panel' }, [
        el('h2', { text: 'Verifica fonte — domanda ' + q.n }),
        build(q)
      ]);
      host.insertBefore(box, host.firstChild);
      box.scrollIntoView({ block: 'start' });
      return;
    }

    UI.clear(dlg);
    dlg.appendChild(el('form', { method: 'dialog', class: 'sheet-head' }, [
      el('h2', { text: 'Verifica fonte — domanda ' + q.n }),
      el('button', { class: 'xbtn', value: 'close', text: 'CHIUDI ✕' })
    ]));
    dlg.appendChild(el('div', { class: 'sheet-body' }, [build(q)]));
    dlg.appendChild(el('div', { class: 'sheet-foot' }, [
      UI.button('Vai alla domanda', { variant: 'ghost',
        onClick: function () { dlg.close(); } }),
      UI.button('Chiudi', { variant: 'primary',
        onClick: function () { dlg.close(); } })
    ]));
    dlg.showModal();
  }

  global.Source = { open: open, markFix: markFix, build: build };
}(this));